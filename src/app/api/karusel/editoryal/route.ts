import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { trackedCreate } from "@/lib/ai-usage";
import { pickModel } from "@/lib/ai-model";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSocialToken, socialTokenMatches } from "@/lib/social-metrics-auth";
import { webGetir } from "@/lib/karusel-editoryal/kaynak";
import { calistir, DEFAULT_MODEL, Hata } from "@/lib/karusel-editoryal/uret";

// POST /api/karusel/editoryal — Instagram karuselinin 6 öğelik Türkçe kart metni (2026-11-17 · 👤 "vercelde çalıştır";
// eskiden kart servisinde Python'du, sunucuya ayrı Anthropic anahtarı gerekiyordu). YAYINLAMAZ, DB'ye YAZMAZ.
// Çağıran: n8n (karusel akışı). Yanıttaki `editorial` + `qaEditoryal` kart'ın POST /karusel/uret (kapi.qaEditoryal) ucuna
// AYNEN verilir; kart'taki kalite_kapisi.py kaydı denetleyip mühürler. Şema = infra/kart/karusel/editoryal/uret.py.
//
//   gövde: { edition: { day, rawBodyUtf8, rawBodySha256 } }   (sosyal seçkinin dondurulmuş gövdesi)
//   → 200 { gun, karar: "GECTI"|"KALDI", editorial|null, qaEditoryal }  ·  400 girdi  ·  401  ·  413  ·  429  ·  500
//   · 503 KARUSEL_EDITORYAL_TOKEN ya da ANTHROPIC_API_KEY yok (uç UYKUDA — aç/kapa bayrağı jetonun kendisidir)
//
// Self-auth ([[api-routes-need-self-auth]]): ayrı jeton (SOCIAL_DIGEST_TOKEN salt-okuma; bu uç PARA harcar). Hız sınırı
// jetondan ÖNCE. Model CAROUSEL_EDITORIAL_MODEL (varsayılan Haiku 5.5); maliyet /admin/ai-kullanim "karusel-editoryal".
// Süre: 13–16 Kasım ölçümü 67–126 sn (12–21 çağrı) → 800 sn tavanı geniş.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const secret = normalizeSocialToken(process.env.KARUSEL_EDITORYAL_TOKEN);
  if (!secret) return NextResponse.json({ hata: "KARUSEL_EDITORYAL_TOKEN tanımlı değil — uç kapalı." }, { status: 503 });
  // Günde bir koşu + elle tekrar payı; yanlış jetonla deneme yağmuru da sayılır.
  const limited = await rateLimit("karusel-editoryal", 10, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ hata: "Çok fazla istek." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  if (!socialTokenMatches(req.headers.get("authorization"), secret)) return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json({ hata: "ANTHROPIC_API_KEY tanımlı değil — uç kapalı." }, { status: 503 });
  }

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return NextResponse.json({ hata: "Gövde çok büyük." }, { status: 413 });
  let edition: unknown;
  try {
    edition = (JSON.parse(text) as { edition?: unknown }).edition;
  } catch {
    return NextResponse.json({ hata: "Gövde JSON değil." }, { status: 400 });
  }
  const e = edition as { day?: unknown; rawBodyUtf8?: unknown; rawBodySha256?: unknown } | undefined;
  if (!e || typeof e !== "object" || typeof e.day !== "string" || !GUN_RE.test(e.day) || Number.isNaN(Date.parse(`${e.day}T00:00:00Z`))
    || typeof e.rawBodyUtf8 !== "string" || typeof e.rawBodySha256 !== "string") {
    return NextResponse.json({ hata: "edition eksik ya da geçersiz." }, { status: 400 });
  }

  const client = new Anthropic({ maxRetries: 3 });
  try {
    const { qa, editorial } = await calistir(edition, {
      olustur: (params) => trackedCreate(client, "karusel-editoryal", params),
      getir: webGetir(),
      model: pickModel(process.env, "CAROUSEL_EDITORIAL_MODEL", DEFAULT_MODEL),
    });
    // İçerik günlüğe YAZILMAZ (asla-loglama) — yalnız karar + sayaçlar.
    console.log(`[karusel-editoryal] ${qa.day}: ${qa.gun} · ${qa.cagri} çağrı · ≈${qa.tahminiUsd} $ · ${qa.sureSn} sn`);
    return NextResponse.json(
      { gun: qa.day, karar: qa.gun, editorial, qaEditoryal: qa },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Hata) return NextResponse.json({ hata: err.message }, { status: 400 });
    console.error("[karusel-editoryal] beklenmeyen hata:", err instanceof Error ? err.name : "Error");
    return NextResponse.json({ hata: "Editoryal işi tamamlanamadı." }, { status: 500 });
  }
}
