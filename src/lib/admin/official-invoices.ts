import { supabase } from "@/lib/supabase";

export type OfficialInvoiceRow = {
  id: string;
  order_id: string;
  invoice_no: string;
  pdf_bucket: string;
  pdf_path: string;
  created_at: string;
};

export async function fetchOfficialInvoiceByOrderId(orderId: string): Promise<OfficialInvoiceRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_invoices")
    .select("id,order_id,invoice_no,pdf_bucket,pdf_path,created_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown) as OfficialInvoiceRow;
}

