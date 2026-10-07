// Usage: node node_modules/tsx/dist/cli.mjs scripts/review-d04-title.ts metadata.json
// Always dry-run: offline metadata input -> stdout plan. No --write capability.
import { readFileSync } from "node:fs";
import { reviewD04Title, type TitleSnapshot } from "./lib/d04-title-review";

const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith("-")) {
  throw new Error("Provide exactly one local metadata JSON file; write/prod flags are unsupported");
}
const raw: unknown = JSON.parse(readFileSync(args[0], "utf8"));
if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Metadata must be one object");
const row = raw as Record<string, unknown>;
for (const key of ["id", "source", "externalId", "title"]) {
  if (typeof row[key] !== "string") throw new Error(`Missing string field: ${key}`);
}
for (const key of ["doi", "titleOriginal"]) {
  if (row[key] !== null && typeof row[key] !== "string") throw new Error(`Missing nullable string field: ${key}`);
}
const metadata: TitleSnapshot = {
  id: row.id as string, source: row.source as string, externalId: row.externalId as string,
  doi: row.doi as string | null, title: row.title as string, titleOriginal: row.titleOriginal as string | null,
};
console.log(JSON.stringify(reviewD04Title(metadata), null, 2));
