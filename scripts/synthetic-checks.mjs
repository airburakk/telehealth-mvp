// Sentetik rota kontrolleri (Faz 5 Ray C, 2026-07-16) — üretimi DIŞARIDAN denetler.
// Koşucu: .github/workflows/synthetic.yml (~30 dk'da bir) veya elle:
//   node scripts/synthetic-checks.mjs                       → canlı üretim
//   node scripts/synthetic-checks.mjs --base=http://localhost:3000  → yerel/preview
//
// Ne denetler (blueprint: halka açık deneyim izleme):
//   rota başına  → HTTP durum · yanıt süresi · <title> · birincil başlık (h1) · kritik CTA href'i ·
//                  noindex beklentisi (locale KAPALI kararı + personel kapısı BURADA kodlANIR;
//                  kök rotalarda kazara noindex de aynı kontrolle yakalanır)
//   küresel      → TLS sertifika bitimine kalan gün (<14 = hata) · /_next statik asset erişilebilirliği
//
// Beklenti metinleri 2026-07-16 canlı kalibrasyonundan alındı; vitrin metni bilinçli değişirse burası
// da güncellenir (sözlük/çeviri regresyonlarını yakalamak bu kontrolün AMACIDIR, yan etkisi değil).
// Başarısızlıkta exit 1 → workflow düşer → GitHub bildirim e-postası. Yalnız halka açık GET; PHI yok.

import { connect } from "node:tls";

const BASE = (process.argv.find((a) => a.startsWith("--base=")) ?? "--base=https://telehealth-mvp-roan.vercel.app").slice(7).replace(/\/$/, "");
const TIMEOUT_MS = 30_000;
const SLOW_MS = 8_000; // Neon uyanması + soğuk fonksiyon ilk isteği yavaşlatabilir → yavaşlık raporlanır ama düşürmez
const CERT_MIN_DAYS = 14;

// title/h1/cta = HAM HTML'de aranan alt dize (büyük/küçük duyarsız). h1: null = bu rotada h1 denetlenmez.
// noindex: true = meta robots noindex ZORUNLU, false = YASAK.
const ROUTES = [
  { path: "/",                  title: "Care, without borders",      h1: "Care, without borders", cta: "/giris",                  noindex: false },
  { path: "/tr",                title: "Bakım, sınırların ötesinde", h1: "Bakım",                 cta: "/giris",                  noindex: true },
  { path: "/ar",                title: "رعاية بلا حدود",              h1: "رعاية",                  cta: "/giris",                  noindex: true },
  { path: "/how-it-works",      title: "How it works",               h1: "works",                 cta: "/kayit/hasta",            noindex: false },
  { path: "/guven-ve-gizlilik", title: "Trust",                      h1: "Trust",                 cta: "/kayit/hasta",            noindex: false },
  { path: "/for-clinicians",    title: "For clinicians",             h1: "Practice across borders", cta: "/kurumsal-giris",        noindex: false },
  { path: "/giris",             title: "Sign in",                    h1: "Welcome",               cta: "/giris/e-posta",          noindex: false },
  { path: "/kurumsal-giris",    title: "Corporate sign-in",          h1: "Corporate sign-in",     cta: "/kurumsal-giris/e-posta", noindex: true },
];

function extract(re, html) {
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
}

