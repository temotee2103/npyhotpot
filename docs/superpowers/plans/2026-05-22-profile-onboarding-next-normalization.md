# Profile Onboarding Next Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop recursive profile onboarding URLs by normalizing profile-page self references out of the `next` parameter while preserving valid return-to destinations.

**Architecture:** Introduce one shared normalization helper in `src/lib/profile-completion.ts` and route all onboarding redirect entry points through it. Keep the existing redirect flow intact, but make profile-page variants normalize to `null` so onboarding can stay on `/member/profile` instead of nesting `next`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing member auth/profile flow

---

## File Map

- Modify: `src/lib/profile-completion.ts`
  - Add canonical profile-path detection and `next` normalization helpers.
  - Make `buildProfileCompletionHref()` depend on the shared normalization result.
- Modify: `src/components/profile-completion-gate.tsx`
  - Stop passing profile self-references into onboarding redirects.
- Modify: `src/app/login/page.tsx`
  - Reuse the shared helper when routing incomplete profiles after login.
- Modify: `src/app/auth/callback/page.tsx`
  - Replace the local `startsWith("/member/profile")` check with the shared helper.
- Modify: `src/app/member/profile/page.tsx`
  - Use the shared destination resolver so onboarding without a valid `next` stays on `/member/profile`.
- Test: manual verification in browser for profile self-onboarding and checkout return flows.

### Task 1: Add Shared Next Normalization Helpers

**Files:**
- Modify: `src/lib/profile-completion.ts`

- [ ] **Step 1: Add a profile-destination normalizer**

```ts
function normalizeLocalPath(path: string) {
  const [rawPathname, rawQuery = ""] = path.split("?", 2);
  const pathname = rawPathname.endsWith("/") && rawPathname !== "/" ? rawPathname.slice(0, -1) : rawPathname;
  return { pathname, searchParams: new URLSearchParams(rawQuery) };
}

export function normalizeProfileCompletionNext(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) return null;

  const { pathname, searchParams } = normalizeLocalPath(nextPath);
  if (pathname !== "/member/profile") return nextPath;
  if (searchParams.get("onboarding") === "1") return null;
  return null;
}
```

- [ ] **Step 2: Update `buildProfileCompletionHref()` to use the shared helper**

```ts
export function buildProfileCompletionHref(nextPath?: string | null, welcome = false) {
  const params = new URLSearchParams();
  params.set("onboarding", "1");
  if (welcome) {
    params.set("welcome", "1");
  }

  const normalizedNext = normalizeProfileCompletionNext(nextPath);
  if (normalizedNext) {
    params.set("next", normalizedNext);
  }

  return `/member/profile?${params.toString()}`;
}
```

- [ ] **Step 3: Run TypeScript diagnostics on the helper file**

Run: check diagnostics for `src/lib/profile-completion.ts`  
Expected: no new TypeScript or lint errors

- [ ] **Step 4: Commit the helper change**

```bash
git add src/lib/profile-completion.ts
git commit -m "fix: normalize profile onboarding next paths"
```

### Task 2: Route All Onboarding Entry Points Through the Shared Helper

**Files:**
- Modify: `src/components/profile-completion-gate.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/auth/callback/page.tsx`
- Modify: `src/app/member/profile/page.tsx`

- [ ] **Step 1: Update `profile-completion-gate` to use the shared helper**

```ts
import { buildProfileCompletionHref, isProfileComplete, normalizeProfileCompletionNext, type CustomerProfileCompletionShape } from "@/lib/profile-completion";

const gatedNext = normalizeProfileCompletionNext(currentPath);

if (!profile || profile.status !== "active") {
  router.replace(buildProfileCompletionHref(gatedNext));
  return;
}

if (!isProfileComplete(profile)) {
  router.replace(buildProfileCompletionHref(gatedNext));
  return;
}
```

- [ ] **Step 2: Update `login/page.tsx` to use the same normalization**

```ts
import { buildProfileCompletionHref, isProfileComplete, normalizeProfileCompletionNext } from "@/lib/profile-completion";

if (!isProfileComplete(profileRes.data)) {
  return router.replace(buildProfileCompletionHref(normalizeProfileCompletionNext(redirectPath)));
}
```

- [ ] **Step 3: Update `auth/callback/page.tsx` to remove the local profile-only check**

```ts
import { buildProfileCompletionHref, isProfileComplete, normalizeProfileCompletionNext } from "@/lib/profile-completion";

if (!isProfileComplete(currentProfile)) {
  router.replace(buildProfileCompletionHref(normalizeProfileCompletionNext(nextPath), source === "register"));
  return;
}
```

- [ ] **Step 4: Update `member/profile/page.tsx` to stay on profile when `next` normalizes away**

```ts
import { resolveProfileCompletionDestination } from "@/lib/profile-completion";

const nextPath = (() => {
  const next = searchParams.get("next");
  if (!next) return "/member/profile";
  try {
    return resolveProfileCompletionDestination(decodeURIComponent(next));
  } catch {
    return "/member/profile";
  }
})();
```

- [ ] **Step 5: Run diagnostics on the four caller files**

Run: check diagnostics for:
- `src/components/profile-completion-gate.tsx`
- `src/app/login/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/app/member/profile/page.tsx`

Expected: no new TypeScript or lint errors

- [ ] **Step 6: Commit the caller updates**

```bash
git add src/components/profile-completion-gate.tsx src/app/login/page.tsx src/app/auth/callback/page.tsx src/app/member/profile/page.tsx
git commit -m "fix: prevent recursive profile onboarding redirects"
```

### Task 3: Manual Verification

**Files:**
- Modify: none
- Test: manual browser verification

- [ ] **Step 1: Verify self-onboarding no longer nests `next`**

Open:

```text
/member/profile?onboarding=1
```

Expected:
- URL stays short
- No appended `next=/member/profile...`
- Completing profile keeps user on `/member/profile`

- [ ] **Step 2: Verify trailing-slash profile variant is normalized**

Open:

```text
/member/profile/?onboarding=1
```

Expected:
- URL does not grow across refreshes or redirects
- No `414 Request-URI Too Large`

- [ ] **Step 3: Verify checkout-origin onboarding still returns correctly**

Open a gated page with incomplete profile:

```text
/shop/checkout
```

Expected:
- Redirect to `/member/profile?onboarding=1&next=%2Fshop%2Fcheckout`
- Completing profile returns to `/shop/checkout`

- [ ] **Step 4: Verify Google first-time registration path**

Run the Google register flow and observe the first profile landing page.

Expected:
- Lands on `/member/profile?onboarding=1` or `/member/profile?onboarding=1&welcome=1`
- Does not recursively append profile-page `next`

- [ ] **Step 5: Commit after verification**

```bash
git status
```

Expected:
- working tree contains only intended implementation changes
