/** Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX). Throws Error('invalid_phone'). */
export function normalizePhone(input: string): string {
  let digits = input.replace(/[\s\-()+]/g, '');
  if (!/^\d+$/.test(digits)) throw new Error('invalid_phone');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) throw new Error('invalid_phone');
  return `+91${digits}`;
}
