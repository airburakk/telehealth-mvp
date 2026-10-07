import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestYargitay, type YargitayIngestResult } from "@/lib/hukuk-ingest";
import { ingestDoktrin, type DoktrinIngestResult } from "@/lib/doktrin-ingest";
import { ingestTtbEvents, type TtbEventsResult } from "@/lib/ttb-events";
import { db } from "@/lib/db";
import { dryStreak, firstErrorTag, shouldAlertStreak, type IngestSegment } from "@/lib/ingest-streak";

// GET /api/cron/ingest-hukuk — hukuk + etkinlik içerik hattı: Yargıtay içtihat (v6.86) · TR-Dizin
// doktrin (v6.91) · TTB akredite etkinlik taraması (v6.129, HAFTALIK — yalnız Pazartesi).
//
// v6.205 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim"; plan Pro).
// 02:20 UTC = 05:20 TR — ingest-doctorium'dan 20 dk sonra, Post baskısından (06:30 TR) önce biter.
// Üç iş birbirinden BAĞIMSIZ: biri düşerse diğerleri koşar; düşen alarmla görünür, koşu 200 döner
// (kısmi başarı). Yargıtay: koşu başına metin tavanı lib içinde (MAX_DOC_FETCH_DEFAULT), kalan
// ertesi koşuda idempotent alınır. ⚠️ Vercel fra1 → devlet sitesi erişimi GARANTİ DEĞİL (RG dersi):
// sürekli hata görülürse yerel yol hazır → scripts/ingest-yargitay.ts (--prod --yaz).
// TTB: düzenleyiciler etkinlikten ≥30 gün önce başvurur → haftalık tarama yeter; pencere DAR (geçmiş
// 1 ay + gelecek 13 ay); tam/geri dönük tarama CLI işidir. Kaynaklar arası birleştirme
// (merge-congress-sources.ts) BİLİNÇLİ cron'da değil — satır silen araç insan gözetiminde kalır.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-hukuk");
  if (gate) return gate;

  const failures: string[] = [];

  let yargitay: YargitayIngestResult | { error: string };
  try {
    yargitay = await ingestYargitay();
  } catch (e) {
    yargitay = { error: errText(e, "içtihat ingest koşamadı") };
    failures.push(`yargitay: ${yargitay.error}`);
  }

  let doktrin: DoktrinIngestResult | { error: string };
  try {
    doktrin = await ingestDoktrin({ maxPages: 1 }); // yeni yayınlar üstte — yalnız ilk sayfa
  } catch (e) {
    doktrin = { error: errText(e, "doktrin ingest koşamadı") };
    failures.push(`doktrin: ${doktrin.error}`);
  }

  let ttbEvents: TtbEventsResult | { skipped: true } | { error: string };
  if (new Date().getUTCDay() === 1) {
    try {
      const now = new Date();
      ttbEvents = await ingestTtbEvents({
        fromYm: ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
        toYm: ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 13, 1))),
      });
    } catch (e) {
      ttbEvents = { error: errText(e, "TTB taraması koşamadı") };
      failures.push(`ttb: ${ttbEvents.error}`);
    }
  } else {
    ttbEvents = { skipped: true }; // haftalık kontenjan — bugün sırası değil
  }

  // v6.337: `ilk="…"` = ilk hatanın kısa metni (lib/ingest-streak) — eskiden yalnız SAYI yazılıyordu ve
  // içtihat cron'u 11 Ağustos'tan beri `sorun=1` ile kuruduğu hâlde nedeni hiçbir yerde görünmüyordu.
  const ict = "error" in yargitay
    ? `hata: ${yargitay.error}`
    : `yeni=${yargitay.created}/${yargitay.found}${yargitay.deferred ? ` erteli=${yargitay.deferred}` : ""}${yargitay.errors.length ? ` sorun=${yargitay.errors.length}${firstErrorTag(yargitay.errors)}` : ""}`;
  const dok = "error" in doktrin
    ? `hata: ${doktrin.error}`
    : `yeni=${doktrin.created}/${doktrin.found}${doktrin.errors.length ? ` sorun=${doktrin.errors.length}${firstErrorTag(doktrin.errors)}` : ""}`;
  const ttb = "skipped" in ttbEvents
    ? "atlandi(haftalik)"
    : "error" in ttbEvents
      ? `hata: ${ttbEvents.error}`
      : `yeni=${ttbEvents.created} guncel=${ttbEvents.updated} devir=${ttbEvents.adopted}/${ttbEvents.found}${ttbEvents.warnings.length ? ` sorun=${ttbEvents.warnings.length}` : ""}`;

  await recordAccess({
    actor: null,
    action: "CRON_MAINTENANCE",
    resourceType: "SYSTEM",
    resourceId: "ingest-hukuk",
    subjectUserId: null,
    detail: `ictihat ${ict} · doktrin ${dok} · ttb ${ttb}`,
  });

  if (failures.length) {
    // Ray C: düşen iş sessiz kalmaz; kısmi başarı 200 (diğer işler yazıldı), alarm ayrıntıyı taşır.
    void sendAlert("cron-ingest-hukuk", `ingest-hukuk — ${failures.length} iş koşamadı`, failures.join(" | ").slice(0, 400));
  }

  // v6.337 SESSİZ KURUMA nöbeti: iş çökmese de art arda N koşu "hiçbir şey bulunamadı + hata" ise alarm
  // (eşikte bir kez + haftalık hatırlatma — lib/ingest-streak). Seri, az önce yazılan satır DAHİL son audit
  // satırlarından durumsuz sayılır. Fail-open: nöbetin kendi hatası koşuyu bozmaz.
  try {
    const recent = await db.accessLog.findMany({
      where: { action: "CRON_MAINTENANCE", resourceId: "ingest-hukuk" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 60,
      select: { detail: true },
    });
    const details = recent.map((r) => r.detail);
    const segments: { key: IngestSegment; label: string; line: string }[] = [
      { key: "ictihat", label: "Yargıtay içtihat", line: ict },
      { key: "doktrin", label: "TR-Dizin doktrin", line: dok },
    ];
    for (const s of segments) {
      const streak = dryStreak(details, s.key);
      if (shouldAlertStreak(streak)) {
        void sendAlert(
          `ingest-dry-${s.key}`,
          `${s.label} ${streak} koşudur hiçbir kayıt bulamıyor`,
          `son koşu: ${s.line}`.slice(0, 400),
        );
      }
    }
  } catch (e) {
    console.error("[ingest-hukuk] kuruma nöbeti okunamadı:", errText(e, "bilinmeyen hata"));
  }

  return NextResponse.json({ ok: failures.length === 0, yargitay, doktrin, ttbEvents });
}
