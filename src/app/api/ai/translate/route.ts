import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { translateText } from "@/lib/ai-clinical";

const LANGS = ["Türkçe", "Rusça", "Arapça", "Azerice", "İngilizce", "Fransızca", "Kazakça", "Kırgızca"];

// POST /api/ai/translate — medikal metni hedef dile çevirir (Claude)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

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
