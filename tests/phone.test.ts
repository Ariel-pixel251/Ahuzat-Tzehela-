import { describe, expect, test } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";

describe("Israeli phone normalisation", () => {
  test.each([
    ["0501234567", "0501234567"],
    ["050-123-4567", "0501234567"],
    ["050 123 4567", "0501234567"],
    ["(050) 1234567", "0501234567"],
    ["+972 50-123-4567", "0501234567"],
    ["+972-050-1234567", "0501234567"],
    ["972501234567", "0501234567"],
    ["00972501234567", "0501234567"],
    ["501234567", "0501234567"],
    ["03-1234567", "031234567"],
    ["02 123 4567", "021234567"],
    ["077-1234567", "0771234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, value: expected });
  });

  test("friendly failure reasons", () => {
    expect(normalizePhone("")).toEqual({ ok: false, reason: "empty" });
    expect(normalizePhone("050-123-456")).toEqual({ ok: false, reason: "short" });
    expect(normalizePhone("050-123-45678")).toEqual({ ok: false, reason: "long" });
    expect(normalizePhone("03-123456")).toEqual({ ok: false, reason: "short" });
    expect(normalizePhone("phone me")).toEqual({ ok: false, reason: "invalid" });
    expect(normalizePhone("+44 20 7946 0958")).toEqual({ ok: false, reason: "invalid" });
  });

  test("international numbers are accepted for students", () => {
    expect(normalizePhone("+44 20 7946 0958", { international: true })).toEqual({ ok: true, value: "+442079460958" });
    expect(normalizePhone("+972 50 123 4567", { international: true })).toEqual({ ok: true, value: "0501234567" });
  });

  test("formatting for display", () => {
    expect(formatPhone("0501234567")).toBe("050-123-4567");
    expect(formatPhone("031234567")).toBe("03-123-4567");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});
