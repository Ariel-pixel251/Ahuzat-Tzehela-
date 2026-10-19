export type PhoneResult =
  | { ok: true; value: string }
  | { ok: false; reason: "empty" | "short" | "long" | "invalid" };

/**
 * Normalises a phone number typed in any common Israeli format ("050-123 4567", "+972 50 1234567",
 * "0501234567", "501234567", "03-1234567") to local digits ("0501234567").
 * With `international`, other "+country" numbers are kept as "+digits" (for EMIS students).
 */
export function normalizePhone(input: string, { international = false } = {}): PhoneResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (/[^\d\s\-+().]/.test(raw)) return { ok: false, reason: "invalid" };
  const plus = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);

  if (plus || (digits.startsWith("972") && digits.length >= 11)) {
    if (digits.startsWith("972")) digits = "0" + digits.slice(3).replace(/^0/, "");
    else if (international) {
      if (digits.length < 8) return { ok: false, reason: "short" };
      if (digits.length > 15) return { ok: false, reason: "long" };
      return { ok: true, value: `+${digits}` };
    } else return { ok: false, reason: "invalid" };
  }

  // a mobile number typed without its leading 0
  if (!digits.startsWith("0") && /^[57]\d{8}$/.test(digits)) digits = "0" + digits;
  if (!digits.startsWith("0")) return { ok: false, reason: digits.length < 9 ? "short" : "invalid" };

  const expected = /^0[57]/.test(digits) ? 10 : 9;
  if (digits.length < expected) return { ok: false, reason: "short" };
  if (digits.length > expected) return { ok: false, reason: "long" };
  return { ok: true, value: digits };
}

/** "0501234567" → "050-123-4567", "031234567" → "03-123-4567". */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("+")) return value;
  if (value.length === 10) return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length === 9) return `${value.slice(0, 2)}-${value.slice(2, 5)}-${value.slice(5)}`;
  return value;
}
