// YÖKSİS İSTATİSTİK → Tıp fakültesi MEZUN sayıları veri hattı (K5(a), 2026-09-06). KALICI ARAÇ (Node + Playwright; repoda kurulu).
//
//   node scripts/yoksis-mezun-ingest.mjs --pages 2019-2020,2020-2021,...,2025-2026 [--raw-dir <klasör>] [--headful]
//
// Kaynak: https://istatistik.yok.gov.tr — ZK (Java) arayüzü, JSON API YOK; "Yükseköğretim İstatistikleri → <öğretim yılı>" sayfasının
// "MEZUN SAYILARI" sekmesindeki **Tablo 12 — Önlisans ve lisans düzeyindeki mezun sayıları (yükseköğretim kurumları ve akademik
// birimlere göre)** Excel'i (.xls, BIFF). 🪤 Sayfa yılı ile mezun yılı FARKLI: "2024-2025 Öğretim Yılı" sayfasındaki Tablo 12
// başlığı ", 2023-2024" der (bir önceki öğretim yılının mezunları) — mezun yılı BAŞLIKTAN okunur, sayfa yılından türetilmez.
// Yöntem: menü/sekme ZK widget olayıyla açılır (zk.Widget.$ + zAu.send onClick); indirme, `zAu.cmd0.download` yamalanarak URL olarak
// yakalanır; dosya sayfa içinde fetch edilir (oturum çerezi HttpOnly → dışarıdan curl olmaz) ve SheetJS (CDN, sayfaya enjekte) ile
// okunur; satırlar Node'a JSON döner. Ham .xls `--raw-dir`e de yazılır (repo DIŞI — vault raw/yok/).
// Çıktı: src/data/yok/mezun-tip-<mezunYılıSonu>.json  { meta, rows[{ university, type, city, faculty, male, female, total }] }
// Yayın kapısı: lib/yok-data YOK_MEZUN_SNAPSHOTS 👤 approvedAt — bu betik onay VERMEZ.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://istatistik.yok.gov.tr/";
const SHEETJS = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
const TABLE_RX = /AKADEM[İI]K B[İI]R[İI]MLERE G[ÖO]RE/i;
const OUT_DIR = join(process.cwd(), "src", "data", "yok");

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
const pages = (arg("--pages") ?? "2025-2026").split(",").map((s) => s.trim()).filter(Boolean);
const rawDir = arg("--raw-dir");
const headful = process.argv.includes("--headful");

const browser = await chromium.launch({ headless: !headful });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(60000);
await page.goto(SITE, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.zk !== "undefined" && window.zk.Widget && window.zAu);
await page.addScriptTag({ url: SHEETJS });
await page.waitForFunction(() => typeof window.XLSX !== "undefined");

// ZK menü ağacından etikete göre Menuitem bul ve sunucuya onClick gönder.
async function clickMenuItem(label) {
  const ok = await page.evaluate((label) => {
    const kids = (w) => { const out = []; for (let c = w && w.firstChild; c; c = c.nextSibling) out.push(c); return out; };
    let found = null;
    const walk = (w, d) => { if (!w || d > 5 || found) return; if (w.className === "zul.menu.Menuitem" && w.getLabel && w.getLabel().trim() === label) { found = w; return; } if (w.className === "zul.menu.Menu" && w.menupopup) kids(w.menupopup).forEach((c) => walk(c, d + 1)); else kids(w).forEach((c) => walk(c, d + 1)); };
    for (const el of document.querySelectorAll(".z-menubar")) walk(window.zk.Widget.$(el), 0);
    if (!found) return false;
    window.zAu.send(new window.zk.Event(found, "onClick", {}, { toServer: true }));
    return true;
  }, label);
  if (!ok) throw new Error(`menü öğesi bulunamadı: ${label}`);
}

async function fetchTable12(pageLabel) {
  await clickMenuItem(pageLabel);
  await page.getByText("MEZUN SAYILARI", { exact: true }).first().waitFor();
  await page.getByText("MEZUN SAYILARI", { exact: true }).first().click();
  await page.waitForFunction((src) => [...document.querySelectorAll(".z-row, tr")].some((r) => r.offsetParent !== null && new RegExp(src, "i").test(r.innerText || "") && (r.innerText || "").trim().length < 200), TABLE_RX.source);
  const result = await page.evaluate(async (src) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__dl = [];
    if (!window.__patched) { window.zAu.cmd0.download = function (url) { window.__dl.push(url); }; window.__patched = true; }
    const row = [...document.querySelectorAll(".z-row, tr")].find((r) => r.offsetParent !== null && new RegExp(src, "i").test(r.innerText || "") && (r.innerText || "").trim().length < 200);
    const xls = [...row.querySelectorAll(".z-image")].find((i) => /xls/i.test(i.getAttribute("src") || ""));
    if (!xls) throw new Error("xls simgesi yok");
    window.zAu.send(new window.zk.Event(window.zk.Widget.$(xls), "onClick", {}, { toServer: true }));
    for (let i = 0; i < 60 && window.__dl.length === 0; i++) await sleep(250);
    const url = window.__dl[0]; if (!url) throw new Error("indirme URL'si yakalanamadı");
    const resp = await fetch(url, { credentials: "include" });
    const buf = new Uint8Array(await resp.arrayBuffer());
    const wb = window.XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    let b64 = ""; for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { url, bytes: buf.length, sheet: wb.SheetNames[0], rows, b64: btoa(b64) };
  }, TABLE_RX.source);
  return result;
}

