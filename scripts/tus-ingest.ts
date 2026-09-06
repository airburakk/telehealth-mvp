// TUS yerleştirme verisi — ÖSYM "En Küçük ve En Büyük Puanlar" PDF hattı (veri fazları planı A.2 / K1, 2026-09-05).
// Kalıcı araç. Koşum: npx tsx scripts/tus-ingest.ts [--periods 2025-2,2026-1] [--raw-dir <klasör>] [--no-fetch] [--kind ek]
//   --kind ek (K2, 2026-09-06): aynı hat EK YERLEŞTİRME min/max tablolarını çeker → src/data/tus/ek-<dönem>.json (summary.json'a DOKUNMAZ;
//   kurum tablosunda "Ek yerleştirme" sütunu). Ek sayfası slug'ı çoğu dönemde "…-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler";
//   2025/1 ve 2026/1'de ÖSYM "…-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu" slug'ını kullandı (Duyurular/Index dizininden bulunur).
//
//   1) ÖSYM "Yerleştirme Sonuçlarına İlişkin Sayısal Bilgiler" sayfasından PDF bağlantısını alır (slug adres; eski
//      /TR,<id>/ adresleri 404). 🪤 dokuman.osym.gov.tr Referer başlığı olmadan "Erişim Engellendi" HTML'i döner
//      (200!) → tarayıcı UA + Referer + Accept: application/pdf ile iner; %PDF- imzası doğrulanır.
//   2) unpdf ile metin → lib/tus-normalize parseMinMaxLines → kompakt satırlar (TusRowTuple).
//   3) src/data/tus/<yıl>-<dönem>.json (meta + rows) ve src/data/tus/summary.json (grafik özetleri) yazılır.
//   4) Ham PDF, izlenebilirlik için --raw-dir'e kaydedilir (repo DIŞI — vault raw/tus; 10 dönem ≈ 25 MB).
//
// İnsan onayı: yazılan dosya YAYINA ÇIKMAZ — lib/tus-data.ts TUS_SNAPSHOTS kaydında approvedAt 👤 doldurulmadan
// hiçbir yüzey o dönemi göstermez. Betik sonunda dönem başına doğrulama raporu (satır, atlanan, toplamlar) basılır.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMinMaxLines, summarizePeriod, type TusRowTuple } from "../src/lib/tus-normalize";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const OUT = join(process.cwd(), "src", "data", "tus");

/** Dönem → ÖSYM sayısal bilgiler sayfası (slug). PDF adresi sayfadan çözülür; çözülemezse buradaki yedek adres. */
const PERIODS: { key: string; year: number; term: 1 | 2; page: string; pdfFallback: string }[] = [
  { key: "2021-2", year: 2021, term: 2, page: "https://www.osym.gov.tr/2021tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2021/TUSDONEM2/TERCIH/minmaxgnyb21102021.pdf" },
  { key: "2022-1", year: 2022, term: 1, page: "https://www.osym.gov.tr/2022tus-1-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2022/TUSDONEM1/minmax-gnyu28042022.pdf" },
  { key: "2022-2", year: 2022, term: 2, page: "https://www.osym.gov.tr/2022tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2022/TUSDONEM2/TERCIH/minmax04112022.pdf" },
  { key: "2023-1", year: 2023, term: 1, page: "https://www.osym.gov.tr/2023tus-1-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2023/TUSDONEM1/TERCIH/minmax16062023.pdf" },
  { key: "2023-2", year: 2023, term: 2, page: "https://www.osym.gov.tr/2023tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2023/TUSDONEM-2/TERCIH/minmax17112023.pdf" },
  { key: "2024-1", year: 2024, term: 1, page: "https://www.osym.gov.tr/2024tus-1-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2024/TUSDONEM-1/TERCIH/minmax_td03062024.pdf" },
  { key: "2024-2", year: 2024, term: 2, page: "https://www.osym.gov.tr/2024tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2024/TUSDONEM-2/TERCIH/minmax_yd05112024.pdf" },
  { key: "2025-1", year: 2025, term: 1, page: "https://www.osym.gov.tr/2025tus-1-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2025/TUSDONEM-1/TERCIH/minmax03062025.pdf" },
  { key: "2025-2", year: 2025, term: 2, page: "https://www.osym.gov.tr/2025tus-2-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2025/TUSDONEM-2/YERLESTIRME/minmax_ts2yd10102025.pdf" },
  { key: "2026-1", year: 2026, term: 1, page: "https://www.osym.gov.tr/2026tus-1-donem-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2026/TUSDONEM-1/YERLESTIRME/SB/minmax_ts1d21052026.pdf" },
];

