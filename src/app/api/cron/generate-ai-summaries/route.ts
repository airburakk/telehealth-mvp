import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { generatePendingAiSummaries } from "@/lib/doctorium";

// GET /api/cron/generate-ai-summaries — Doctorium akademik/ilaç/sektörel/mevzuat AI özetinin
// PROAKTİF üretimi (2026-09-05, kullanıcı kararı: "tembel üretimden vazgeçelim, çünkü günlük
// bültenler ve Doctorium Post'lar yanlış üretiliyor, her sabah herhangi bir tıklama beklemeden
// üretim yapılsın").
//
// KÖK NEDEN: aiSummary eskiden yalnız bir doktor yayını AÇTIĞINDA üretiliyordu ([id]/page.tsx
// → ensureClinicalSummary/ensureRegulationSummary, lib/doctorium.ts). daily-digest (06:30 TR,
// Doctorium Post) o sabah gelen içeriği kimse henüz tıklamadan ÖZETSİZ/eksik gösteriyordu.
//
// Bu cron, TÜM ingest'ler + translate-news bittikten sonra ama Post baskısından ÖNCE çalışır;
// bekleyen tüm adayları generatePendingAiSummaries (lib/doctorium.ts) ile doldurur — scripts/
// backfill-ai-summaries.ts İLE PAYLAŞILAN AYNI gövde (kod tekrarı yok). DEV ölçümü (2026-09-05):
// 40 kayıt / eşzamanlılık 5 ≈ 148 sn — maxDuration 800 (Pro'da GA) güvenli pay bırakır.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "generate-ai-summaries");
  if (gate) return gate;

  try {
    const r = await generatePendingAiSummaries({ concurrency: 5 });
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "generate-ai-summaries",
      subjectUserId: null,
      detail: `ozet=${r.basarili}/${r.toplam}${r.hata ? ` hata=${r.hata}` : ""}`,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Ray C: cron sessiz düşemez — alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert("cron-generate-ai-summaries", "generate-ai-summaries cron BAŞARISIZ — AI özeti üretimi koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "generate-ai-summaries başarısız." }, { status: 500 });
  }
}
