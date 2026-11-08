import { NextResponse } from "next/server";
import { cronGate } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { firstErrorTag } from "@/lib/ingest-streak";
import { FAMILY_MEDICINE_REFRESH_RESOURCE } from "@/lib/family-medicine-refresh";
import { refreshFamilyMedicineSources } from "@/lib/family-medicine-refresh-store";

// Daily 03:10 UTC, AURA deployment only (shared DB; the Doctorium deployment is a no-op).
// Independent budget: <=20 curated sources x 12s + 250ms gaps. No user URLs, approvals, or publication.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "refresh-family-medicine");
  if (gate) return gate;
  try {
    const result = await refreshFamilyMedicineSources();
    await recordAccess({
      actor: null, action: "CRON_MAINTENANCE", resourceType: "SYSTEM", resourceId: FAMILY_MEDICINE_REFRESH_RESOURCE, subjectUserId: null,
      detail: `sources=${result.checked} baseline=${result.baseline} current=${result.current} changed=${result.changed} unreachable=${result.unreachable}${firstErrorTag(result.errors)}`,
    });
    if (result.changedSources.length) await sendAlert("family-medicine-source-changed", "Aile hekimliği kaynak değişikliği: editör incelemesi gerekli", result.changedSources.join(" | ").slice(0, 400));
    if (result.failureAlerts.length) await sendAlert("family-medicine-source-unreachable", "Aile hekimliği kaynaklarına art arda erişilemiyor", result.failureAlerts.join(" | ").slice(0, 400));
    // A completed partial scan is visible, never disguised as every source being up-to-date.
    return NextResponse.json({ ok: result.unreachable === 0, ...result, clinicalValidation: false });
  } catch {
    // An unavailable audit store must not suppress the independent alert or the500 response.
    await Promise.allSettled([
      recordAccess({ actor: null, action: "CRON_MAINTENANCE", resourceType: "SYSTEM", resourceId: FAMILY_MEDICINE_REFRESH_RESOURCE, subjectUserId: null, detail: "failed=source-refresh-or-storage" }),
      sendAlert("cron-refresh-family-medicine", "Aile hekimliği kaynak kontrolü tamamlanamadı", "source-refresh-or-storage; kaynak kontrolü ve veritabanı şemasını inceleyin"),
    ]);
    return NextResponse.json({ error: "Kaynak kontrolü tamamlanamadı.", clinicalValidation: false }, { status: 500 });
  }
}