/** EK YERLEŞTİRME (K2): dönem → ÖSYM ek yerleştirme sayısal bilgiler sayfası + PDF yedeği. Sayfası bulunamayan dönemde page = duyuru, pdfFallback zorunlu. */
const EK_PERIODS: { key: string; year: number; term: 1 | 2; page: string; pdfFallback: string }[] = [
  { key: "2021-2", year: 2021, term: 2, page: "https://www.osym.gov.tr/2021tus-2-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2021/TUSDONEM2/TERCIH/EK/minmaxgenel-yu09122021.pdf" },
  { key: "2022-1", year: 2022, term: 1, page: "https://www.osym.gov.tr/2022tus-1-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2022/TUSDONEM1/EK/minmax-gnyu15062022.pdf" },
  { key: "2022-2", year: 2022, term: 2, page: "https://www.osym.gov.tr/2022tus-2-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2022/TUSDONEM2/TERCIH/EK/minmax_gnyu22122022.pdf" },
  { key: "2023-1", year: 2023, term: 1, page: "https://www.osym.gov.tr/2023tus-1-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2023/TUSDONEM1/TERCIH/EK/minmaxed21082023.pdf" },
  { key: "2023-2", year: 2023, term: 2, page: "https://www.osym.gov.tr/2023tus-2-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2023/TUSDONEM-2/TERCIH/EK/minmax_ekd28122023.pdf" },
  { key: "2024-1", year: 2024, term: 1, page: "https://www.osym.gov.tr/2024tus-1-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2024/TUSDONEM-1/TERCIH/EK/minmax29072024.pdf" },
  { key: "2024-2", year: 2024, term: 2, page: "https://www.osym.gov.tr/2024tus-2-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2024/TUSDONEM-2/TERCIH/EK/tusek_minmax_20122024.pdf" },
  // 🪤 2025/1 ve 2026/1: ÖSYM "…-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu" slug'ını kullandı (Duyurular/Index dizininden bulundu; "genel-yabanci" 302 döner).
  { key: "2025-1", year: 2025, term: 1, page: "https://www.osym.gov.tr/2025tus-1-donem-ek-yerlestirme-sonuclarina-iliskin-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2025/TUSDONEM-1/TERCIH/EK/minmax_ts1ed14072025.pdf" },
  { key: "2025-2", year: 2025, term: 2, page: "https://www.osym.gov.tr/2025tus-2-donem-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2025/TUSDONEM-2/TERCIH/EK/minmax_ts2ed26112025.pdf" },
  { key: "2026-1", year: 2026, term: 1, page: "https://www.osym.gov.tr/2026tus-1-donem-ek-yerlestirme-sonuclarina-iliskin-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu", pdfFallback: "https://dokuman.osym.gov.tr/pdfdokuman/2026/TUSDONEM-1/EK/ek_minmax02072026.pdf" },
];

function arg(name: string): string | null { const i = process.argv.indexOf(name); return i >= 0 ? (process.argv[i + 1] ?? null) : null; }

