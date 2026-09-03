// Hukuki belge markdown'ı için SAF ayrıştırıcı (Doctorium hukuki yayın, v6.210 · 2026-09-03).
//
// Neden kendi ayrıştırıcımız: metinler bizim sabitlerimizdir (kullanıcı girdisi DEĞİL), bağımlılık
// eklemeden (react-markdown yok) ve dangerouslySetInnerHTML kullanmadan React düğümü üretmek için
// dar bir alt küme yeter: ## / ### başlık · paragraf · - ve 1. listeler (girintili devam satırları
// maddeye eklenir) · | tablo | · > blockquote (içi yeniden ayrıştırılır — liste/tablo çalışır) ·
// --- · satır içi **kalın** *italik* `kod` [bağlantı](url). Aynı metin ConsentRecord'a hash'lenir
// (1b: DOCTORIUM_KVKK) — ayrıştırıcı metni DEĞİŞTİRMEZ, yalnız yapıya ayırır.
//
// Birim testi: tests/unit/doctorium-legal.test.ts

export type Inline =
  | { t: "text"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string };

export type Block =
  | { type: "h2" | "h3" | "p"; inline: Inline[] }
  | { type: "hr" }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "quote"; blocks: Block[] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ t: "text", v: text.slice(last, idx) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ t: "bold", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) out.push({ t: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("[")) {
      const close = tok.indexOf("](");
      out.push({ t: "link", v: tok.slice(1, close), href: tok.slice(close + 2, -1) });
    } else out.push({ t: "italic", v: tok.slice(1, -1) });
    last = idx + tok.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{3,}/.test(l) && l.includes("-");
const listStart = (l: string) => /^(\s*)([-*]|\d+\.)\s+/.exec(l);

export function parseLegalMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    if (/^---+\s*$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      // "# " (tek diyez) yayın kesitlerinde yoktur; gelirse h2 sayılır.
      blocks.push({ type: h[1].length >= 3 ? "h3" : "h2", inline: parseInline(h[2].trim()) });
      i++; continue;
    }
    if (line.startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) { inner.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push({ type: "quote", blocks: parseLegalMarkdown(inner.join("\n")) });
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(splitRow(lines[i]).map(parseInline)); i++; }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const ls = listStart(line);
    if (ls) {
      const ordered = /\d/.test(ls[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const m = listStart(cur);
        if (m && /\d/.test(m[2]) === ordered) { items.push(cur.slice(m[0].length)); i++; continue; }
        // girintili devam satırı → son maddeye ekle
        if (/^\s{2,}\S/.test(cur) && items.length) { items[items.length - 1] += " " + cur.trim(); i++; continue; }
        break;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items: items.map(parseInline) });
      continue;
    }
    // paragraf: boş satıra / yapısal satıra kadar
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (cur.trim() === "" || cur.startsWith(">") || /^#{1,3}\s/.test(cur) || /^---+\s*$/.test(cur) || listStart(cur) || cur.trim().startsWith("|")) break;
      para.push(cur.trim()); i++;
    }
    blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** Başlık metninden çapa kimliği (Türkçe harfler ASCII'ye katlanır; "1. Veri Sorumlusu" → "1-veri-sorumlusu"). */
export function headingId(inline: Inline[]): string {
  const raw = inline.map((x) => x.v).join(" ");
  const fold: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };
  return raw
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => fold[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
