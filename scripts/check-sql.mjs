// A second guard next to the ESLint rule: no SQL text built with ${…} anywhere in the server code,
// and no dynamic SQL (EXECUTE) in the migrations except the fixed lock-down loops over table names.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

async function* files(dir, ext) {
  for (const entry of await readdir(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if ((await stat(full)).isDirectory()) yield* files(full, ext);
    else if (ext.test(entry)) yield full;
  }
}

let problems = 0;
for (const dir of ["app", "lib"]) {
  for await (const file of files(dir, /\.(ts|tsx)$/)) {
    const text = await readFile(file, "utf8");
    // .query(`…${…}…`) or .unsafe(…) anywhere, including over several lines
    for (const m of text.matchAll(/\.(query|exec|unsafe)\(\s*`([^`]*)`/g)) {
      if (m[2].includes("${")) {
        console.error(`✗ ${file}: SQL text built with \${…}`);
        problems++;
      }
    }
    // the one database adapter: postgres.js's unsafe(text, params) binds the parameters; its
    // callers' text is constant (ESLint rule local/no-sql-interpolation)
    if (/\.unsafe\(/.test(text) && file !== path.join("lib", "db", "postgres.ts")) {
      console.error(`✗ ${file}: sql.unsafe() is not allowed`);
      problems++;
    }
  }
}
for await (const file of files("supabase", /\.sql$/)) {
  if (file.endsWith("reset.sql")) continue; // a one-off script the owner runs by hand
  const text = await readFile(file, "utf8");
  for (const line of text.split("\n")) {
    if (/^\s*execute\b/i.test(line) && !/execute (format\('alter table public\.%I enable row level security'|'revoke |'alter default privileges )/i.test(line)) {
      console.error(`✗ ${file}: dynamic SQL: ${line.trim()}`);
      problems++;
    }
    if (/security definer/i.test(line)) {
      console.error(`✗ ${file}: SECURITY DEFINER function`);
      problems++;
    }
  }
}
if (problems) process.exit(1);
console.log("✓ No SQL built from strings, no dynamic SQL in the migrations.");
