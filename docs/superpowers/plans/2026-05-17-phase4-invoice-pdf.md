# Phase 4 Plan (Persisted Invoice PDF)

## 1) Migrations (DB + Storage)

- Add `public.official_invoice_counters`
- Add `public.official_invoices`
- Add `public.official_invoice_items`
- Add RLS policies:
  - select: owner/admin
  - write: admin only (edge function uses service role)
- Create helper functions:
  - `public.official_next_invoice_no() returns text`
  - `public.official_create_invoice_for_order(p_order_id uuid, p_created_by uuid, p_pdf_bucket text, p_pdf_path text, p_pdf_sha256 text, p_pdf_size_bytes integer) returns uuid`
- Create Storage bucket:
  - `documents` (private)

## 2) Edge Functions

- Add `supabase/functions/invoice-generate/index.ts`
  - CORS allowlist using shared helper
  - Auth guard
  - Owner/admin authorization:
    - owner via `official_orders.user_id`
    - admin via `public.official_is_admin()`
  - Decode base64 → bytes
  - Upload to `documents` bucket at `invoices/{order_id}/{invoice_no}.pdf`
  - Insert invoice + invoice_items snapshot

- Add `supabase/functions/invoice-signed-url/index.ts`
  - Auth guard
  - Owner/admin authorization
  - Create signed URL for the stored PDF and return it

## 3) Frontend (Admin invoice page)

- Install `@react-pdf/renderer` dependency and create:
  - `src/lib/invoices/pdf.tsx` (PDF Document component)
  - `src/lib/invoices/client.ts` (generate Blob + base64 helpers)
- Update admin invoice page:
  - Add “生成并保存PDF” (generate and save)
  - Add “下载已保存PDF” (download saved)
  - Fallback to existing print behavior if generation fails

## 4) Minimal Manual Test Checklist

- Create a paid order (shop and delivery).
- Admin invoice page:
  - Generate & save → success toast and invoice_no shown
  - Download saved → gets a signed URL and downloads PDF
- Permission checks:
  - Non-owner, non-admin cannot generate/download another user’s invoice
- Storage:
  - No public URL; access is via signed URL only

