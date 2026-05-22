#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-master}"

echo "==> Deploying from ${REMOTE}/${BRANCH}"
cd "$PROJECT_DIR"

echo "==> Current directory: $PROJECT_DIR"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "==> Installing dependencies"
npm install

echo "==> Building static site"
npm run build

echo "==> Validating nginx config"
sudo nginx -t

echo "==> Reloading nginx"
sudo systemctl reload nginx

echo "==> Deployment complete"
