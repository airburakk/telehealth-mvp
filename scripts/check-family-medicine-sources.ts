import "dotenv/config";
import { FAMILY_MEDICINE_MONITORED_SOURCES, observeFamilyMedicineSource } from "../src/lib/family-medicine-refresh";

async function main() {
  if (process.argv.includes("--write-dev")) {
    // No production mode. Require both known targets and distinct hosts before any DB write.
    const host = (value: string | undefined) => value ? new URL(value).hostname.replace("-pooler", "") : null;
    const dev = host(process.env.DATABASE_URL), prod = host(process.env.PROD_DATABASE_URL);
    if (!dev || !prod || dev === prod) throw new Error("A distinct confirmed DEV database is required; refusing writes.");
    const { refreshFamilyMedicineSources, listFamilyMedicineSourceChecks } = await import("../src/lib/family-medicine-refresh-store");
    const { db } = await import("../src/lib/db");
    try {
      const result = await refreshFamilyMedicineSources();
      const state = await listFamilyMedicineSourceChecks();
      console.log(JSON.stringify({ mode: "DEV", result, sources: state.sources.map(s => ({ url: s.url, status: s.status, httpStatus: s.httpStatus, errorTag: s.errorTag, checkedAt: s.checkedAt, stale: s.stale })) }, null, 2));
    } finally { await db.$disconnect(); }
  } else {
    // Default: external read-only observation, with no database access or stored baseline.
    for (const source of FAMILY_MEDICINE_MONITORED_SOURCES) {
      const observed = await observeFamilyMedicineSource(source.sourceKey);
      console.log(JSON.stringify({ url: source.url, httpStatus: observed.httpStatus, errorTag: observed.errorTag, hashAvailable: !!observed.contentHash }));
    }
  }
}
main().catch(() => { console.error("Source check failed; inspect DEV configuration and source connectivity."); process.exitCode = 1; });