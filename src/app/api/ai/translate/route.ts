import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { translateText } from "@/lib/ai-clinical";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { LANGUAGES } from "@/lib/constants";

// Hedef dil allowlist'i = platform dil listesi (tek doğruluk noktası; 2026-07-23'e dek burada
// bayat 8-dillik kopya vardı — Farsça/Almanca/Bulgarca allowlist dışı kalıyordu).
const LANGS = LANGUAGES;

// POST /api/ai/translate — medikal metni hedef dile çevirir (Claude)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const rl = await rateLimit(`ai:${user.id}`, 20, 60_000); // AI maliyet/DoS freni: 20/dk/kullanıcı
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  const text = String(b.text ?? "").trim();
  const target = LANGS.includes(String(b.target)) ? String(b.target) : "Türkçe";
  if (!text) return NextResponse.json({ error: "Çevrilecek metin yok." }, { status: 400 });

  try {
    const translated = await translateText(text.slice(0, 4000), target);
    return NextResponse.json({ translated, target });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
