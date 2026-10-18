import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { todayIsoTr } from "@/lib/iso-day";
import { parseSocialMetricsPayload } from "@/lib/social-metrics";
import { normalizeSocialToken, socialTokenMatches } from "@/lib/social-metrics-auth";

// POST /api/social-metrics — sosyal medya günlük hesap toplamlarının MAKİNE ucu (v6.351, 2026-10-17).
// Yön: n8n (otomasyon.doctorium.tr) → uygulama. Platform jetonları n8n'de KALIR; uygulama hiçbir platform API'sine
// bağlanmaz (vault output/doctorium-pano-sosyal-veri-kaynaklari-2026-10-17.md §2). Okuyan: /admin/pano.
// Self-auth ([[api-routes-need-self-auth]] — proxy /api'yi korumaz): Bearer SOCIAL_METRICS_TOKEN; env yoksa uç
// DORMANT (503, /api/social-digest deseni), yanlış anahtar 401. Gövde ≤ 64 KB; sözleşme + doğrulama lib/social-metrics.
// Anahtar karşılaştırması lib/social-metrics-auth (v6.353): boşluk/satır sonu kırpılır, "Bearer " öneki isteğe bağlı.
// Kişisel veri YOK: yalnız sayısal hesap toplamları; gövdeye ham API yanıtı eklenirse bilinmeyen alan olarak reddedilir.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: Request) {
  // Yalnız boşluktan ibaret env de "tanımlı değil" sayılır (uç uykuda kalır, boş anahtarla eşleşme olmaz).
  const secret = normalizeSocialToken(process.env.SOCIAL_METRICS_TOKEN);
  if (!secret) {
    return NextResponse.json({ error: "SOCIAL_METRICS_TOKEN tanımlı değil — uç devre dışı." }, { status: 503 });
  }
  // Hız sınırı anahtardan ÖNCE: yanlış anahtarla deneme yağmuru da sayılır. Tek tüketici (n8n) günde birkaç kez yazar.
  const limited = await rateLimit("social-metrics", 60, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok fazla istek." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  if (!socialTokenMatches(req.headers.get("authorization"), secret)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return NextResponse.json({ error: "Gövde çok büyük." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const parsed = parseSocialMetricsPayload(body, todayIsoTr());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Yalnız gönderilen alanlar yazılır (gönderilmeyen dokunulmaz) — aynı gün başka akıştan gelen ölçü silinmesin.
  await db.$transaction(
    parsed.items.map((it) =>
      db.socialMetricDaily.upsert({
        where: { platform_day: { platform: it.platform, day: it.day } },
        create: { platform: it.platform, day: it.day, ...it.metrics },
        update: it.metrics,
      }),
    ),
  );

  return NextResponse.json(
    { ok: true, written: parsed.items.map((it) => ({ platform: it.platform, day: it.day, fields: Object.keys(it.metrics) })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
