// VERİ NÖBETÇİSİ (2026-09-06, kullanıcı isteği "TUS, YÖK vb. veritabanlarını haftada bir kontrol edip güncelleyelim").
// Koşucu: .github/workflows/data-watch.yml (haftalık, Pazartesi) ya da elle:
//   node scripts/data-watch.mjs            → yalnız KONTROL + rapor (hiçbir dosya değişmez)
//   node scripts/data-watch.mjs --apply    → yeni kaynak bulunursa ingest'i koşar, veri dosyasını yazar ve kayıt defterine
//                                             `approvedAt: null` satırı ekler (👤 onay kapısı KORUNUR — yeni dönem yüzeyde GÖRÜNMEZ)
//   node scripts/data-watch.mjs --json     → makine-okunur bulgular (workflow PR/issue kararı için data-watch-findings.json da yazılır)
//
// NE KONTROL EDER (hepsi halka açık kaynak; secret gerekmez):
//   1) ÖSYM TUS yerleştirme — defterdeki son dönemden sonraki 2 dönem için "Sayısal Bilgiler" sayfası (slug) + min/max PDF bağlantısı
//   2) ÖSYM ek yerleştirme — ana defterde olup ek defterinde olmayan dönemler (iki slug varyantı; 🪤 2025/1·2026/1 dersi)
//   3) ÖSYM kılavuz — sıradaki dönemin "Kılavuz ve Başvuru Bilgileri" sayfası → rehberler (lib/tus-guides) gözden geçirilmeli
//   4) YÖK Atlas — Tercih Sihirbazı API'si: yıl (yeni yıl → ingest) ve Tıp kontenjan/yerleşen toplamı kayması (rapor)
//   5) YÖKSİS mezun — istatistik.yok.gov.tr menüsündeki en yeni "Öğretim Yılı" sayfası (Playwright; yoksis-mezun-ingest --list)
//   6) Künye/kaynak bağlantıları — lib/tus-resources + lib/tus + kılavuz PDF'i: kırık/engelli bağlantı
//   7) Kariyer EDU seed listesi — son başvurusu geçmiş / doğrulaması bayat kayıt (admin paneli hatırlatması)
// Nöbetçi bir SİNYAL üreticisidir: bulgu "başarı"dır → exit 0. Yalnız aracın kendisi çalışamazsa düşer.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  nextPeriodKeys, osymSlugs, registryKeys, guideSourcePage, patchTusRegistry, patchYokAtlasRegistry, patchYokMezunRegistry,
  mezunEndYearForPage, staleEdu,
} from "./data-watch-lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const AS_JSON = process.argv.includes("--json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TODAY = new Date().toISOString().slice(0, 10);
const rd = (p) => readFileSync(join(ROOT, p), "utf8");
const wr = (p, s) => writeFileSync(join(ROOT, p), s, "utf8");

const findings = []; // { level: "yeni" | "uyari" | "bilgi", area, text, action? }
const changes = []; // repo'da değişen dosyalar (--apply)
const note = (level, area, text) => findings.push({ level, area, text });

