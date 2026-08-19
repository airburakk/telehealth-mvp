import { NextResponse } from "next/server";
import { purgeExpired, RETENTION_YEARS } from "@/lib/account-deletion";
import { verifyAccessChain, recordAccess } from "@/lib/audit";
import { verifyConsentChain } from "@/lib/consent";
import { sendAlert } from "@/lib/alerts";
import { remindPendingDocs, type RemindResult } from "@/lib/pending-docs-reminder";
import { ingestDoctorium, type IngestResult } from "@/lib/doctorium-ingest";
import { ingestYargitay, type YargitayIngestResult } from "@/lib/hukuk-ingest";
import { ingestDoktrin, type DoktrinIngestResult } from "@/lib/doktrin-ingest";
import { remindCongressFollows, type CongressRemindResult } from "@/lib/congress-reminder";
import { ingestTtbEvents, type TtbEventsResult } from "@/lib/ttb-events";

// GET /api/cron/purge-deleted — saklama süresi dolan klinik kayıtları GERÇEKTEN imha eder (v6.11).
// vercel.json cron'u günde bir tetikler. registry-sync ile aynı Bearer deseni (anonim tetiklenemez).
//
// Bu uç, silme akışının SÖZÜNÜ TUTAN parçasıdır: hasta hesabını sildiğinde klinik kayıt yasal
// yükümlülük gereği saklanır ama kilitlenir; süre (RETENTION_YEARS) dolunca burası kaydı fiziken siler.
// Cron olmasaydı "süre sonunda imha edilir" yazmak boş bir vaat olurdu.
//
// Batch: purgeExpired varsayılan 50 kayıt/gün — cron zaman aşımına girmesin. Kalan ertesi gün alınır
// (idempotent: yalnız purgeAfter <= now olanlara bakar). Günde 50 imha, gerçekçi hacmin çok üstünde.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil — cron devre dışı." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const r = await purgeExpired();

    // Kısmi başarısızlık: bozuk kayıt batch'i düşürmez (vaka-başına try/catch) ama sessiz de kalamaz —
    // imha sözü verilmiş kayıt duruyor demektir; ertesi gün yeniden denenir, o güne kadar her koşu alarm düşürür.
    if (r.failed > 0) {
      void sendAlert(
        "cron-purge",
        `purge-deleted KISMİ başarısızlık — ${r.failed} kayıt imha edilemedi (batch devam etti)`,
        `purged: ${r.purgedCases} vaka / ${r.purgedSoCases} SO / ${r.purgedUsers} kabuk`,
      );
    }

    // Blob imhası AYRI alarm (2026-08-03 kod incelemesi): DB satırı silinip harici nesne kalırsa
    // kullanıcıya verilen "imha edilir" sözü tutulmamış olur — ve satır gittiği için ref de kaybolur,
    // yani yetim nesne bir daha OTOMATİK bulunamaz. Bu yüzden sessiz geçilemez.
    if (r.failedBlobs > 0) {
      void sendAlert(
        "cron-purge-blob",
        `purge-deleted — ${r.failedBlobs} Blob nesnesi SİLİNEMEDİ (yetim PHI kalmış olabilir)`,
        `silinen blob: ${r.purgedBlobs} · DB satırları imha edildi, harici nesne kaldı → elle temizlik gerekir`,
      );
    }

    // Günlük bütünlük NÖBETİ (Ray C): iki append-only zincir (audit + onam) baştan sona doğrulanır.
    // Kırıksa verify fonksiyonları kendi alarmını düşürür; burada yalnız sayaçlar raporlanır.
    // MVP hacminde ucuz (tüm mühürlü satırlar okunur, maxDuration=300); hacim büyüyünce artımlı
    // doğrulamaya geçilir (zincir ucu checkpoint'i) — bilinçli erteleme.
    const [audit, consent] = await Promise.all([verifyAccessChain(), verifyConsentChain()]);

    // DOCS_PENDING hatırlatması (2026-07-24): bu rota fiilen GÜNLÜK BAKIM NÖBETİ (Vercel Hobby
    // cron limiti 2/dolu → yeni cron açılamaz) — belge-bekleyen başvuruların hastalarına günde 1
    // dürtü (en fazla 3; lib/pending-docs-reminder). Hatırlatma kritik değil: hata imha akışını
    // DÜŞÜRMEZ, yalnız yanıtta raporlanır (hasta panelden her an kendisi tamamlayabilir).
    let reminders: RemindResult | { error: string };
    try {
      reminders = await remindPendingDocs();
    } catch (e) {
      reminders = { error: e instanceof Error ? e.message.slice(0, 120) : "hatırlatma koşamadı" };
    }

    // Doctorium içerik toplama (2026-08-01, v6.48): PubMed 30 branş + Resmî Gazete fihristi →
    // NewsArticle. Aynı gerekçe: Hobby cron 2/2 dolu, bu rota fiilen günlük bakım nöbeti.
    // Kritik DEĞİL: hatası imha akışını düşürmez, yalnız raporlanır (portal bir gün bayat kalır).
    let doctorium: IngestResult | { error: string };
    try {
      doctorium = await ingestDoctorium();
    } catch (e) {
      doctorium = { error: e instanceof Error ? e.message.slice(0, 120) : "ingest koşamadı" };
    }

    // Hukuk/İçtihat toplama (v6.86): Yargıtay karar arama → NewsArticle (category=ictihat).
    // Koşu başına metin tavanı lib içinde (MAX_DOC_FETCH_DEFAULT) — bütçe dostu; kalan `deferred`
    // ertesi koşuda idempotent alınır. Kritik değil: hata imha akışını düşürmez, raporlanır.
    // ⚠️ Vercel fra1 → devlet sitesi erişimi GARANTİ DEĞİL (RG dersi): burada sürekli hata
    // görülürse yerel yol hazır → scripts/ingest-yargitay.ts (--prod --yaz).
    let yargitay: YargitayIngestResult | { error: string };
    try {
      yargitay = await ingestYargitay();
    } catch (e) {
      yargitay = { error: e instanceof Error ? e.message.slice(0, 120) : "içtihat ingest koşamadı" };
    }

    // Doktrin toplama (v6.91): TR-Dizin hakemli makale metadata'sı → NewsArticle
    // (category=doktrin). Tek aşamalı ve ucuz (ikinci belge isteği yok); cron'da yalnız her
    // sorgunun İLK sayfası taranır (yeni yayınlar üstte — publicationYear-DESC). Kritik değil.
    let doktrin: DoktrinIngestResult | { error: string };
    try {
      doktrin = await ingestDoktrin({ maxPages: 1 });
    } catch (e) {
      doktrin = { error: e instanceof Error ? e.message.slice(0, 120) : "doktrin ingest koşamadı" };
    }

    // Doctorium kongre alarmı (v6.49): takip edilen kongrenin başlangıcı / bildiri-erken kayıt son
    // tarihi doktorun seçtiği eşiğe girdiyse bildirim. Kritik değil — hata imha akışını düşürmez.
    let congress: CongressRemindResult | { error: string };
    try {
      congress = await remindCongressFollows();
    } catch (e) {
      congress = { error: e instanceof Error ? e.message.slice(0, 120) : "kongre alarmı koşamadı" };
    }

    // TTB akredite etkinlik taraması (v6.129) — HAFTALIK kontenjan (yalnız Pazartesi koşar):
    // düzenleyiciler etkinlikten en az 30 gün önce başvurduğu için kayıt SEYREK akar (v6.120
    // ölçümü); her gün taramak hem israf hem kaynağa saygısızlık. Pencere cron'da DAR tutulur
    // (geçmiş 1 ay + gelecek 13 ay — yeni başvurular hep yakın gelecekte); tam/geri dönük tarama
    // CLI işidir (scripts/ingest-ttb-events.ts). Kritik değil: hata imha akışını düşürmez.
    // ⚠️ Kaynaklar arası birleştirme (merge-congress-sources.ts) BİLİNÇLİ cron'da değil — satır
    // silen araç insan gözetiminde kalır. Raporda `created` yüksekse elle merge koşulur.
    let ttbEvents: TtbEventsResult | { skipped: true } | { error: string };
    if (new Date().getUTCDay() === 1) {
      try {
        const now = new Date();
        const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        ttbEvents = await ingestTtbEvents({
          fromYm: ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
          toYm: ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 13, 1))),
        });
      } catch (e) {
        ttbEvents = { error: e instanceof Error ? e.message.slice(0, 120) : "TTB taraması koşamadı" };
      }
    } else {
      ttbEvents = { skipped: true }; // haftalık kontenjan — bugün sırası değil
    }

    // KALICI KOŞU İZİ (2026-07-29): Vercel Hobby'de runtime log saklama süresi 1 SAAT — cron gece
    // koştuğu için sayaçları log'dan gözlemek fiilen imkânsızdı ("ertesi gün bak" planı çalışmıyordu).
    // Sayaçlar audit zincirine yazılır: PHI YOK (yalnız adetler), günde 1 satır (hacim ~3,5/gün'ün
    // yanında önemsiz). "Cron koştu mu, kaç hatırlatma gitti" sorusu artık kalıcı kayıttan yanıtlanır.
    const rem = "error" in reminders
      ? `hata: ${reminders.error}`
      : `bakilan=${reminders.checked} gonderilen=${reminders.reminded} tavan=${reminders.capped} hata=${reminders.failed}`;
    const doc = "error" in doctorium
      ? `hata: ${doctorium.error}`
      : `pubmed=${doctorium.pubmedNew}/${doctorium.pubmedFetched} rg=${doctorium.gazetteNew}/${doctorium.gazetteFetched}${doctorium.errors.length ? ` sorun=${doctorium.errors.length}` : ""}`;
    const ict = "error" in yargitay
      ? `hata: ${yargitay.error}`
      : `yeni=${yargitay.created}/${yargitay.found}${yargitay.deferred ? ` erteli=${yargitay.deferred}` : ""}${yargitay.errors.length ? ` sorun=${yargitay.errors.length}` : ""}`;
    const dok = "error" in doktrin
      ? `hata: ${doktrin.error}`
      : `yeni=${doktrin.created}/${doktrin.found}${doktrin.errors.length ? ` sorun=${doktrin.errors.length}` : ""}`;
    const con = "error" in congress
      ? `hata: ${congress.error}`
      : `bakilan=${congress.checked} baslangic=${congress.start} bildiri=${congress.abstract} erkenkayit=${congress.earlybird} hata=${congress.failed}`;
    const ttb = "skipped" in ttbEvents
      ? "atlandi(haftalik)"
      : "error" in ttbEvents
        ? `hata: ${ttbEvents.error}`
        : `yeni=${ttbEvents.created} guncel=${ttbEvents.updated} devir=${ttbEvents.adopted}/${ttbEvents.found}${ttbEvents.warnings.length ? ` sorun=${ttbEvents.warnings.length}` : ""}`;
    await recordAccess({
      actor: null, // sistem koşusu
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "purge-deleted",
      subjectUserId: null,
      detail: `imha=${r.purgedCases}/${r.purgedSoCases}/${r.purgedUsers} basarisiz=${r.failed} · blob=${r.purgedBlobs} blobHata=${r.failedBlobs} · zincir audit=${audit.count}${audit.ok ? "" : " KIRIK"} consent=${consent.count}${consent.ok ? "" : " KIRIK"} · hatirlatma ${rem} · doctorium ${doc} · ictihat ${ict} · doktrin ${dok} · kongre ${con} · ttb ${ttb}`,
    });

    return NextResponse.json({
      ok: true,
      retentionYears: RETENTION_YEARS,
      ...r,
      chains: {
        audit: { ok: audit.ok, count: audit.count, brokenAt: audit.brokenAt, unverifiableSeals: audit.unverifiableSeals },
        consent: { ok: consent.ok, count: consent.count, brokenAt: consent.brokenAt, unverifiableSeals: consent.unverifiableSeals, purgedSeals: consent.purgedSeals },
      },
      pendingDocsReminders: reminders,
      doctorium,
      yargitay,
      doktrin,
      congressAlerts: congress,
      ttbEvents,
    });
  } catch (e) {
    // Saklama-imha sözünün bekçisi sessizce düşemez (Ray C): alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert(
      "cron-purge",
      "purge-deleted cron BAŞARISIZ — saklama süresi dolan kayıtların imhası koşmadı",
      e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    );
    return NextResponse.json({ error: "purge-deleted başarısız." }, { status: 500 });
  }
}
