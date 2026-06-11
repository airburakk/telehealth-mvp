import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations, UI_LANGS } from "@/lib/i18n";

// POST /api/i18n — arayüz metinlerini hedef dile çevirir (önbellek-öncelikli; eksikler Claude ile bir kez)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const lang = UI_LANGS.includes(String(b.lang)) ? String(b.lang) : "Türkçe";
  const texts: string[] = Array.isArray(b.texts)
    ? b.texts.filter((t: unknown) => typeof t === "string").map((t: string) => t.slice(0, 600)).slice(0, 400)
    : [];

  try {
    const map = await getTranslations(lang, texts);
    return NextResponse.json({ lang, map });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Çeviri hatası" }, { status: 502 });
  }
}
