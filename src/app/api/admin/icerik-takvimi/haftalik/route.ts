import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reqMeta } from "@/lib/audit";
import { PlanError } from "@/lib/social-calendar/plan";
import { prepareWeeklyPackage, approveWeeklyPackage, revokeWeeklyPackage, reconcileWeeklyDelivery } from "@/lib/social-calendar/weekly-store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(req: Request) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Geçersiz kaynak." }, { status: 403 });
  const text = await req.text();
  if (text.length > 262144) return NextResponse.json({ error: "Paket çok büyük." }, { status: 413 });
  let b: Record<string, unknown>;
  try { b = JSON.parse(text); if (!b || Array.isArray(b) || typeof b !== "object") throw new Error(); }
  catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }); }
  const str = (v: unknown) => typeof v === "string" ? v : "";
  const ctx = { actor, ...reqMeta(req) };
  try {
    switch (b.action) {
      case "prepare": return NextResponse.json({ ok: true, package: await prepareWeeklyPackage({ manifest: b.manifest, ...ctx }) });
      case "approve": return NextResponse.json({ ok: true, package: await approveWeeklyPackage({ id: str(b.id), version: str(b.version), hash: str(b.hash), confirmed: b.confirmed === true, ...ctx }) });
      case "revoke": return NextResponse.json({ ok: true, package: await revokeWeeklyPackage({ id: str(b.id), version: str(b.version), ...ctx }) });
      case "reconcile": {
        if (b.outcome !== "FOUND" && b.outcome !== "NOT_FOUND" && b.outcome !== "NO_REMOTE_JOB") throw new PlanError("Platform kontrolü sonucu gerekli.");
        return NextResponse.json({ ok: true, ...(await reconcileWeeklyDelivery({ id: str(b.id), version: str(b.version), outcome: b.outcome, evidence: str(b.evidence), platformId: str(b.platformId), publishedUrl: str(b.publishedUrl), publishedAt: str(b.publishedAt), providerQueueId: str(b.providerQueueId), allRemoteJobsChecked: b.allRemoteJobsChecked === true, ...ctx })) });
      }
      default: throw new PlanError("Bilinmeyen işlem.");
    }
  } catch (e) {
    if (e instanceof PlanError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Haftalık paket işlemi tamamlanamadı." }, { status: 500 });
  }
}
