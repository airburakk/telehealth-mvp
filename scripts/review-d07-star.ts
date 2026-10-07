// Offline only: a selected STAR metadata JSON export -> stdout dry-run plan.
import { readFileSync } from "node:fs";
import { reviewD07Star, type StarSnapshot } from "./lib/d07-star-review";
const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith("-")) throw new Error("One metadata JSON file required; write/prod flags unsupported");
const raw: unknown = JSON.parse(readFileSync(args[0], "utf8"));
if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Expected one metadata object");
const data = raw as Record<string, unknown>;
const snapshot: Record<string, string | null> = {};
for (const key of ["id", "kind", "title", "organizer", "eligibility", "sourceUrl", "verifiedAt", "updatedAt"]) {
  if (typeof data[key] !== "string") throw new Error(`Missing string: ${key}`);
  snapshot[key] = data[key] as string;
}
for (const key of ["deadline", "deadlineNote", "startsAt", "approvedAt"]) {
  if (data[key] !== null && typeof data[key] !== "string") throw new Error(`Missing nullable string: ${key}`);
  snapshot[key] = data[key] as string | null;
}
console.log(JSON.stringify(reviewD07Star(snapshot as unknown as StarSnapshot), null, 2));
