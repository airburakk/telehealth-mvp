// Hukuki markdown'ı ÇEVRİLEBİLİR BİRİMLERE ayırma / geri birleştirme — saf modül (Paket 7, v6.285 · 2026-09-20).
//
// Amaç: A01/A02/… yayın kesitlerini (TR kanonik) hastanın diline paragraf paragraf çevirmek; markdown yapısı
// (## başlık · - / 1. liste · > blockquote · | tablo | · --- · boş satır) ÇEVİRİ DIŞINDA kalır, yalnız metin gider.
// lib/doctorium-legal/markdown ayrıştırıcısıyla aynı satır kuralları: ardışık düz satırlar TEK paragraf birimidir
// (ayrıştırıcı da boşlukla birleştirir), tablo hücreleri ayrı birimdir, liste maddesinin girintili devam satırı
// maddeye eklenir. Geri birleştirme aynı öneklerle yazar → `parseLegalMarkdown(join(split(md), kimlik))` yapısal
// olarak `parseLegalMarkdown(md)` ile aynıdır (test kilidi).
//
// Hash/ispat: çeviri BİLGİLENDİRME amaçlıdır — kanonik TR/EN hash'i değişmez; gösterilen çevirinin kendi hash'i
// ConsentRecord.shownTextHash'e ayrıca yazılır (lib/consent).

export type LegalSegment =
  | { kind: "raw"; line: string }
  | { kind: "unit"; prefix: string; text: string }
  | { kind: "row"; cells: string[] }; // tablo satırı — her hücre ayrı birim

const listStart = (l: string) => /^(\s*)([-*]|\d+\.)\s+/.exec(l);
const isTableSep = (l: string) => /^\s*\|?\s*:?-{3,}/.test(l) && l.includes("-");
const isStructural = (l: string) =>
  l.trim() === "" || l.startsWith(">") || /^#{1,3}\s/.test(l) || /^---+\s*$/.test(l) || !!listStart(l) || l.trim().startsWith("|");

/** Markdown → segmentler. Blockquote satırları `>` önekiyle aynı kurallardan geçer (iç yapı korunur). */
export function splitLegalMarkdown(md: string): LegalSegment[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: LegalSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || /^---+\s*$/.test(line)) { out.push({ kind: "raw", line }); i++; continue; }
    if (line.startsWith(">")) {
      // blockquote: satır satır, önek "> " + iç kural (başlık/liste/paragraf satırı)
      const m = /^(>\s?)(.*)$/.exec(line)!;
      const inner = m[2];
      if (inner.trim() === "" || /^---+\s*$/.test(inner)) { out.push({ kind: "raw", line }); i++; continue; }
      const h = /^(#{1,3}\s+)(.*)$/.exec(inner);
      const ls = listStart(inner);
      if (h) out.push({ kind: "unit", prefix: m[1] + h[1], text: h[2] });
      else if (ls) out.push({ kind: "unit", prefix: m[1] + ls[0], text: inner.slice(ls[0].length) });
      else out.push({ kind: "unit", prefix: m[1], text: inner });
      i++; continue;
    }
    const h = /^(#{1,3}\s+)(.*)$/.exec(line);
    if (h) { out.push({ kind: "unit", prefix: h[1], text: h[2].trim() }); i++; continue; }
    if (line.trim().startsWith("|")) {
      if (isTableSep(line)) { out.push({ kind: "raw", line }); i++; continue; }
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      out.push({ kind: "row", cells });
      i++; continue;
    }
    const ls = listStart(line);
    if (ls) {
      // madde + girintili devam satırları tek birim (ayrıştırıcı boşlukla birleştirir)
      let text = line.slice(ls[0].length);
      i++;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !listStart(lines[i])) { text += " " + lines[i].trim(); i++; }
      out.push({ kind: "unit", prefix: ls[0], text });
      continue;
    }
    // paragraf: yapısal satıra kadar ardışık düz satırlar → tek birim
    const para: string[] = [];
    while (i < lines.length && !isStructural(lines[i])) { para.push(lines[i].trim()); i++; }
    out.push({ kind: "unit", prefix: "", text: para.join(" ") });
  }
  return out;
}

/** Çevrilecek benzersiz metinler (boşlar hariç). */
export function legalUnits(segments: readonly LegalSegment[]): string[] {
  const set = new Set<string>();
  for (const s of segments) {
    if (s.kind === "unit" && s.text.trim()) set.add(s.text);
    if (s.kind === "row") for (const c of s.cells) if (c.trim()) set.add(c);
  }
  return [...set];
}

/** Segmentler + çeviri haritası → markdown. Haritada olmayan birim özgün kalır (fail-open: TR paragraf görünür, sayfa bozulmaz). */
export function joinLegalMarkdown(segments: readonly LegalSegment[], map: Record<string, string>): string {
  const tr = (s: string) => (s.trim() ? (map[s] ?? s) : s);
  return segments
    .map((s) => {
      if (s.kind === "raw") return s.line;
      if (s.kind === "row") return `| ${s.cells.map(tr).join(" | ")} |`;
      return s.prefix + tr(s.text);
    })
    .join("\n");
}
