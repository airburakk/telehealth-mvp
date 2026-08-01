import { NextResponse } from "next/server";
import { purgeExpired, RETENTION_YEARS } from "@/lib/account-deletion";
import { verifyAccessChain, recordAccess } from "@/lib/audit";
import { verifyConsentChain } from "@/lib/consent";
import { sendAlert } from "@/lib/alerts";
import { remindPendingDocs, type RemindResult } from "@/lib/pending-docs-reminder";
import { ingestDoctorium, type IngestResult } from "@/lib/doctorium-ingest";

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
    await recordAccess({
      actor: null, // sistem koşusu
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "purge-deleted",
      subjectUserId: null,
      detail: `imha=${r.purgedCases}/${r.purgedSoCases}/${r.purgedUsers} basarisiz=${r.failed} · zincir audit=${audit.count}${audit.ok ? "" : " KIRIK"} consent=${consent.count}${consent.ok ? "" : " KIRIK"} · hatirlatma ${rem} · doctorium ${doc}`,
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
