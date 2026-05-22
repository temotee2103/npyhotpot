# Profile Onboarding Next Normalization Design

## Goals

- Stop recursive `next` wrapping on member profile onboarding URLs.
- Keep the approved behavior: when the intended destination is the member profile page itself, remain on `/member/profile` after profile completion.
- Preserve valid return-to behavior for protected destinations such as `/shop/checkout` and `/delivery/checkout`.

## Non-Goals

- Rework the overall member onboarding UX.
- Change checkout gating rules or required profile fields.
- Introduce new routes or a new redirect storage mechanism.

## Problem

- The current onboarding redirect flow allows `/member/profile` to be used as `next`.
- Some callers only exclude the exact pathname `/member/profile`, but not `/member/profile/` or profile URLs that already contain onboarding query params.
- As the user re-enters gated flows, the app repeatedly produces URLs like `/member/profile?onboarding=1&next=/member/profile?...`, causing self-referential nesting until Nginx returns `414 Request-URI Too Large`.

## Design

### A. Centralize next-path normalization

Add a shared normalization helper in `src/lib/profile-completion.ts` that decides whether a candidate path is allowed to become `next`.

Rules:
- Accept only app-local paths that start with `/`.
- Treat all of the following as the same profile destination and reject them as `next`:
  - `/member/profile`
  - `/member/profile/`
  - `/member/profile?...`
  - `/member/profile/?...`
- Reject any profile destination that already carries onboarding-related params such as `onboarding=1`.
- Return `null` for rejected paths so callers build `/member/profile?onboarding=1` without a `next` param.

### B. Use the shared helper at all redirect entry points

Update these callers to rely on the shared normalization helper instead of ad-hoc checks:
- `src/components/profile-completion-gate.tsx`
- `src/app/login/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/app/member/profile/page.tsx`

Behavior:
- If the user was heading to a real protected page like `/shop/checkout`, keep `next`.
- If the user was already on the profile page or any profile-page variant, strip `next`.

### C. Keep post-completion behavior unchanged for true destinations

After profile completion:
- When `next` is present and valid, redirect there.
- When `next` is absent because it normalized to `null`, remain on `/member/profile` instead of falling back to `/`.

This preserves the desired UX for profile onboarding entered from the profile page itself.

## Error Handling

- Invalid or non-local `next` values normalize to `null`.
- Profile self-references normalize to `null`.
- Existing onboarding URLs with excessive nesting stop growing after the first corrected navigation because future redirects no longer re-embed profile URLs.

## Acceptance Criteria

- Google first-time registration no longer produces recursive `/member/profile?...&next=/member/profile?...` URLs.
- Accessing `/member/profile` or `/member/profile/` in onboarding mode does not append a self-referential `next`.
- Accessing `/shop/checkout` or `/delivery/checkout` with incomplete profile still redirects to `/member/profile?onboarding=1&next=...`.
- Completing the profile from a checkout-origin onboarding flow still returns the user to the original checkout page.
- Completing the profile when onboarding originated from the profile page keeps the user on `/member/profile`.
