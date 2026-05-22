# VPS Deploy Guide

This project is deployed on the VPS as a static Next.js export served by Nginx.

## One-time setup

Make the deploy script executable:

```bash
cd /var/www/npyhotpot
chmod +x scripts/deploy.sh
```

## Deploy updates

Run this from the project directory on the VPS:

```bash
cd /var/www/npyhotpot
./scripts/deploy.sh
```

The script will:

1. Pull the latest code from `origin/master`
2. Install dependencies with `npm install`
3. Build the static site with `npm run build`
4. Validate the Nginx config
5. Reload Nginx

## Notes

- The script expects the project to live at `/var/www/npyhotpot`.
- The script uses `sudo` for Nginx validation and reload, so your VPS user must have sudo access.
- To temporarily close the public frontend while keeping `/admin` and `/merchant` available:
  1. Deploy the latest build so `out/site-closed.html` exists.
  2. Copy the example Nginx config from `deploy/nginx/public-access-gate.conf.example`.
  3. Replace `PREVIEW_SECRET` with your own private preview suffix.
  4. Reload Nginx.
- The private preview entry will look like:

```text
https://npyhotpot.com/preview-your-secret/
```

- Visiting that preview URL sets a temporary preview cookie and redirects to `/`, letting the same browser access the real frontend.
- To re-open the public site later, restore the normal frontend `location /` rule and reload Nginx.
- If you change the deployment branch later, run:

```bash
BRANCH=main ./scripts/deploy.sh
```

- If you change the remote name later, run:

```bash
REMOTE=origin ./scripts/deploy.sh
```
