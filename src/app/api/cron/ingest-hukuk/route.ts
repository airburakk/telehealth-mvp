import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestYargitay, type YargitayIngestResult } from "@/lib/hukuk-ingest";
import { ingestDoktrin, type DoktrinIngestResult } from "@/lib/doktrin-ingest";
import { ingestTtbEvents, type TtbEventsResult } from "@/lib/ttb-events";

// GET /api/cron/ingest-hukuk — hukuk + etkinlik içerik hattı: Yargıtay içtihat (v6.86) · TR-Dizin
// doktrin (v6.91) · TTB akredite etkinlik taraması (v6.129, HAFTALIK — yalnız Pazartesi).
//
// v6.204 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim"; plan Pro).
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

  const ict = "error" in yargitay
    ? `hata: ${yargitay.error}`
    : `yeni=${yargitay.created}/${yargitay.found}${yargitay.deferred ? ` erteli=${yargitay.deferred}` : ""}${yargitay.errors.length ? ` sorun=${yargitay.errors.length}` : ""}`;
  const dok = "error" in doktrin
    ? `hata: ${doktrin.error}`
    : `yeni=${doktrin.created}/${doktrin.found}${doktrin.errors.length ? ` sorun=${doktrin.errors.length}` : ""}`;
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

  return NextResponse.json({ ok: failures.length === 0, yargitay, doktrin, ttbEvents });
}
