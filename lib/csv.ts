/** CSV with a BOM so Excel opens Hebrew correctly; formula-like cells are neutralised. */
export function toCsv(head: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : v instanceof Date ? v.toISOString() : String(v);
    // stop spreadsheet formula injection (=, +, -, @ at the start)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
