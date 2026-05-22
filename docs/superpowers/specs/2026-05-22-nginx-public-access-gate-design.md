# Nginx Public Access Gate Design

## Goals

- Temporarily block public frontend access without changing the current static export deployment model.
- Keep `/admin` and `/merchant` routes available during the closure period.
- Show a branded “not open yet” page to public visitors.
- Provide a private preview path for internal users and testers.
- Re-open the public site later by switching Nginx configuration, not by changing app architecture.

## Non-Goals

- Middleware or server-side application gate logic.
- Cookie-based preview sessions.
- Automatic scheduled opening.

## Design

### A. Public frontend blocked at Nginx

Nginx will intercept public frontend routes and serve a branded static closure page instead of the real frontend export.

### B. Internal routes remain available

The following paths remain untouched:
- `/admin`
- `/merchant`
- their required static assets

### C. Private preview path

Nginx exposes a high-entropy private preview prefix such as `/preview-<secret>/` that maps to the real frontend static export.

This allows internal users and testers to access the real site without opening the main public entry.

### D. Branded closure page

Create a standalone static HTML page with project branding and temporary closure messaging. Nginx serves this page for blocked public frontend requests.

### E. Manual reopening

When the site is ready for public launch, remove the Nginx interception rules and restore normal frontend routing.

## Acceptance Criteria

- Public visits to `/`, `/shop`, `/delivery`, and other frontend pages show the branded closure page.
- `/admin` and `/merchant` remain accessible.
- The private preview path shows the real frontend.
- Returning to public launch only requires Nginx config changes and reload.
