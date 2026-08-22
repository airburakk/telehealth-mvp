import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { landingFeedSample, parseLandingQuery } from "@/lib/doctorium-landing/landing-feed";

// Doctorium landing — kişiselleştirme demosu veri ucu (2026-08-23). ANONİM, SALT-OKUNUR.
//
// Neden ayrı uç: /api/doctorium/feed oturum + hasDoctoriumAccess ister (anonimde 401) ve cursor
// sözleşmesi taşır. Landing demosunun ihtiyacı tek sayfa, tek branş, seçili bölümler — yazma yok.
// Veri PHI değil (halka açık yayın/haber). Girdi allowlist'li (parseLandingQuery), IP başına
// 30/dk; sonuç CDN'de 5 dk önbellekli (aynı seçim herkes için aynı akış — kişisel veri değil).
// Tercih, kayıt, takip gibi hiçbir yazma yolu bu uçtan çağrılmaz.
export async function GET(req: Request) {
  const rl = await rateLimit(`landing-feed:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "Çok fazla istek" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  const url = new URL(req.url);
  const q = parseLandingQuery(url.searchParams.get("b"), url.searchParams.get("m"));
  if (!q) return NextResponse.json({ error: "Geçersiz branş veya bölüm" }, { status: 400 });

  const sample = await landingFeedSample(q.branch, q.modules, 12);
  return NextResponse.json(sample, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
