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
- If you change the deployment branch later, run:

```bash
BRANCH=main ./scripts/deploy.sh
```

- If you change the remote name later, run:

```bash
REMOTE=origin ./scripts/deploy.sh
```