async function get(url, opts = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeout ?? 30000);
  try {
    const r = await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": UA, Referer: opts.referer ?? "https://www.osym.gov.tr/", Accept: opts.accept ?? "text/html,*/*", "Accept-Encoding": "identity" } });
    const text = opts.body === false ? "" : await r.text(); // 🪤 ÖSYM ana sayfası gzip akışını hiç bitirmiyor (2026-09-06: 70 sn+) → identity + gerekmedikçe gövde okunmaz
    return { status: r.status, text, ok: r.status === 200 };
  } catch (e) {
    return { status: 0, text: "", ok: false, error: String(e.message ?? e) };
  } finally { clearTimeout(t); }
}
const pdfLink = (html) => (html.match(/https?:\/\/dokuman\.osym\.gov\.tr\/pdfdokuman\/[^"' ]*?\.pdf/gi) ?? []).find((u) => /minmax/i.test(u)) ?? null;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// ── 1) + 2) + 3) ÖSYM ──────────────────────────────────────────────────────────────────────────────────────────────
async function checkOsym() {
  let tusData = rd("src/lib/tus-data.ts");
  const main = registryKeys(tusData, "TUS_SNAPSHOTS");
  const ek = registryKeys(tusData, "TUS_EK_SNAPSHOTS");
  const last = main[main.length - 1];
  // (1) yeni ana dönem
  for (const key of nextPeriodKeys(last, 2)) {
    const url = osymSlugs("main", key)[0];
    const r = await get(url);
    if (!r.ok) { note("bilgi", "ÖSYM", `${key} yerleştirme sayısal bilgiler sayfası henüz yok (${r.status || r.error}).`); continue; }
    const pdf = pdfLink(r.text);
    if (!pdf) { note("uyari", "ÖSYM", `${key} sayfası VAR ama min/max PDF bağlantısı bulunamadı: ${url}`); continue; }
    note("yeni", "ÖSYM", `YENİ DÖNEM ${key}: ${url} → ${pdf}`);
    if (APPLY) {
      const res = run("npx", ["tsx", "scripts/tus-ingest.ts", "--periods", key]);
      if (res.ok) { tusData = patchTusRegistry(tusData, key, "main"); wr("src/lib/tus-data.ts", tusData); changes.push(`src/data/tus/${key}.json`, "src/data/tus/summary.json", "src/lib/tus-data.ts"); note("yeni", "ÖSYM", `${key} ingest tamam → defterde approvedAt: null (👤 onay bekliyor). ${res.out.trim().split("\n").slice(-2).join(" | ")}`); }
      else note("uyari", "ÖSYM", `${key} ingest HATA: ${res.out.slice(-400)}`);
    }
  }
  // (2) ek yerleştirme (ana defterde olup ek'te olmayanlar — nöbetçinin bu koşuda eklediği dahil)
  const mainNow = registryKeys(tusData, "TUS_SNAPSHOTS");
  for (const key of mainNow.filter((k) => !ek.includes(k))) {
    let found = null;
    for (const url of osymSlugs("ek", key)) { const r = await get(url); if (r.ok && pdfLink(r.text)) { found = { url, pdf: pdfLink(r.text) }; break; } }
    if (!found) { note("bilgi", "ÖSYM", `${key} ek yerleştirme sayfası henüz yok.`); continue; }
    note("yeni", "ÖSYM", `YENİ EK YERLEŞTİRME ${key}: ${found.url}`);
    if (APPLY) {
      const res = run("npx", ["tsx", "scripts/tus-ingest.ts", "--kind", "ek", "--periods", key]);
      if (res.ok) { tusData = patchTusRegistry(tusData, key, "ek"); wr("src/lib/tus-data.ts", tusData); changes.push(`src/data/tus/ek-${key}.json`, "src/lib/tus-data.ts"); note("yeni", "ÖSYM", `${key} ek ingest tamam → TUS_EK_SNAPSHOTS approvedAt: null.`); }
      else note("uyari", "ÖSYM", `${key} ek ingest HATA: ${res.out.slice(-400)}`);
    }
  }
  // (3) kılavuz
  const guides = rd("src/lib/tus-guides.ts");
  const currentPage = guideSourcePage(guides);
  for (const key of nextPeriodKeys(last, 2)) {
    const url = osymSlugs("kilavuz", key)[0];
    if (url === currentPage) continue;
    const r = await get(url);
    if (r.ok) { note("uyari", "ÖSYM", `YENİ KILAVUZ ${key}: ${url} — lib/tus-guides rehberleri fark okuyarak güncellenmeli (TUS_GUIDE_SOURCE + verifiedAt); bu otomatik yapılmaz.`); break; }
  }
}

// ── 4) YÖK Atlas ──────────────────────────────────────────────────────────────────────────────────────────────────
async function checkYokAtlas() {
  let src = rd("src/lib/yok-data.ts");
  const years = registryKeys(src, "YOK_SNAPSHOTS", "year");
  const latest = Math.max(...years);
  const local = JSON.parse(rd(`src/data/yok/tip-programlari-${latest}.json`));
  const localQuota = local.rows.reduce((n, r) => n + r.quota, 0), localPlaced = local.rows.reduce((n, r) => n + r.placed, 0);
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 120000);
  let data;
  try {
    const r = await fetch("https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search", { method: "POST", signal: ctrl.signal, headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json", Origin: "https://yokatlas.yok.gov.tr", Referer: "https://yokatlas.yok.gov.tr/lisans-bolum.php?b=10206" }, body: "{}" });
    if (!r.ok) { note("uyari", "YÖK Atlas", `API ${r.status} — kontrol edilemedi.`); return; }
    data = await r.json();
  } catch (e) { note("uyari", "YÖK Atlas", `API erişilemedi: ${e.message ?? e}`); return; } finally { clearTimeout(t); }
  const tip = (data.content ?? []).filter((x) => x.birimGrupAdi === "Tıp");
  const year = data.yil ?? tip[0]?.yil;
  const quota = tip.reduce((n, r) => n + (r.kontenjan ?? 0), 0), placed = tip.reduce((n, r) => n + (r.gkY ?? 0), 0);
  if (year && year > latest) {
    note("yeni", "YÖK Atlas", `YENİ YKS YILI ${year}: ${tip.length} Tıp programı · kontenjan ${quota} · yerleşen ${placed} (defterdeki son yıl ${latest}).`);
    if (APPLY) {
      const res = run("npx", ["tsx", "scripts/yok-atlas-ingest.ts"]);
      if (res.ok) { src = patchYokAtlasRegistry(src, year); wr("src/lib/yok-data.ts", src); changes.push(`src/data/yok/tip-programlari-${year}.json`, "src/lib/yok-data.ts"); note("yeni", "YÖK Atlas", `${year} ingest tamam → YOK_SNAPSHOTS approvedAt: null.`); }
      else note("uyari", "YÖK Atlas", `ingest HATA: ${res.out.slice(-400)}`);
    }
  } else if (year === latest && (tip.length !== local.rows.length || quota !== localQuota || placed !== localPlaced)) {
    note("uyari", "YÖK Atlas", `${year} verisi kaymış: program ${local.rows.length}→${tip.length} · kontenjan ${localQuota}→${quota} · yerleşen ${localPlaced}→${placed} (ek yerleştirme/düzeltme olabilir) — yeniden çekmek için: npx tsx scripts/yok-atlas-ingest.ts → 👤 onay.`);
  } else {
    note("bilgi", "YÖK Atlas", `${year}: değişiklik yok (${tip.length} program · kontenjan ${quota}).`);
  }
}

// ── 5) YÖKSİS mezun ───────────────────────────────────────────────────────────────────────────────────────────────
async function checkYoksis() {
  let src = rd("src/lib/yok-mezun.ts");
  const years = registryKeys(src, "YOK_MEZUN_SNAPSHOTS", "endYear");
  const maxEnd = Math.max(...years);
  const list = run("node", ["scripts/yoksis-mezun-ingest.mjs", "--list"]);
  if (!list.ok) { note("uyari", "YÖKSİS", `menü okunamadı (Playwright): ${list.out.slice(-300)}`); return; }
  const labels = (list.out.match(/\d{4}-\d{4} Öğretim Yılı/g) ?? []);
  if (!labels.length) { note("uyari", "YÖKSİS", "menüde öğretim yılı etiketi bulunamadı."); return; }
  const newest = labels.map((l) => ({ l, end: mezunEndYearForPage(l) })).sort((a, b) => b.end - a.end)[0];
  if (newest.end <= maxEnd) { note("bilgi", "YÖKSİS", `en yeni sayfa "${newest.l}" → mezun ${newest.end - 1}-${newest.end} zaten defterde.`); return; }
  note("yeni", "YÖKSİS", `YENİ SAYFA "${newest.l}" → Tablo 12 mezun ${newest.end - 1}-${newest.end} bekleniyor (defterde son ${maxEnd}).`);
  if (APPLY) {
    const res = run("node", ["scripts/yoksis-mezun-ingest.mjs", "--pages", newest.l.replace(" Öğretim Yılı", "")]);
    const m = /mezun (\d{4})-(\d{4}):/.exec(res.out);
    if (res.ok && m && existsSync(join(ROOT, `src/data/yok/mezun-tip-${m[2]}.json`))) {
      src = patchYokMezunRegistry(src, Number(m[2])); wr("src/lib/yok-mezun.ts", src); changes.push(`src/data/yok/mezun-tip-${m[2]}.json`, "src/lib/yok-mezun.ts");
      note("yeni", "YÖKSİS", `mezun ${m[1]}-${m[2]} ingest tamam → YOK_MEZUN_SNAPSHOTS approvedAt: null.`);
    } else note("uyari", "YÖKSİS", `sayfa var ama Tablo 12 çekilemedi (henüz yayımlanmamış olabilir): ${res.out.slice(-300)}`);
  }
}

// ── 6) Künye / kaynak bağlantıları ───────────────────────────────────────────────────────────────────────────────────
async function checkLinks() {
  const urls = new Set();
  for (const f of ["src/lib/tus-resources.ts", "src/lib/tus.ts", "src/lib/tus-guides.ts"]) for (const m of rd(f).matchAll(/https:\/\/[^"'\s)]+/g)) urls.add(m[0]);
  let bad = 0; const unreachable = [];
  for (const url of urls) {
    const wantBody = url.includes("dokuman.osym.gov.tr"); // yalnız "Erişim Engellendi" sayfası için gövde gerekir
    const opts = { referer: "https://www.osym.gov.tr/", accept: url.endsWith(".pdf") ? "application/pdf,*/*" : undefined, timeout: 30000, body: wantBody };
    let r = await get(url, opts);
    if (r.status === 0) { await new Promise((res) => setTimeout(res, 3000)); r = await get(url, opts); }
    // 🪤 Ağ düzeyi hata (status 0: DNS/TLS/bağlantı) GitHub koşucusundan coğrafi engel olabilir — 2026-09-06 ilk koşumda tustime.com ve
    // resmigazete.gov.tr ABD koşucusundan "fetch failed", yerelden 200. Bu yüzden status 0 UYARI değil BİLGİ; kırık = HTTP ≥ 400 / engel / slug kayması.
    if (r.status === 0) { unreachable.push(`${url} (${r.error})`); continue; }
    const blocked = url.includes("dokuman.osym.gov.tr") && /Erişim Engellendi/i.test(r.text);
    const redirectHome = r.status >= 300 && r.status < 400 && url.includes("osym.gov.tr");
    if (r.status >= 400 || blocked || redirectHome) { bad++; note("uyari", "Bağlantı", `${url} → ${r.status}${blocked ? " (Erişim Engellendi)" : ""}${redirectHome ? " (ana sayfaya yönlendirme = slug değişmiş)" : ""}`); }
  }
  if (unreachable.length) note("bilgi", "Bağlantı", `${unreachable.length} bağlantıya koşucudan ulaşılamadı (coğrafi engel olabilir; yerelde \`node scripts/data-watch.mjs\` ile doğrula): ${unreachable.join(" · ")}`);
  if (!bad) note("bilgi", "Bağlantı", `${urls.size - unreachable.length} künye/kaynak bağlantısı erişilebilir${bad ? "" : ", kırık yok"}.`);
}

// ── 7) Kariyer EDU seed listesi ───────────────────────────────────────────────────────────────────────────────────
function checkEdu() {
  const src = rd("src/lib/edu-opportunities.ts");
  const list = [...src.matchAll(/id:\s*"([^"]+)"[\s\S]*?deadline:\s*("([^"]+)"|null)[\s\S]*?verifiedAt:\s*"?([A-Z0-9-]+)"?/g)].map((m) => ({ id: m[1], deadline: m[3] ?? null, verifiedAt: m[4] === "V" ? (src.match(/const V = "(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null) : m[4] }));
  const stale = staleEdu(list, TODAY);
  if (stale.length) note("uyari", "Kariyer EDU", `${stale.length} seed kaydı bayat — /admin/kariyer-edu'dan güncelle/kaldır: ${stale.map((s) => `${s.id} (${s.reason})`).join("; ")}`);
  else note("bilgi", "Kariyer EDU", `${list.length} seed kaydı güncel (son başvuru geçmemiş, doğrulama ≤ 180 gün).`);
}

await checkOsym();
await checkYokAtlas();
await checkYoksis();
await checkLinks();
checkEdu();

const yeni = findings.filter((f) => f.level === "yeni"), uyari = findings.filter((f) => f.level === "uyari"), bilgi = findings.filter((f) => f.level === "bilgi");
const summary = { date: TODAY, apply: APPLY, yeni, uyari, bilgi, changes: [...new Set(changes)] };
writeFileSync(join(ROOT, "data-watch-findings.json"), JSON.stringify(summary, null, 2) + "\n");
if (AS_JSON) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`📡 Veri nöbetçisi — ${TODAY}${APPLY ? " (--apply: yeni veri çekildi, onay bekliyor)" : " (yalnız kontrol)"}\n`);
  if (yeni.length) { console.log(`🆕 YENİ (${yeni.length}):`); for (const f of yeni) console.log(`   [${f.area}] ${f.text}`); console.log(""); }
  if (uyari.length) { console.log(`⚠️  UYARI (${uyari.length}):`); for (const f of uyari) console.log(`   [${f.area}] ${f.text}`); console.log(""); }
  console.log(`ℹ️  Bilgi (${bilgi.length}):`); for (const f of bilgi) console.log(`   [${f.area}] ${f.text}`);
  if (summary.changes.length) console.log(`\n📝 Değişen dosyalar (PR'a girer; approvedAt: null → 👤 onay + merge):\n   ${summary.changes.join("\n   ")}`);
  console.log(`\nOnay: kayıt defterindeki approvedAt satırını tarihle doldur → test/CI → merge. Sonra vault changelog'a sürüm.`);
}
