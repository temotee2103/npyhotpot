# NPY Hotpot

Next.js + Supabase project for the NPY Hotpot storefront, delivery flow, member system, merchant redemption, and admin back office.

## Tech Stack

- Next.js App Router
- React 19
- Supabase database + Auth + Edge Functions
- Tailwind CSS v4

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the example:

```bash
cp .env.example .env.local
```

3. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Run checks:

```bash
npm run lint
```

5. Start the app:

```bash
npm run dev
```

## Frontend Env

Root frontend env is documented in [`.env.example`](file:///D:/wampserver/www/npyhotpot/.env.example).

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional alias:

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Supabase Edge Function Secrets

Edge function secrets template is documented in [`supabase/functions/.env.example`](file:///D:/wampserver/www/npyhotpot/supabase/functions/.env.example).

Core required secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYEX_API_BASE_URL`
- `PAYEX_SIGNATURE_SECRET`
- `PAYEX_CALLBACK_URL`
- `PAYEX_RETURN_URL_SHOP`
- `PAYEX_RETURN_URL_DELIVERY`
- `LALAMOVE_API_BASE_URL`
- `LALAMOVE_MARKET`
- `LALAMOVE_API_KEY`
- `LALAMOVE_API_SECRET`
- `LALAMOVE_WEBHOOK_SECRET`

Depending on your Payex account setup, you may also use:

- `PAYEX_BASIC_AUTH_HEADER`
- `PAYEX_BASIC_USERNAME`
- `PAYEX_BASIC_PASSWORD`

## Google OAuth

For Google login / register to work:

1. Enable Google provider in Supabase Auth.
2. Add app callback URLs in Supabase Auth redirect allowlist:
   - `http://localhost:3000/auth/callback`
   - `https://npyhotpot.com/auth/callback`
3. In Google Cloud OAuth client:
   - Authorized JavaScript origins should include your local and live domains.
   - Authorized redirect URI should point to:
     - `https://<your-project-ref>.supabase.co/auth/v1/callback`

## Release Checklist

Before production release, confirm all items below:

- `npm run lint` passes
- Frontend env is set on the hosting platform
- Supabase Edge Function secrets are set in the Supabase project
- Required Supabase SQL migrations have been applied
- Google OAuth callback URLs are configured for localhost and production
- Payex callback URL is pointing to the deployed Supabase function
- Lalamove production credentials and webhook secret are configured
- Smoke test passes for:
  - login
  - Google login
  - register
  - profile completion gate
  - shop checkout
  - delivery checkout
  - Payex callback
  - admin login

## Current Release Status

At the time of the latest release-readiness pass:

- `npm run lint` passes
- There are still non-blocking warnings, mainly:
  - `next/image` recommendations for `<img>`
  - some React hook dependency warnings

Those warnings should be tracked, but they are not blocking the minimum production release path.
