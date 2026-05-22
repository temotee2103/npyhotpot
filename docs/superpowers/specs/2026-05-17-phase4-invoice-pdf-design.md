# Phase 4 Design (Persisted Invoice PDF)

## Goals

- Persist immutable invoice records for orders (shop + delivery).
- Generate a real PDF file and store it in Supabase Storage.
- Allow admin and the order owner to fetch a signed download URL for the stored PDF.
- Make invoice numbering human-friendly and unique (sequential per year).

## Non-Goals

- Refunds / credit notes (separate Phase 4B).
- Email sending (receipt/invoice email).
- Tax invoice compliance across multiple jurisdictions (we only add a minimal company block and optional tax fields later if needed).

## A) Data Model

### A1. Tables

Create:

- `public.official_invoices`
  - `id uuid primary key default gen_random_uuid()`
  - `order_id uuid not null references public.official_orders(id) on delete cascade`
  - `invoice_no text not null unique`
  - `currency text not null`
  - `subtotal numeric(10,2) not null`
  - `shipping_fee numeric(10,2) not null`
  - `discount_total numeric(10,2) not null`
  - `total numeric(10,2) not null`
  - `pdf_bucket text not null`
  - `pdf_path text not null`
  - `pdf_sha256 text`
  - `pdf_size_bytes integer`
  - `created_by uuid`
  - `created_at timestamptz not null default now()`

- `public.official_invoice_items`
  - Snapshot line items at generation time (so future product edits do not change invoices)
  - `invoice_id uuid not null references public.official_invoices(id) on delete cascade`
  - `title text not null`
  - `quantity integer not null`
  - `unit_price numeric(10,2) not null`
  - `line_total numeric(10,2) not null`

Additionally:

- `public.official_invoice_counters`
  - `year integer primary key`
  - `last_number integer not null default 0`

### A2. Invoice numbering

Generate invoice numbers as:

- `INV-{YYYY}-{NNNNNN}`

Design:

- Use a Postgres function that increments `official_invoice_counters` atomically (UPSERT + RETURNING).
- Enforce uniqueness with `official_invoices.invoice_no unique`.

## B) Storage

### B1. Bucket

Create a dedicated private bucket:

- Bucket: `documents`
- Folder convention: `invoices/{order_id}/{invoice_no}.pdf`

Rationale:

- The current `media` bucket is public and is used for images and uploads.
- Invoices should not be public URLs; access should go through signed URLs.

## C) Access Control

### C1. Database (RLS)

- Enable RLS on `official_invoices` and `official_invoice_items`.
- Allow select for:
  - order owner (via `official_orders.user_id`)
  - admin (via `public.official_is_admin()`)
- Keep inserts/updates restricted to admin/service-role generation flow (edge function uses service-role key).

### C2. Storage access

- Do not expose public URLs.
- Provide an edge function to create a signed URL after verifying user is owner/admin.

## D) PDF Generation Flow

### D1. Generation approach

- Generate PDF in the browser using `@react-pdf/renderer` (client-side).
- Upload PDF bytes to an edge function that stores the file with service-role and writes invoice rows.

Rationale:

- Project is Next.js static export; there is no server runtime for HTML→PDF.
- Supabase Edge Functions (Deno) do not ship with headless Chrome; server-side rendering to PDF is non-trivial.

### D2. Edge functions

Add:

- `invoice-generate`
  - Input: `{ officialOrderId, channel, pdfBase64, sha256?, sizeBytes? }`
  - Auth: required
  - Checks: owner/admin
  - Actions:
    - Allocate invoice number (DB function)
    - Upload `pdf` into `documents` bucket (path includes invoice_no)
    - Insert `official_invoices` + `official_invoice_items` snapshots
  - Output: `{ invoiceId, invoiceNo, pdfPath }`

- `invoice-signed-url`
  - Input: `{ invoiceId }` (or `{ orderId }`)
  - Auth: required
  - Checks: owner/admin
  - Output: `{ signedUrl }` with short expiry

## E) Frontend (Admin)

- Update admin invoice page to support:
  - Generate & save invoice PDF (calls `invoice-generate`)
  - Download saved invoice PDF (calls `invoice-signed-url`)
  - Keep the existing print-based “download” as fallback

Acceptance:

- Admin can generate a stored PDF for an order.
- The stored PDF is retrievable via a signed URL.
- Owner can also retrieve their invoice PDF (once we add member UI entrypoint later).

