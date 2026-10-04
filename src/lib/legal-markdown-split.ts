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

// ── Hukukçu düzenlemesi (7-C editörü, 2026-10-03) — birim çiftleri + değer kuralları; saf modül, istemci bileşeni de okur. ──

/** Birim çifti — TR kaynak metni (önbellek anahtarı) + aynı yapıdaki çeviride karşılığı (editör için, belge sırası). */
export type LegalUnitPair = { key: string; text: string; kind: "unit" | "cell"; prefix: string };

/** Düzenleme sınırları — editör ve uç aynı kaynaktan okur. */
export const LEGAL_EDIT_MAX_CHARS = 4000;
export const LEGAL_EDIT_MAX_UNITS = 500;

/** Düzenlenen birim değeri kuralı: tek satır, boş değil, sınır içinde. Hata metni (Türkçe) ya da null. */
export function legalEditError(value: string): string | null {
  const v = value.replace(/\r\n?/g, "\n").trim();
  if (!v) return "Boş bırakılamaz.";
  if (v.includes("\n")) return "Satır sonu kullanılamaz; paragraf tek satırdır.";
  if (v.length > LEGAL_EDIT_MAX_CHARS) return `En çok ${LEGAL_EDIT_MAX_CHARS} karakter.`;
  return null;
}

/**
 * TR kanonik + AYNI YAPIDAKİ çeviri (join ile üretilmiş: otomatik ya da dondurulmuş) → birim çiftleri, belge sırasında.
 * Yapı uyuşmuyorsa (segment sayısı/türü ya da hücre sayısı farklı) null — çağıran düzenlemeyi kapatır. Boş birimler atlanır;
 * aynı TR birimi birden çok yerde geçiyorsa her yeri listelenir (anahtar aynı → tek düzenleme hepsine uygulanır).
 */
export function legalUnitPairs(mdTr: string, mdTranslated: string): LegalUnitPair[] | null {
  const a = splitLegalMarkdown(mdTr);
  const b = splitLegalMarkdown(mdTranslated);
  if (a.length !== b.length) return null;
  const out: LegalUnitPair[] = [];
  for (let i = 0; i < a.length; i++) {
    const s = a[i];
    const t = b[i];
    if (s.kind !== t.kind) return null;
    if (s.kind === "unit" && t.kind === "unit") {
      if (s.text.trim()) out.push({ key: s.text, text: t.text, kind: "unit", prefix: s.prefix });
      continue;
    }
    if (s.kind === "row" && t.kind === "row") {
      if (s.cells.length !== t.cells.length) return null;
      s.cells.forEach((c, j) => { if (c.trim()) out.push({ key: c, text: t.cells[j], kind: "cell", prefix: "|" }); });
    }
  }
  return out;
}

/** Çeviri haritası (TR birim → çeviri) — çiftlerden; aynı anahtar tekrar ederse ilk görülen kazanır. Yapı uyuşmazsa null. */
export function legalUnitMap(mdTr: string, mdTranslated: string): Record<string, string> | null {
  const pairs = legalUnitPairs(mdTr, mdTranslated);
  if (!pairs) return null;
  const map: Record<string, string> = {};
  for (const p of pairs) if (map[p.key] === undefined) map[p.key] = p.text;
  return map;
}
