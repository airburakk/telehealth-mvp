import type { DigestSnapshot } from "./daily-digest";

/** Saklanan baskı yapısı bozuksa okuyucuya hata durumu ver; JSON cast yeterli değildir. */
export function parseDigestSnapshot(raw: string): DigestSnapshot | null {
  try {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.sections) || value.sections.length > 6 ||
        !Number.isSafeInteger(value.overflow) || value.overflow < 0) return null;
    const keys = new Set<string>();
    for (const section of value.sections) {
      if (!section || typeof section.key !== "string" || typeof section.label !== "string" ||
          keys.has(section.key) || !Array.isArray(section.items) || section.items.length > 2) return null;
      keys.add(section.key);
      for (const item of section.items) {
        if (!item || ["id", "title", "sourceName", "summary", "kind", "publishedAt"].some(
          (key) => typeof item[key] !== "string"
        ) || !(item.url === null || typeof item.url === "string")) return null;
      }
    }
    return value as DigestSnapshot;
  } catch {
    return null;
  }
}
