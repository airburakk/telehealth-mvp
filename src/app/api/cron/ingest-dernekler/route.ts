import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestDernekler } from "@/lib/doctorium-ingest";

// GET /api/cron/ingest-dernekler — uzmanlık derneği RSS kaynakları (klimik/tjod/tatd/tgd-gastro/tgcd)
// → NewsArticle (lib/doctorium-ingest ingestDernekler).
//
// 2026-09-04: ingest-doctorium'dan AYRILDI (kullanıcı bildirimi: 3 Eylül içeriğinde AI özeti eksikti,
// araştırma ingest-doctorium'un o gün 504 timeout ile kesildiğini gösterdi). Kök neden: ana ingest
// (23 branş × 3 akademik kaynak + RG + 9 sabit + 2 RSS ≈ 84 sıralı istek) tek başına 300 sn bütçesinin
// kenarında geziniyordu; dış kaynaklardan biri normalden yavaş yanıtlayınca dernekler sıraya hiç
// giremeden route kesildi — SESSİZCE (fonksiyon zorla durdurulunce audit/alarm hiç yazılamaz).
// Bu cron küçük (5 kaynak) — kendi bütçesiyle her zaman tamamlanır, derneklere garanti bütçe verir.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-dernekler");
  if (gate) return gate;

  try {
    const r = await ingestDernekler();
    const toplamTarandi = Object.values(r.sources).reduce((s, [t]) => s + t, 0);
    const toplamYeni = Object.values(r.sources).reduce((s, [, y]) => s + y, 0);
    // Kalıcı koşu izi: PHI YOK (yalnız adetler) — "cron koştu mu, kaç kayıt geldi" kalıcı kayıttan okunur.
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "ingest-dernekler",
      subjectUserId: null,
      detail: `dernek=${toplamYeni}/${toplamTarandi}${r.errors.length ? ` sorun=${r.errors.length}` : ""}`,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Ray C: cron sessiz düşemez — alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert("cron-ingest-dernekler", "ingest-dernekler cron BAŞARISIZ — dernek içeriği koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "ingest-dernekler başarısız." }, { status: 500 });
  }
}
