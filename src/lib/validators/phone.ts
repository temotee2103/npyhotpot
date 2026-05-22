export function normalizePhoneToE164(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("60")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+60${cleaned.slice(1)}`;
  return `+${cleaned}`;
}

export function isValidE164Phone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

