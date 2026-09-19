// Sunucu SAYFALARI için audit meta (IP + cihaz) — `reqMeta(req)`'in Request'siz eşleniği.
//
// Kontrol raporu 2026-09-17 K05: doktorun normal açtığı sunucu sayfası (doktor/vaka/[id]) ve hasta vaka
// merkezi (vaka/[caseId]) klinik veriyi çözüyor ama erişim kaydı yazmıyordu — CASE_VIEW yalnız JSON ucunda
// (api/cases/[id]) vardı. Sayfalar artık recordAccess çağırır; Request nesnesi olmadığından IP/cihaz
// başlıkları next/headers'tan okunur.
//
// audit.ts'ten AYRI dosya: audit.ts betiklerden (tsx) ve cron rotalarından da import edilir; next/headers
// bağımlılığını oraya taşımamak için sayfa-tarafı yardımcı burada yaşar.
import { headers } from "next/headers";

export async function headersMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    // İstek kapsamı dışında (prova/test) → meta boş kalır, audit satırı yine yazılır (kayıt > meta).
    return { ip: null, userAgent: null };
  }
}
