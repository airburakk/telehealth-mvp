import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestDoktrin, type DoktrinIngestResult } from "@/lib/doktrin-ingest";
import { ingestTtbEvents, type TtbEventsResult } from "@/lib/ttb-events";
import { db } from "@/lib/db";
import {
  ageInDays, dryStreak, firstErrorTag, freshnessLine, latestEvidence, shouldAlertStale, shouldAlertStreak,
  ICTIHAT_LOCAL_RESOURCE, ICTIHAT_STALE_DAYS, type IngestSegment,
} from "@/lib/ingest-streak";

// GET /api/cron/ingest-hukuk — hukuk + etkinlik içerik hattı: Yargıtay içtihat TAZELİK NÖBETİ (v6.343) ·
// TR-Dizin doktrin (v6.91) · TTB akredite etkinlik taraması (v6.129, HAFTALIK — yalnız Pazartesi).
//
// v6.343 (2026-10-10, 👤 karar): karararama.yargitay.gov.tr yurt dışı / veri merkezi IP'lerini TCP düzeyinde
// engelliyor (TR 200 · Hetzner DE zaman aşımı · fra1 "fetch failed" 11.08'den beri) → cron karar ÇEKMEZ.
// Kararları kullanıcının bilgisayarındaki haftalık Windows görevi yazar (scripts/ingest-yargitay.ts --prod --yaz;
// görev vault'ta output/yargitay-besleme/) ve nabız satırı bırakır (`ingest-yargitay-yerel`). Burada yalnız
// "son TAM tarama kaç gün önce?" ölçülür; ICTIHAT_STALE_DAYS aşılınca alarm (lib/ingest-streak).
//
// v6.205 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim"; plan Pro).
// 02:20 UTC = 05:20 TR — ingest-doctorium'dan 20 dk sonra, Post baskısından (06:30 TR) önce biter.
// Üç iş birbirinden BAĞIMSIZ: biri düşerse diğerleri koşar; düşen alarmla görünür, koşu 200 döner
// (kısmi başarı).
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

  // İçtihat tazelik nöbeti (v6.343): kanıt = son TAM yerel tarama nabzı; nabız henüz yoksa (geçiş) son yazılan karar.
  let ict: string;
  let ictihatAgeDays: number | null = null;
  try {
    const [lastScan, lastArticle] = await Promise.all([
      db.accessLog.findFirst({
        where: { action: "CRON_MAINTENANCE", resourceId: ICTIHAT_LOCAL_RESOURCE, detail: { contains: "tarama=tam" } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.newsArticle.findFirst({ where: { source: "yargitay" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const evidence = latestEvidence(lastScan?.createdAt, lastArticle?.createdAt);
    ictihatAgeDays = ageInDays(evidence, new Date());
    ict = freshnessLine(evidence, ictihatAgeDays);
    if (shouldAlertStale(ictihatAgeDays)) {
      void sendAlert(
        "ingest-stale-ictihat",
        ictihatAgeDays === null
          ? "Yargıtay içtihat: hiç besleme kanıtı yok"
          : `Yargıtay içtihat ${ictihatAgeDays} gündür beslenmedi (eşik ${ICTIHAT_STALE_DAYS})`,
        `${ict} — yerel haftalık görev çalışıyor mu? (Görev Zamanlayıcı "Doctorium Yargitay haftalik" + output/yargitay-besleme/log)`,
      );
    }
  } catch (e) {
    ict = `hata: ${errText(e, "içtihat tazelik ölçülemedi")}`;
    failures.push(`ictihat-tazelik: ${ict}`);
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
    // İçtihat v6.343'ten beri burada DEĞİL: cron çekmiyor, bayatlığı yukarıdaki tazelik nöbeti ölçer.
    const segments: { key: IngestSegment; label: string; line: string }[] = [
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

  return NextResponse.json({ ok: failures.length === 0, ictihat: { tazelik: ict, gun: ictihatAgeDays }, doktrin, ttbEvents });
}
