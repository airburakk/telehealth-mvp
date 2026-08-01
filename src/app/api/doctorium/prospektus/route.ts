import { NextResponse } from "next/server";
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

interface FdaLabel {
  openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[] };
  indications_and_usage?: string[];
  dosage_and_administration?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
  contraindications?: string[];
  adverse_reactions?: string[];
  effective_time?: string;
  id?: string;
}

function first(v: string[] | undefined, max = 1200): string | null {
  const s = v?.[0]?.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

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
    const res = await fetch(url, { next: { revalidate: 86400 } }); // etiketler seyrek değişir
    if (res.status === 404) return NextResponse.json({ ok: true, results: [] }); // openFDA "sonuç yok" = 404
    if (!res.ok) throw new Error(`openFDA HTTP ${res.status}`);
    const j = (await res.json()) as { results?: FdaLabel[] };
    const results = (j.results ?? []).map((r) => ({
      id: r.id ?? null,
      brand: r.openfda?.brand_name?.[0] ?? null,
      generic: r.openfda?.generic_name?.[0] ?? null,
      manufacturer: r.openfda?.manufacturer_name?.[0] ?? null,
      effectiveTime: r.effective_time ?? null,
      indications: first(r.indications_and_usage),
      dosage: first(r.dosage_and_administration),
      warnings: first(r.warnings ?? r.warnings_and_cautions),
      contraindications: first(r.contraindications),
      adverse: first(r.adverse_reactions),
    }));
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.warn("[prospektus] openFDA erişilemedi:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Kaynağa şu anda ulaşılamadı." }, { status: 502 });
  }
}
