// Arayüz çevirisi — önbellek-öncelikli (Translation tablosu), eksikler Claude ile bir kez çevrilir.
// Türkçe hedefte veya anahtar yokken kimlik (identity) döner — uygulama her durumda çalışır.
import { createHash } from "crypto";
import { db } from "./db";
import { translateBatch } from "./ai-clinical";
import { LANGUAGES } from "./constants";

export const UI_LANGS = LANGUAGES; // "Türkçe", "Rusça", "Azerice", "Arapça", "Fransızca", "İngilizce", "Kazakça", "Kırgızca"

export function tHash(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

const CHUNK = 50; // Claude çağrısı başına metin

export async function getTranslations(lang: string, texts: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  const identity = Object.fromEntries(uniq.map((s) => [s, s]));
  if (lang === "Türkçe" || !UI_LANGS.includes(lang) || uniq.length === 0) return identity;

  const map: Record<string, string> = {};
  const rows = await db.translation.findMany({
    where: { lang, sourceHash: { in: uniq.map(tHash) } },
  });
  for (const r of rows) map[r.source] = r.translated;

  const missing = uniq.filter((s) => map[s] === undefined);
  if (missing.length && process.env.ANTHROPIC_API_KEY) {
    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK);
      try {
        const out = await translateBatch(chunk, lang);
        const data = chunk.map((s, j) => ({ lang, sourceHash: tHash(s), source: s, translated: out[j] ?? s }));
        await db.translation.createMany({ data, skipDuplicates: true });
        for (const d of data) map[d.source] = d.translated;
      } catch (e) {
        console.warn("[i18n] çeviri hatası — TR ile devam:", e instanceof Error ? e.message : e);
        for (const s of chunk) map[s] = s; // hata → Türkçe fallback (cache'e yazılmaz)
      }
    }
  } else {
    for (const s of missing) map[s] = s;
  }
  return map;
}
