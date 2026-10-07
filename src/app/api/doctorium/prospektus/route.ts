import { NextResponse } from "next/server";
import { mapLabel, readLabelPayload } from "@/lib/prospektus-label";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

// GET /api/doctorium/prospektus?q=... — dijital prospektüs arama (v6.50).
//
// ⚠️ KAYNAK ABD: openFDA drug/label = FDA onaylı ÜRÜN BİLGİSİ (SPL). Türkiye ruhsatındaki KÜB/KT
// FARKLI olabilir (endikasyon/doz/uyarı) — TİTCK'nın makine-okunur kaynağı YOK (2026-08-01'de
// ölçüldü: API/RSS uçları 404). Bu yüzden arayüz "FDA (ABD)" uyarısını KALDIRAMAZ biçimde gösterir.
// Metin ÇEVRİLMEZ: çeviri hem verinin ABD kaynaklı olduğunu gizler hem de dozaj hatası riski taşır.
//
// Self-auth: yalnız klinik roller. Ayrıca rate-limit (dış API'yi doktor başına makul tut).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`prospektus:${clientIp(req)}`, 30, 5 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ error: "En az 2 karakter yazın." }, { status: 400 });
  // Yalnız harf/rakam/boşluk/tire — openFDA sorgu sözdizimine enjeksiyon olmasın.
  const safe = q.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().slice(0, 60);
  if (!safe) return NextResponse.json({ error: "Geçerli bir ilaç adı yazın." }, { status: 400 });

  const search = `openfda.brand_name:"${safe}" OR openfda.generic_name:"${safe}"`;
  const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=5`;

  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(15000) }); // etiketler seyrek değişir
    if (res.status === 404) return NextResponse.json({ ok: true, results: [] }); // openFDA "sonuç yok" = 404
    if (!res.ok) throw new Error(`openFDA HTTP ${res.status}`);
    const j = await readLabelPayload(res);
    const results = (j.results ?? []).slice(0, 5).map(mapLabel);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.warn("[prospektus] openFDA erişilemedi:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Kaynağa şu anda ulaşılamadı." }, { status: 502 });
  }
}
