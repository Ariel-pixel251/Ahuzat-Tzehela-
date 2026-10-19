/**
 * Turns a database connection/query error into a plain explanation and a fix, without echoing the
 * error itself (which can contain host names). Used by the setup check page.
 */
export function describeDbError(err: unknown): { problem: string; fix: string } {
  const e = err as { code?: string; message?: string } | undefined;
  const code = e?.code ?? "";
  const message = String(e?.message ?? err ?? "");

  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return {
      problem: "The database password in DATABASE_URL is wrong.",
      fix: "Reset the password in Supabase (Project Settings → Database), use letters and numbers only, and paste the link again in Vercel without the [ ] brackets.",
    };
  }
  if (/tenant or user not found/i.test(message)) {
    return {
      problem: "DATABASE_URL points to a Supabase project or user that doesn't exist (often a link from an old or deleted project).",
      fix: "Copy the link again from your current project: Connect → Direct → Method: Transaction pooler.",
    };
  }
  if (code === "ERR_INVALID_URL" || /invalid url|url malformed/i.test(message)) {
    return {
      problem: "DATABASE_URL isn't a valid link.",
      fix: "Check it starts with postgresql:// and has no spaces or [ ] brackets. If the password has symbols like @ # / ? %, reset it to letters and numbers only.",
    };
  }
  if (code === "3D000" || code === "28000" || /(database|role) .* does not exist/i.test(message)) {
    return {
      problem: "DATABASE_URL has the wrong user or database name.",
      fix: "Copy the link again from Supabase → Connect → Direct → Transaction pooler, and only replace [YOUR-PASSWORD].",
    };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || /getaddrinfo/i.test(message)) {
    return {
      problem: "The database address in DATABASE_URL can't be found.",
      fix: "Copy the link again from Supabase → Connect → Direct → Transaction pooler; check for typos.",
    };
  }
  if (["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "CONNECT_TIMEOUT"].includes(code) || /timeout|timed out/i.test(message)) {
    return {
      problem: "The database didn't answer (it may be paused, or the port is wrong).",
      fix: "In Supabase, check the project isn't paused. Use the Transaction pooler link (port 6543).",
    };
  }
  if (code === "42P01" || code === "42883" || /(relation|function) .* does not exist/i.test(message)) {
    return {
      problem: "The database is connected but the tables or functions are missing.",
      fix: "In Supabase → SQL Editor, run supabase/migrations/0001_init.sql, then supabase/seed.sql.",
    };
  }
  return {
    problem: `The database returned an error${code ? ` (code ${code})` : ""}.`,
    fix: "Open Vercel → Logs and look for the red line with this time; send it to whoever maintains the site.",
  };
}

/** True when the database can't be reached at all (not set up, unreachable, or refusing the login). */
export function isConnectionProblem(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string } | undefined;
  if (e?.name === "DbNotConfiguredError" || e?.message === "DATABASE_URL is not set") return true;
  const code = e?.code ?? "";
  return (
    [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNRESET",
      "ERR_INVALID_URL",
      // postgres.js
      "CONNECT_TIMEOUT",
      "CONNECTION_CLOSED",
      "CONNECTION_DESTROYED",
      "CONNECTION_ENDED",
      // too many connections
      "53300",
    ].includes(code) ||
    /^(08|28|57P0)/.test(code) ||
    /tenant or user not found|invalid url|max client connections|too many (clients|connections)/i.test(String(e?.message ?? ""))
  );
}