// 🪤 Sütun düzeni yıla göre DEĞİŞİR: 2018/19–2020/21 dosyalarında TÜRÜ · İL · İLÇE · E · K · T (7 sütun), sonrakilerde İLÇE yok
// (6 sütun) → E/K/T indeksleri BAŞLIK satırından bulunur, sabit yazılmaz. Birim adlarında dipnot yıldızı olabilir ("MERAM TIP FAKÜLTESİ**").
function normalize(rows) {
  const title = String(rows[0]?.[0] ?? "");
  const ym = title.match(/(\d{4})-(\d{4})\s*$/m) || title.match(/,\s*(\d{4})-(\d{4})/);
  if (!ym) throw new Error(`başlıkta mezun yılı yok: ${title.slice(0, 120)}`);
  const gradYear = `${ym[1]}-${ym[2]}`;
  const header = rows.find((r) => r.some((c) => typeof c === "string" && /^T[ÜU]R[ÜU]\//i.test(c.trim())));
  if (!header) throw new Error("başlık satırı (TÜRÜ/TYPE) bulunamadı");
  const col = (label) => header.findIndex((c) => typeof c === "string" && c.trim() === label);
  const iType = col("TÜRÜ/TYPE"), iCity = col("İL/PROVINCE"), iE = col("E"), iK = col("K"), iT = col("T");
  if ([iType, iCity, iE, iK, iT].some((i) => i < 0)) throw new Error(`başlık sütunları eksik: ${JSON.stringify(header)}`);
  const tr = (s) => String(s).split("\n")[0].replace(/\*+\s*$/, "").trim(); // "TIP FAKÜLTESİ\nSCHOOL OF MEDICINE" → Türkçe ad; dipnot yıldızı düşer
  const num = (v) => (typeof v === "number" ? v : v == null || v === "" ? 0 : Number(String(v).replace(/[^\d]/g, "")) || 0);
  let uni = null; const out = []; let total = null;
  for (const r of rows.slice(1)) {
    const name = r[0]; if (typeof name !== "string" || !name.trim()) continue;
    if (/^TOPLAM/i.test(name.trim())) { total = { male: num(r[iE]), female: num(r[iK]), total: num(r[iT]) }; continue; }
    // 🪤 Eski dosyalarda tür/il hücreleri de iki dilli ("DEVLET\nSTATE") → tr() ile Türkçe satır alınır.
    if (r[iType] && typeof r[iType] === "string" && r[iType].trim()) { uni = { university: tr(name), type: tr(r[iType]), city: r[iCity] ? tr(r[iCity]) || null : null }; continue; }
    if (/T[Iİ]P FAK/i.test(name) && uni) out.push({ ...uni, faculty: tr(name), male: num(r[iE]), female: num(r[iK]), total: num(r[iT]) });
  }
  return { title: tr(title), gradYear, total, tipRows: out, columns: header.length };
}

mkdirSync(OUT_DIR, { recursive: true });
if (rawDir) mkdirSync(rawDir, { recursive: true });
for (const pageLabel of pages) {
  const label = `${pageLabel} Öğretim Yılı`;
  try {
    const t = await fetchTable12(label);
    const n = normalize(t.rows);
    const endYear = Number(n.gradYear.split("-")[1]);
    if (rawDir) writeFileSync(join(rawDir, `yoksis-tablo12-mezun-${n.gradYear}.xls`), Buffer.from(t.b64, "base64"));
    const sum = n.tipRows.reduce((a, r) => a + (r.total || 0), 0);
    const out = {
      meta: {
        gradYear: n.gradYear, endYear, pageLabel: label, tableTitle: n.title, sourcePage: SITE, sourceFile: t.url.split("/").pop(), fetchedAt: new Date().toISOString().slice(0, 10),
        method: "YÖKSİS İstatistik → Yükseköğretim İstatistikleri → öğretim yılı → MEZUN SAYILARI → Tablo 12 (.xls); yalnız adı 'TIP FAKÜLTESİ' içeren birimler",
        nationalUndergraduateGraduates: n.total, tipFaculties: n.tipRows.length, tipGraduates: sum,
      },
      rows: n.tipRows,
    };
    writeFileSync(join(OUT_DIR, `mezun-tip-${endYear}.json`), JSON.stringify(out), "utf-8");
    console.log(`${label} → mezun ${n.gradYear}: ${n.tipRows.length} tıp fakültesi · ${sum} mezun (tablo ${t.rows.length} satır, ${t.bytes} B)`);
  } catch (e) {
    console.error(`${label} → HATA: ${e.message}`);
  }
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.zk !== "undefined" && window.zAu);
  await page.addScriptTag({ url: SHEETJS });
  await page.waitForFunction(() => typeof window.XLSX !== "undefined");
}
await browser.close();
