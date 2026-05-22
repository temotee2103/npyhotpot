export function isValidAddress(value: string): boolean {
  const length = value.trim().length;
  return length >= 10 && length <= 200;
}

