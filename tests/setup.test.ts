import { describe, expect, test } from "vitest";
import { describeDbError, isConnectionProblem } from "@/lib/db/errors";
import { DbNotConfiguredError } from "@/lib/db/types";
import { cleanEnvValue, parseEmailList } from "@/lib/env";
import { adminEmailReason } from "@/lib/setup-status";

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
  expect(adminEmailReason("something odd")).toMatch(/Vercel → Logs/);
});
