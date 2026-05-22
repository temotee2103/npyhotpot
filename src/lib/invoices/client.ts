"use client";

import { pdf } from "@react-pdf/renderer";
import { InvoicePdfDocument, type InvoicePdfData } from "@/lib/invoices/pdf";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateInvoicePdfPayload(data: InvoicePdfData): Promise<{
  pdfBase64: string;
  sha256: string;
  sizeBytes: number;
}> {
  const blob = await pdf(<InvoicePdfDocument data={data} />).toBlob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return {
    pdfBase64: toBase64(bytes),
    sha256: toHex(new Uint8Array(hash)),
    sizeBytes: bytes.byteLength,
  };
}