async function fetchText(url: string, referer: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Referer: referer, Accept: "text/html,*/*" } });
  return await r.text();
}
async function fetchPdf(url: string, referer: string): Promise<Uint8Array> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Referer: referer, Accept: "application/pdf,*/*" } });
  const buf = new Uint8Array(await r.arrayBuffer());
  const sig = Buffer.from(buf.slice(0, 5)).toString("latin1");
  if (!sig.startsWith("%PDF-")) throw new Error(`PDF değil (${r.status}, ${buf.length} B, imza ${JSON.stringify(sig)}) — Referer/bot koruması?`);
  return buf;
}
function resolvePdfUrl(html: string): string | null {
  const m = html.match(/https?:\/\/dokuman\.osym\.gov\.tr\/pdfdokuman\/[^"' ]*?\.pdf/gi) ?? [];
  const pick = m.find((u) => /minmax/i.test(u)) ?? m.find((u) => /kucuk|puan/i.test(u)) ?? null;
  return pick ? pick.replace(/^http:/, "https:") : null;
}

async function main() {
  const only = (arg("--periods") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const rawDir = arg("--raw-dir"); const noFetch = process.argv.includes("--no-fetch");
  const kind = arg("--kind") === "ek" ? "ek" : "main"; const list = kind === "ek" ? EK_PERIODS : PERIODS; const prefix = kind === "ek" ? "ek-" : "";
  const { extractText, getDocumentProxy } = await import("unpdf");
  mkdirSync(OUT, { recursive: true }); if (rawDir) mkdirSync(rawDir, { recursive: true });
  // Listede olmayan anahtar (ör. veri nöbetçisinin bulduğu yeni dönem) → slug ÖSYM deseninden türetilir; PDF sayfadan çözülür (yedek yok).
  const derive = (key: string) => { const m = /^(\d{4})-([12])$/.exec(key); if (!m) throw new Error(`geçersiz dönem: ${key}`); const y = Number(m[1]), t = Number(m[2]) as 1 | 2;
    return { key, year: y, term: t, page: `https://www.osym.gov.tr/${y}tus-${t}-donem-${kind === "ek" ? "ek-" : ""}yerlestirme-sonuclarina-iliskin-sayisal-bilgiler`, pdfFallback: "" }; };
  const selected = only.length ? only.map((k) => list.find((p) => p.key === k) ?? derive(k)) : list;
  const report: string[] = [];
  for (let p of selected) {
    const rawPath = rawDir ? join(rawDir, `${prefix}minmax-${p.key}.pdf`) : null;
    let pdfUrl = p.pdfFallback; let buf: Uint8Array;
    if (noFetch && rawPath && existsSync(rawPath)) buf = new Uint8Array(readFileSync(rawPath));
    else {
      try { const html = await fetchText(p.page, "https://www.osym.gov.tr/"); pdfUrl = resolvePdfUrl(html) ?? p.pdfFallback; } catch { /* yedek adres */ }
      if (!pdfUrl && kind === "ek") { // 🪤 2025/1·2026/1 slug varyantı
        const alt = p.page.replace("-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler", "-ek-yerlestirme-sonuclarina-iliskin-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu");
        try { const html = await fetchText(alt, "https://www.osym.gov.tr/"); pdfUrl = resolvePdfUrl(html) ?? ""; if (pdfUrl) p = { ...p, page: alt }; } catch { /* yok */ }
      }
      if (!pdfUrl) throw new Error(`${p.key}: sayfadan PDF çözülemedi ve yedek adres yok (${p.page})`);
      buf = await fetchPdf(pdfUrl, p.page);
      if (rawPath) writeFileSync(rawPath, buf);
    }
    const pdf = await getDocumentProxy(buf);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const lines = text.split(/\n/);
    const { rows, skipped } = parseMinMaxLines(lines);
    const summary = summarizePeriod(p.year, p.term, rows);
    const meta = { year: p.year, term: p.term, kind, sourcePage: p.page, sourcePdf: pdfUrl, fetchedAt: new Date().toISOString().slice(0, 10), pages: totalPages, rows: rows.length, skipped: skipped.length,
      columns: ["code", "institution", "branch", "quotaType", "quota", "placed", "vacant", "minScore", "maxScore"] };
    writeFileSync(join(OUT, `${prefix}${p.key}.json`), JSON.stringify({ meta, rows: rows as TusRowTuple[] }));
    report.push(`${prefix}${p.key}: sayfa ${totalPages} · satır ${rows.length} · atlanan ${skipped.length} · kontenjan ${summary.totals.quota} · yerleşen ${summary.totals.placed} · boş ${summary.totals.vacant} · branş ${summary.byBranch.length}` +
      (skipped.length ? `\n   atlanan örnek: ${skipped.slice(0, 2).map((s) => s.slice(0, 120)).join(" | ")}` : ""));
  }
  if (kind === "ek") { console.log(report.join("\n")); console.log("ek yerleştirme: summary.json değişmedi"); return; }
  // summary.json — TÜM mevcut dönem dosyalarından (yalnız seçilenler değil) yeniden üretilir
  const summaries = PERIODS.filter((p) => existsSync(join(OUT, `${p.key}.json`))).map((p) => {
    const j = JSON.parse(readFileSync(join(OUT, `${p.key}.json`), "utf8")) as { meta: { sourcePdf: string; sourcePage: string; fetchedAt: string }; rows: TusRowTuple[] };
    return { ...summarizePeriod(p.year, p.term, j.rows), sourcePdf: j.meta.sourcePdf, sourcePage: j.meta.sourcePage, fetchedAt: j.meta.fetchedAt };
  });
  writeFileSync(join(OUT, "summary.json"), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), periods: summaries }, null, 0));
  console.log(report.join("\n"));
  console.log(`summary.json: ${summaries.length} dönem`);
}

main().catch((e) => { console.error(e); process.exit(1); });
