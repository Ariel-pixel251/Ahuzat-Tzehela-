import { expect, test } from "vitest";
import { toCsv } from "@/lib/csv";

test("CSV quotes, keeps Hebrew (BOM) and neutralises formulas", () => {
  const csv = toCsv(["name", "note"], [["רבקה", 'says "hi", ok'], ["=HYPERLINK(1)", ["a", "b"]]]);
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv).toContain('רבקה,"says ""hi"", ok"');
  expect(csv).toContain("'=HYPERLINK(1),a; b");
});
