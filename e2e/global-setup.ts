import { rm } from "node:fs/promises";

/** Each run starts from an empty local database. */
export default async function globalSetup() {
  await rm(".data/e2e", { recursive: true, force: true });
}
