import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reqMeta } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  PlanError,
  PlanGateError,
  approve,
  computeCandidates,
  openSlot,
  pickSource,
  previewPlan,
  restore,
  saveDraft,
  skip,
  unapprove,
} from "@/lib/social-calendar/plan";

// İçerik takvimi eylemleri (v6.328, 2026-10-06) — /admin/icerik-takvimi: yuva aç · aday üret · kaynak seç · taslak kaydet · onayla ·
// onayı kaldır · atla · geri al · PNG önizleme. Tek uç, `action` alanı (admin/hukuki-ceviri deseni).
// Self-auth: yalnız ADMIN (proxy /admin'i korur ama /api'yi KORUMAZ — her uç kendi kapısı).
// Durum kodları: 401 yetkisiz · 400 geçersiz istek · 404 yuva yok · 409 geçiş yasak/sürüm çakışması · 422 onay kapıları geçilmedi (gövdede `report`)
// · 429 önizleme sınırı · 503/502/504 önizleme servisi. Yazma işlemleri `version` (= updatedAt ISO) ister — iyimser eşzamanlılık (lib/social-calendar/plan).
// maxDuration: önizleme PNG çizimi (7 slayt, kart servisi ~10-25 sn) + aday seçimi (150 karar ayrıştırma).
export const maxDuration = 120;

const PREVIEW_LIMIT = 30; // pencere 10 dk — çağrı yerinde AÇIK yazılır (tests/unit/rate-limit.test.ts: pencere argümanı ms-biçimli literal olmalı)

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = str(b.action);
  const meta = reqMeta(req);
  const actor = { actor: user, ...meta };
  const id = str(b.id);
  const version = str(b.version);

  try {
    switch (action) {
      case "open": {
        const item = await openSlot({ seriesKey: str(b.seriesKey), slotDay: str(b.slotDay) });
        return NextResponse.json({ ok: true, item });
      }
      case "candidates": {
        const { view, stats } = await computeCandidates({ id });
        return NextResponse.json({ ok: true, item: view, stats });
      }
      case "pick":
        return NextResponse.json({ ok: true, item: await pickSource({ id, articleId: str(b.articleId), expectedVersion: version, ...actor }) });
      case "save": {
        const item = await saveDraft({
          id,
          expectedVersion: version,
          ...(b.payload !== undefined ? { payload: b.payload } : {}),
          ...(typeof b.editorNote === "string" ? { editorNote: b.editorNote } : {}),
          ...(typeof b.attestIdentity === "boolean" ? { attestIdentity: b.attestIdentity } : {}),
          ...actor,
        });
        return NextResponse.json({ ok: true, item });
      }
      case "approve":
        return NextResponse.json({ ok: true, item: await approve({ id, expectedVersion: version, ...actor }) });
      case "unapprove":
        return NextResponse.json({ ok: true, item: await unapprove({ id, expectedVersion: version, ...actor }) });
      case "skip":
        return NextResponse.json({ ok: true, item: await skip({ id, expectedVersion: version, ...actor }) });
      case "restore":
        return NextResponse.json({ ok: true, item: await restore({ id, expectedVersion: version, ...actor }) });
      case "preview": {
        const rl = await rateLimit(`icerik-takvimi-preview:${user.id}`, PREVIEW_LIMIT, 10 * 60_000);
        if (!rl.ok) {
          return NextResponse.json({ error: "Çok sık önizleme istendi — kısa bir süre sonra deneyin." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
        }
        const r = await previewPlan({
          id,
          ...(b.payload !== undefined ? { payload: b.payload } : {}),
          ...(typeof b.editorNote === "string" ? { editorNote: b.editorNote } : {}),
        });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        return NextResponse.json({ ok: true, slides: r.slides });
      }
      default:
        return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof PlanGateError) return NextResponse.json({ error: e.message, report: e.report }, { status: 422 });
    if (e instanceof PlanError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("icerik-takvimi: beklenmeyen hata", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
  }
}
