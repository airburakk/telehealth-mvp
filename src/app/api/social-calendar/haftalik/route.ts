import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reqMeta } from "@/lib/audit";
import { PlanError } from "@/lib/social-calendar/plan";
import { prepareWeeklyPackage, getWeeklyPackage, claimWeeklyDelivery, completeWeeklyDelivery } from "@/lib/social-calendar/weekly-store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
/** Dormant worker surface. Reuses the existing kart-held token; never approves packages. */
export async function POST(req: Request) {
  const secret = process.env.CONTENT_PLAN_TOKEN;
  if (!secret) return NextResponse.json({ error: "İçerik planı bağlantısı devre dışı." }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : ""), expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const text = await req.text();
  if (text.length > 262144) return NextResponse.json({ error: "İstek çok büyük." }, { status: 413 });
  let b: Record<string, unknown>;
  try { b = JSON.parse(text); if (!b || Array.isArray(b) || typeof b !== "object") throw new Error(); }
  catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }); }
  const str = (s: unknown) => typeof s === "string" ? s : "";
  try {
    if (b.action === "prepare") {
      const p = await prepareWeeklyPackage({ manifest: b.manifest, actor: null, ...reqMeta(req) });
      return NextResponse.json({ ok: true, package: { id: p.id, status: p.status, hash: p.manifestHash } });
    }
    if (b.action === "inspect") {
      const p = await getWeeklyPackage(str(b.week));
      if (!p || p.status !== "APPROVED") return NextResponse.json({ ok: true, package: null });
      return NextResponse.json({ ok: true, package: { id: p.id, hash: p.manifestHash, manifest: p.manifest, deliveries: p.deliveries.map(d => ({ id: d.id, itemId: d.itemId, channel: d.channel, accountId: d.accountId, state: d.effectiveState, scheduledAt: d.scheduledAt })) } });
    }
    if (b.action === "claim") {
      // Activation is a separate reviewed operation after the actual n8n workflow is mapped.
      if (process.env.WEEKLY_PUBLISH_ENABLED !== "true") return NextResponse.json({ error: "Haftalık yayın bağlantısı etkinleştirilmedi." }, { status: 503 });
      if (!b.assetHashes || typeof b.assetHashes !== "object" || Array.isArray(b.assetHashes) || Object.values(b.assetHashes).some(h => typeof h !== "string")) throw new PlanError("İndirilen dosya hash'leri gerekli.");
      return NextResponse.json({ ok: true, ...(await claimWeeklyDelivery({ id: str(b.id), hash: str(b.hash), accountId: str(b.accountId), assetHashes: b.assetHashes as Record<string, string> })) });
    }
    if (b.action === "result") {
      if (!["SUCCEEDED", "FAILED", "UNKNOWN"].includes(str(b.result))) throw new PlanError("Kanal sonucu geçersiz.");
      return NextResponse.json({ ok: true, ...(await completeWeeklyDelivery({ id: str(b.id), claimToken: str(b.claimToken), result: b.result as "SUCCEEDED" | "FAILED" | "UNKNOWN", platformId: str(b.platformId), noRequestSent: b.noRequestSent === true })) });
    }
    throw new PlanError("Bilinmeyen işlem.");
  } catch (e) {
    if (e instanceof PlanError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Haftalık yayın işlemi tamamlanamadı." }, { status: 500 });
  }
}