async function checkRoute(r) {
  const problems = [];
  const t0 = Date.now();
  let res, html;
  try {
    res = await fetch(BASE + r.path, {
      redirect: "manual",
      headers: { "user-agent": "aura-synthetic-check/1.0 (+github-actions)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    html = await res.text();
  } catch (e) {
    return { path: r.path, ms: Date.now() - t0, problems: [`istek başarısız: ${e?.cause?.code ?? e?.name ?? e}`] };
  }
  const ms = Date.now() - t0;

  if (res.status !== 200) problems.push(`durum ${res.status} (200 beklenir)`);

  const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html) ?? "";
  if (!title.toLowerCase().includes(r.title.toLowerCase())) problems.push(`title beklenmiyor: "${title.slice(0, 60)}" ("${r.title}" içermeli)`);

  if (r.h1 !== null) {
    const h1 = extract(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html) ?? "";
    if (!h1.toLowerCase().includes(r.h1.toLowerCase())) problems.push(`h1 beklenmiyor: "${h1.slice(0, 60)}" ("${r.h1}" içermeli)`);
  }

  if (!html.includes(`href="${r.cta}"`)) problems.push(`kritik CTA yok: href="${r.cta}"`);

  const robotsTags = html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi) ?? [];
  const headerRobots = res.headers.get("x-robots-tag") ?? "";
  const hasNoindex = robotsTags.some((t) => /noindex/i.test(t)) || /noindex/i.test(headerRobots);
  if (r.noindex && !hasNoindex) problems.push("noindex BEKLENİYORDU ama yok (locale-kapalı/personel-kapısı kararı deliniyor)");
  if (!r.noindex && hasNoindex) problems.push("kazara noindex! (indekslenmesi gereken rota arama motoruna kapanmış)");

  return { path: r.path, ms, slow: ms > SLOW_MS, problems };
}

// TLS sertifikasının bitimine kalan gün (Vercel otomatik yeniler; yenileme aksarsa erken görünür olsun).
function certDaysLeft(host) {
  return new Promise((resolve, reject) => {
    const sock = connect({ host, port: 443, servername: host }, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      if (!cert?.valid_to) return reject(new Error("sertifika okunamadı"));
      resolve(Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000));
    });
    sock.setTimeout(10_000, () => { sock.destroy(); reject(new Error("TLS zaman aşımı")); });
    sock.on("error", reject);
  });
}

// Ana sayfanın referansladığı ilk /_next/static asset'i gerçekten sunuluyor mu (asset erişilebilirliği).
async function checkAsset() {
  try {
    const html = await (await fetch(BASE + "/", { signal: AbortSignal.timeout(TIMEOUT_MS) })).text();
    const m = html.match(/(?:src|href)="(\/_next\/static\/[^"]+)"/);
    if (!m) return "ana sayfada /_next/static referansı bulunamadı";
    const res = await fetch(BASE + m[1], { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status === 200 ? null : `asset ${m[1].slice(0, 80)} → durum ${res.status}`;
  } catch (e) {
    return `asset kontrolü başarısız: ${e?.name ?? e}`;
  }
}

const failures = [];
const runOnce = async (routes) => {
  const out = [];
  for (const r of routes) out.push(await checkRoute(r)); // sırayla — hedefe nazik, süre ölçümü gürültüsüz
  return out;
};

console.log(`Sentetik kontroller → ${BASE} (${new Date().toISOString()})`);

let results = await runOnce(ROUTES);

// Geçici ağ dalgalanması 30 dk'lık kadansta yanlış alarm üretmesin: düşen rotalara 5 sn sonra tek tekrar.
const failedPaths = results.filter((r) => r.problems.length).map((r) => r.path);
if (failedPaths.length) {
  await new Promise((res) => setTimeout(res, 5_000));
  const retried = await runOnce(ROUTES.filter((r) => failedPaths.includes(r.path)));
  results = results.map((r) => retried.find((x) => x.path === r.path) ?? r);
}

for (const r of results) {
  const mark = r.problems.length ? "✗" : "✓";
  const slow = r.slow ? ` ⚠ yavaş (>${SLOW_MS / 1000}sn)` : "";
  console.log(` ${mark} ${r.path.padEnd(20)} ${String(r.ms).padStart(5)}ms${slow}${r.problems.length ? " — " + r.problems.join(" · ") : ""}`);
  if (r.problems.length) failures.push(`${r.path}: ${r.problems.join(" · ")}`);
}

try {
  const days = await certDaysLeft(new URL(BASE).hostname);
  console.log(` ${days < CERT_MIN_DAYS ? "✗" : "✓"} TLS sertifika: ${days} gün kaldı`);
  if (days < CERT_MIN_DAYS) failures.push(`TLS sertifikasına ${days} gün kaldı (<${CERT_MIN_DAYS})`);
} catch (e) {
  if (BASE.startsWith("https://")) { console.log(` ✗ TLS sertifika kontrolü: ${e.message}`); failures.push(`TLS kontrolü başarısız: ${e.message}`); }
}

const assetProblem = await checkAsset();
console.log(` ${assetProblem ? "✗" : "✓"} statik asset ${assetProblem ? "— " + assetProblem : "erişilebilir"}`);
if (assetProblem) failures.push(assetProblem);

if (failures.length) {
  console.error(`\nSONUÇ: ${failures.length} kontrol BAŞARISIZ`);
  process.exit(1);
}
console.log("\nSONUÇ: tüm kontroller geçti");
