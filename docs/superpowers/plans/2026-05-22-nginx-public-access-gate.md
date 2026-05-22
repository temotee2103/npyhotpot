# Nginx Public Access Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Temporarily close public frontend entry with a branded static page while keeping `/admin` and `/merchant` available and exposing the real frontend through a private preview prefix.

**Architecture:** Remove the incompatible application-layer gate attempt and keep the site on static export. Add a standalone branded closure page to the exported assets and ship an Nginx config template that routes public frontend traffic to that page while preserving internal paths and a high-entropy preview prefix that still serves the real exported frontend.

**Tech Stack:** Next.js static export, static HTML page, Nginx routing, deployment documentation

---

## File Map

- Delete: `middleware.ts`
  - Remove the incompatible middleware-based gate.
- Delete: `src/lib/public-access-gate.ts`
  - Remove the app-layer helper that depends on runtime request handling.
- Delete: `src/components/root-shell.tsx`
  - Remove the access-page-only UI wrapper introduced for the discarded app-layer gate.
- Delete: `src/app/access/page.tsx`
  - Remove the discarded runtime access page.
- Delete: `src/app/access/verify/route.ts`
  - Remove the discarded runtime verification route.
- Modify: `src/app/layout.tsx`
  - Restore the original global layout after removing `RootShell`.
- Modify: `docs/vps-deploy.md`
  - Replace the app-layer gate notes with Nginx-based closure instructions.
- Create: `public/site-closed.html`
  - Branded temporary closure page served directly by Nginx.
- Create: `deploy/nginx/public-access-gate.conf.example`
  - Nginx snippet/template showing how to route public frontend traffic to `site-closed.html` and how to preserve preview/internal paths.

### Task 1: Remove the discarded application-layer gate

**Files:**
- Delete: `middleware.ts`
- Delete: `src/lib/public-access-gate.ts`
- Delete: `src/components/root-shell.tsx`
- Delete: `src/app/access/page.tsx`
- Delete: `src/app/access/verify/route.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Restore `src/app/layout.tsx` to its original structure**

```tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { LanguageProvider } from "@/components/language-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { assetPath, siteConfig } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/seo";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.languageTag} className="dark">
      <body className={`${body.variable} bg-background-dark font-sans antialiased text-slate-100`}>
        <LanguageProvider>
          {children}
          <MobileBottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Delete the discarded runtime gate files**

Delete:
- `middleware.ts`
- `src/lib/public-access-gate.ts`
- `src/components/root-shell.tsx`
- `src/app/access/page.tsx`
- `src/app/access/verify/route.ts`

- [ ] **Step 3: Run diagnostics on `src/app/layout.tsx`**

Run: check diagnostics for `src/app/layout.tsx`  
Expected: no TypeScript errors

### Task 2: Add the branded closure page

**Files:**
- Create: `public/site-closed.html`

- [ ] **Step 1: Create a standalone branded closure page**

```html
<!doctype html>
<html lang="zh-CN" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nan Peng You Hotpot | 网站暂未开放</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0709;
        --card: rgba(24, 16, 19, 0.92);
        --text: #f6ecdf;
        --muted: #d0c3b0;
        --primary: #b91c1c;
        --border: rgba(185, 28, 28, 0.22);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(117, 2, 15, 0.22), transparent 32%),
          radial-gradient(circle at bottom, rgba(201, 175, 147, 0.06), transparent 28%),
          linear-gradient(180deg, #170d10 0%, var(--bg) 100%);
      }
      .card {
        width: 100%;
        max-width: 560px;
        border: 1px solid var(--border);
        border-radius: 28px;
        padding: 32px;
        background: var(--card);
        box-shadow: 0 30px 80px -36px rgba(0, 0, 0, 0.75);
      }
      .eyebrow {
        margin: 0;
        color: #eaa7a7;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 0;
        font-size: 36px;
        line-height: 1.15;
      }
      p {
        margin: 16px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .hint {
        margin-top: 24px;
        padding-top: 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">Nan Peng You Hotpot</p>
      <h1>网站暂未开放</h1>
      <p>我们正在进行最后确认与内容整理，公开入口会在准备完成后正式开放。</p>
      <p>如果你是内部成员或测试人员，请使用专属预览链接访问当前版本。</p>
      <p class="hint">Public opening is temporarily disabled. Please check back soon.</p>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Confirm the closure page will be exported as a static asset**

Run: verify `public/site-closed.html` exists in the repo  
Expected: file available for direct Nginx serving without Next runtime changes

### Task 3: Add the Nginx configuration template

**Files:**
- Create: `deploy/nginx/public-access-gate.conf.example`

- [ ] **Step 1: Create an example Nginx config snippet**

```nginx
# Replace PREVIEW_SECRET with your real high-entropy preview prefix suffix.
# Example preview path: /preview-4f8k2m9x7q/

location /admin/ {
    try_files $uri $uri/ /admin/index.html;
}

location /merchant/ {
    try_files $uri $uri/ /merchant/index.html;
}

location /preview-PREVIEW_SECRET/ {
    alias /var/www/npyhotpot/out/;
    try_files $uri $uri/ /index.html;
}

location = /site-closed.html {
    root /var/www/npyhotpot/out;
}

location / {
    try_files /site-closed.html =404;
}
```

- [ ] **Step 2: Add inline notes explaining how to switch back to public launch**

Add comments that tell the operator to replace the final public `location /` block with the normal exported-frontend rule:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Task 4: Update deployment documentation and verify build impact

**Files:**
- Modify: `docs/vps-deploy.md`

- [ ] **Step 1: Replace the discarded app-layer gate notes with Nginx instructions**

Add a new section similar to:

```md
## Temporary Public Closure

To temporarily close the public frontend while keeping `/admin` and `/merchant` available:

1. Build and deploy the latest static export so `site-closed.html` is present in `out/`.
2. Apply the example Nginx gate config from `deploy/nginx/public-access-gate.conf.example`.
3. Replace `PREVIEW_SECRET` with your own private preview suffix.
4. Reload Nginx.

The preview link will look like:

```text
https://npyhotpot.com/preview-your-secret/
```

To re-open the public site, restore the normal frontend `location /` rule and reload Nginx.
```

- [ ] **Step 2: Run a full build**

Run:

```bash
npm run build
```

Expected:
- build passes
- no middleware/access-route errors remain
- `public/site-closed.html` is copied into the export output

- [ ] **Step 3: Manual verification checklist**

Verify after deployment:
- public `/` shows the closure page
- `/shop` and `/delivery` show the closure page
- `/admin/login` remains accessible
- `/merchant/rewards/scan` remains accessible
- `/preview-your-secret/` shows the real frontend
- restoring the standard `location /` rule re-opens the public site
