import { NextResponse } from "next/server";
import { purgeExpired, RETENTION_YEARS } from "@/lib/account-deletion";
import { verifyAccessChain, recordAccess, sealDailyChainAnchor } from "@/lib/audit";
import { verifyConsentChain } from "@/lib/consent";
import { sendAlert } from "@/lib/alerts";
import { cronGate, errText } from "@/lib/cron-guard";
import { sweepDoctorDocuments, type DocSweepResult } from "@/lib/doc-purge";

// GET /api/cron/purge-deleted — İMHA + BÜTÜNLÜK ailesi (v6.11): saklama süresi dolan klinik
// kayıtları GERÇEKTEN imha eder; iki append-only zinciri (audit + onam) doğrular; audit zincirinin
// günlük kök damgasını mühürler (v6.200); doktor belge (diploma) süpürmesini koşar (v6.188).
//
// v6.204 (2026-09-02): bu rota Temmuz–Ağustos boyunca "GÜNLÜK BAKIM NÖBETİ"ydi — Hobby planının
// cron kısıtı yüzünden on iş buraya bindirilmişti. Plan Pro; kullanıcı kararıyla ("bölelim") altı
// cron'a ayrıldı: içerik → ingest-doctorium + ingest-hukuk (05:00/05:20 TR) · doktora bildirim →
// daily-digest (06:30 TR) · hasta hatırlatması → pending-docs-reminders (10:00 TR). Burada yalnız
// imha/bütünlük kaldı (06:30 TR). Ortak kapı (BRAND_MODE no-op + CRON_SECRET) lib/cron-guard.
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
  const gate = cronGate(req, "purge-deleted");
  if (gate) return gate;

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
    //
    // Günlük kök damgası (TSA mimarisi, 2026-09-02): audit zinciri artık satır başına değil günde 1
    // kez damgalanır (sealDailyChainAnchor) — bu SATIRDAN SONRA eklenen kayıtlar (ör. bu cron'un
    // kendi CRON_MAINTENANCE satırı, diğer cron'ların izleri) yarının anchor'ına kalır, bilinçli erteleme.
    const [audit, consent, anchor] = await Promise.all([
      verifyAccessChain(), verifyConsentChain(), sealDailyChainAnchor(),
    ]);

    // Doktor belge imhası (2026-08-30, KVKK minimizasyonu — lib/doc-purge): doğrulanmış
    // diplomaların dosyaları (mevcut kayıtlar dahil — backfill kendiliğinden) + saklama süresi
    // dolan reddedilmişler. Anında-imha yollarının Blob kaçaklarını da bu süpürme telafi eder.
    // Kritik değil: hata imha akışını düşürmez, raporlanır. İmha ailesinden olduğu için BURADA kaldı.
    let docSweep: DocSweepResult | { error: string };
    try {
      docSweep = await sweepDoctorDocuments();
    } catch (e) {
      docSweep = { error: errText(e, "belge süpürmesi koşamadı") };
    }
    // Blob silinemedi = imha sözü tutulamadı ve satır dokunulmadan bekliyor — sessiz geçilemez
    // (ertesi koşu yeniden dener ama alarm düşer; purge-deleted failedBlobs deseniyle aynı).
    if (!("error" in docSweep) && docSweep.blobFailed > 0) {
      void sendAlert(
        "cron-doc-purge-blob",
        `belge süpürmesi — ${docSweep.blobFailed} diploma Blob'u SİLİNEMEDİ (satırlar bekletildi, yarın yeniden denenir)`,
        `imha edilen: ${docSweep.swept}`,
      );
    }

    // KALICI KOŞU İZİ (2026-07-29): runtime log kısa ömürlü (o dönem Hobby 1 saat, Pro 1 gün) — cron
    // gece koştuğu için sayaçları log'dan gözlemek güvenilmezdi. Sayaçlar audit zincirine yazılır:
    // PHI YOK (yalnız adetler), günde 1 satır. "Cron koştu mu" sorusu kalıcı kayıttan yanıtlanır.
    const bel = "error" in docSweep
      ? `hata: ${docSweep.error}`
      : `imha=${docSweep.swept} blobHata=${docSweep.blobFailed}`;
    await recordAccess({
      actor: null, // sistem koşusu
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "purge-deleted",
      subjectUserId: null,
      detail: `imha=${r.purgedCases}/${r.purgedSoCases}/${r.purgedUsers} basarisiz=${r.failed} · blob=${r.purgedBlobs} blobHata=${r.failedBlobs} · zincir audit=${audit.count}${audit.ok ? "" : " KIRIK"} consent=${consent.count}${consent.ok ? "" : " KIRIK"} · gunluk-damga ${anchor.sealed ? `${anchor.day} (${anchor.entryCount} satir)` : `atlandi: ${anchor.reason}`} · belgeimha ${bel}`,
    });

    return NextResponse.json({
      ok: true,
      retentionYears: RETENTION_YEARS,
      ...r,
      chains: {
        audit: { ok: audit.ok, count: audit.count, brokenAt: audit.brokenAt, unverifiableSeals: audit.unverifiableSeals, lastAnchorAt: audit.lastAnchorAt },
        consent: { ok: consent.ok, count: consent.count, brokenAt: consent.brokenAt, unverifiableSeals: consent.unverifiableSeals, purgedSeals: consent.purgedSeals },
      },
      dailyAnchor: anchor,
      docSweep,
    });
  } catch (e) {
    // Saklama-imha sözünün bekçisi sessizce düşemez (Ray C): alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert(
      "cron-purge",
      "purge-deleted cron BAŞARISIZ — saklama süresi dolan kayıtların imhası koşmadı",
      errText(e, String(e).slice(0, 200)),
    );
    return NextResponse.json({ error: "purge-deleted başarısız." }, { status: 500 });
  }
}
