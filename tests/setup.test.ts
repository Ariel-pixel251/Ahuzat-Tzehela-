import { describe, expect, test } from "vitest";
import { describeDbError, isConnectionProblem } from "@/lib/db/errors";
import { DbNotConfiguredError } from "@/lib/db/types";
import { cleanEnvValue, parseEmailList, studentEmailAllowed } from "@/lib/env";
import { adminEmailReason } from "@/lib/setup-status";
import { formatHours, parseTimeRange, TIMES } from "@/config/options";
import { v } from "@/lib/validation";

describe("settings pasted into Vercel", () => {
  test.each([
    ["  postgresql://x  ", "postgresql://x"],
    ["postgresql://x\n", "postgresql://x"],
    ['"postgresql://x"', "postgresql://x"],
    ["'abc' ", "abc"],
    ["   ", undefined],
    [undefined, undefined],
  ])("%j → %j", (raw, expected) => {
    expect(cleanEnvValue(raw)).toBe(expected);
  });

  test("admin email lists are read however they're typed", () => {
    expect(parseEmailList("A@x.com, b@y.com")).toEqual(["a@x.com", "b@y.com"]);
    expect(parseEmailList("a@x.com\nb@y.com;c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(parseEmailList('Ariel Niv <ariel@x.com>, "lea@y.com"')).toEqual(["ariel@x.com", "lea@y.com"]);
    expect(parseEmailList("not an email")).toEqual([]);
    expect(parseEmailList(undefined)).toEqual([]);
  });
});

test("student sign-in can be limited to school email domains", () => {
  expect(studentEmailAllowed("dana@gmail.com", [])).toBe(true);
  expect(studentEmailAllowed("dana@emis.org.il", ["emis.org.il"])).toBe(true);
  expect(studentEmailAllowed("dana@students.emis.org.il", ["emis.org.il"])).toBe(true);
  expect(studentEmailAllowed("dana@gmail.com", ["emis.org.il"])).toBe(false);
  expect(studentEmailAllowed("dana@notemis.org.il", ["emis.org.il"])).toBe(false);
});

describe("database problems explained", () => {
  test.each([
    [{ code: "28P01", message: "password authentication failed for user" }, /password/],
    [{ code: "XX000", message: "Tenant or user not found" }, /doesn't exist/],
    [{ code: "ERR_INVALID_URL", message: "Invalid URL" }, /valid link/],
    [{ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" }, /can't be found/],
    [{ code: "3D000", message: 'database "postgress" does not exist' }, /wrong user or database name/],
    [{ code: "42883", message: "function hit_rate_limit(text) does not exist" }, /tables or functions are missing/],
    [{ code: "42P01", message: 'relation "settings" does not exist' }, /tables or functions are missing/],
  ])("%j", (err, problem) => {
    expect(describeDbError(err).problem).toMatch(problem);
  });

  test("connection problems are told apart from other errors", () => {
    expect(isConnectionProblem(new DbNotConfiguredError())).toBe(true);
    expect(isConnectionProblem({ code: "28P01" })).toBe(true);
    expect(isConnectionProblem({ code: "ECONNREFUSED" })).toBe(true);
    expect(isConnectionProblem({ code: "XX000", message: "Tenant or user not found" })).toBe(true);
    expect(isConnectionProblem({ code: "42883", message: "function does not exist" })).toBe(false);
    expect(isConnectionProblem(new Error("boom"))).toBe(false);
  });
});

test("admin sign-in email failures get a plain reason", () => {
  expect(adminEmailReason("email rate limit exceeded")).toMatch(/limit/);
  expect(adminEmailReason("Email address not authorized")).toMatch(/members of your Supabase organisation/);
  expect(adminEmailReason("Signups not allowed for otp")).toMatch(/sign-ups are disabled/);
  expect(adminEmailReason("something odd")).toMatch(/see the error/);
});

test("times are a from–until range or 'arrange by message'; old morning/afternoon choices still read", () => {
  expect(TIMES[0]).toBe("08:00");
  expect(TIMES[1]).toBe("08:30");
  expect(TIMES.at(-1)).toBe("20:00");
  expect(parseTimeRange("10:00-12:30")).toEqual({ from: "10:00", until: "12:30" });
  expect(parseTimeRange("12:00-10:00")).toBeNull();
  expect(parseTimeRange("07:00-09:00")).toBeNull();
  expect(parseTimeRange("10:15-11:00")).toBeNull();
  expect(formatHours(["10:00-12:30"], "en")).toBe("10:00–12:30");
  expect(formatHours(["contact"], "he")).toBe("נתאם שעה בהודעה");
  expect(formatHours(["contact"], "en")).toBe("Arrange the time by message");
  expect(formatHours([], "en")).toBe("");
  expect(formatHours(["morning"], "he")).toBe("בוקר");

  const parse = (hours?: string) => v.timeChoice.safeParse(hours);
  expect(parse("19:30-20:00").data).toEqual(["19:30-20:00"]);
  expect(parse("contact").data).toEqual(["contact"]);
  expect(parse("").data).toEqual([]);
  expect(parse(undefined).data).toEqual([]);
  expect(parse("20:00-21:00").success).toBe(false);
  expect(parse("anything").success).toBe(false);
});
