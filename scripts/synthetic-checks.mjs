// Sentetik rota kontrolleri (Faz 5 Ray C, 2026-07-16; AURA+Doctorium 2026-08-25) — üretimi
// DIŞARIDAN denetler.
// Koşucu: .github/workflows/synthetic.yml (~30 dk'da bir) veya elle:
//   node scripts/synthetic-checks.mjs                       → AURA + Doctorium canlı üretimi (ikisi)
//   node scripts/synthetic-checks.mjs --base=http://localhost:3000  → tek hedef (yerel/preview, AURA rotaları)
//
// Ne denetler (blueprint: halka açık deneyim izleme):
//   rota başına  → HTTP durum · yanıt süresi · <title> · birincil başlık (h1) · kritik CTA href'i ·
//                  noindex beklentisi (locale KAPALI kararı + personel kapısı BURADA kodlANIR;
//                  kök rotalarda kazara noindex de aynı kontrolle yakalanır)
//   küresel      → TLS sertifika bitimine kalan gün (<14 = hata) · /_next statik asset erişilebilirliği
//   yalnız varsayılan (çoklu-hedef) modda → marka-korkuluğu redirect'leri: doctorium.tr'deki AURA-only
//                  yüzeyler (next.config AURA_ONLY_PREFIXES) gerçekten AURA'ya gidiyor mu + com.tr/www
//                  doctorium.tr'ye toplanıyor mu (kimlik/hasta yüzeyleri Doctorium'da YAŞAMAMALI).
//
// Beklenti metinleri 2026-07-16 (AURA) + 2026-08-25 (Doctorium) canlı kalibrasyonundan alındı; vitrin
// metni bilinçli değişirse burası da güncellenir (sözlük/çeviri regresyonlarını yakalamak bu
// kontrolün AMACIDIR, yan etkisi değil).
// Başarısızlıkta exit 1 → workflow düşer → GitHub bildirim e-postası. Yalnız halka açık GET; PHI yok.

import { connect } from "node:tls";

const explicitBase = process.argv.find((a) => a.startsWith("--base="))?.slice(7).replace(/\/$/, "");
const TIMEOUT_MS = 30_000;
const SLOW_MS = 8_000; // Neon uyanması + soğuk fonksiyon ilk isteği yavaşlatabilir → yavaşlık raporlanır ama düşürmez
const CERT_MIN_DAYS = 14;

const AURA_BASE = "https://telehealth-mvp-roan.vercel.app";
const DOCTORIUM_BASE = "https://doctorium.tr";

// title/h1/cta = HAM HTML'de aranan alt dize (büyük/küçük duyarsız). h1: null = bu rotada h1 denetlenmez.
// noindex: true = meta robots noindex ZORUNLU, false = YASAK.
const AURA_ROUTES = [
  { path: "/",                  title: "Care, without borders",      h1: "Care, without borders", cta: "/giris",                  noindex: false },
  { path: "/tr",                title: "Bakım, sınırların ötesinde", h1: "Bakım",                 cta: "/giris",                  noindex: true },
  { path: "/ar",                title: "رعاية بلا حدود",              h1: "رعاية",                  cta: "/giris",                  noindex: true },
  { path: "/how-it-works",      title: "How it works",               h1: "works",                 cta: "/kayit/hasta",            noindex: false },
  { path: "/guven-ve-gizlilik", title: "Trust",                      h1: "Trust",                 cta: "/kayit/hasta",            noindex: false },
  { path: "/for-clinicians",    title: "For clinicians",             h1: "Practice across borders", cta: "/kurumsal-giris",        noindex: false },
  // Doctorium landing V2 (2026-08-23): h1 "Her doktor kendi Doctorium'unu oluşturur." (lockup
  // span'leri extract'ta soyulur). CTA = doktor kaydı — ayrışma Faz B (2026-08-24) ile Doctorium
  // kabuklu /doctorium/kayit. Metin bilinçli değişirse burayı da güncelle.
  { path: "/doctorium",         title: "Doctorium",                  h1: "Her doktor kendi",      cta: "/doctorium/kayit",        noindex: false },
  // Kapı-içi form (2026-08-06): /e-posta alt rotaları kaldırıldı — kapı CTA'sı doğrudan OAuth
  // başlangıcı. ⚠️ Kontrol `href="<cta>"` TAM eşleşmesi yapar → query dahil yazılır
  // (ilk sürümde ?intent'siz yazılmıştı; kapanış tırnağı eşleşmedi, iki kontrol yanlış düştü).
  { path: "/giris",             title: "Sign in",                    h1: "Welcome",               cta: "/api/auth/apple/start?intent=patient",  noindex: false },
  { path: "/kurumsal-giris",    title: "Corporate sign-in",          h1: "Corporate sign-in",     cta: "/api/auth/google/start?intent=doctor",  noindex: true },
];

// Doctorium.tr — ayrı Vercel projesi (BRAND_MODE=doctorium, [[doctorium-ayri-proje]]). "/" next.config
// rewrite'ıyla /doctorium içeriğini sunar (URL temiz kalır, canonical tek); beklenti AURA_ROUTES'taki
// /doctorium ile AYNI sayfa komponenti olduğu için birebir aynı (2026-08-25 canlı kalibrasyonu: curl
// ile doğrulandı, title/h1/CTA aşağıdakiyle eşleşti).
//
// /doctorium/giris + /doctorium/kayit (2026-08-28 eklendi): next.config AURA_ONLY_PREFIXES'te
// BARE "/giris"/"/kayit" var ama bu iki iç-içe rota YOK → marka korkuluğuna takılmadan doctorium.tr'de
// CANLI kalıyorlar — doktor kaydı/girişi zincirinin doctorium.tr üzerindeki tek fiili giriş noktaları
// (landing "Doctorium'unu oluştur"/"Giriş yap" CTA'ları buraya gelir). Şimdiye dek hiç izlenmiyorlardı;
// "Doctorium önden sürülüyor" önceliğiyle doğrudan ilişkili (kod-doğrulanmış: DOM'dan title/h1/cta,
// 2026-08-28). /giris noindex (kapı sözleşmesi — bkz. AURA /giris·/kurumsal-giris aynı desen);
// /kayit indexlenir (page.tsx `alternates.canonical` bilinçli SEO-hedef).
// /doctorium/giris CTA'sı v6.185'ten (6181d7f) beri ?next taşır: DoctoriumGate `sp.get("next")
// ?? DOCTORIUM_HOME` varsayılanıyla OAuth başlangıcına daima next=/doktor/doctorium ekler —
// Doctorium kapısından girenin varışı Doctorium'dur (marka garantisi). Parametre düşerse/saparsa
// doktor yine AURA paneline iner; tam eşleşme bu garantiyi de denetler. ⚠️ Ham HTML'de arama
// yapıldığı için `&` React'in kaçırdığı biçimde `&amp;` yazılır (kayit sayfası next'siz kalır).
const DOCTORIUM_ROUTES = [
  { path: "/",                title: "Doctorium",     h1: "Her doktor kendi", cta: "/doctorium/kayit",                        noindex: false },
  { path: "/doctorium/giris", title: "Giriş",          h1: "Hoş Geldiniz",     cta: "/api/auth/google/start?intent=doctor&amp;next=%2Fdoktor%2Fdoctorium", noindex: true },
  { path: "/doctorium/kayit", title: "Kayıt",          h1: "Doktor Kaydı",     cta: "/api/auth/google/start?intent=doctor",    noindex: false },
];

// Marka korkuluğu (next.config.ts AURA_ONLY_PREFIXES + domain-canonicalization): kimlik/hasta
// yüzeyleri Doctorium'da YAŞAMAMALI. next.config redirect listesi bozulursa burası kırmızı yanar.
const DOCTORIUM_REDIRECTS = [
  { base: DOCTORIUM_BASE, path: "/giris", status: 307, locationStartsWith: `${AURA_BASE}/giris` },
  { base: "https://doctorium.com.tr", path: "/", status: 308, locationStartsWith: `${DOCTORIUM_BASE}/` },
  { base: "https://www.doctorium.tr", path: "/", status: 308, locationStartsWith: `${DOCTORIUM_BASE}/` },
];

// --base= verilirse (yerel/preview elle koşum) TEK hedef, AURA rota setiyle — mevcut DEPLOY.md akışı
// değişmez. Verilmezse (workflow varsayılanı) AURA + Doctorium ikisi de + marka-korkuluğu redirect'leri.
const TARGETS = explicitBase
  ? [{ name: "custom", base: explicitBase, routes: AURA_ROUTES }]
  : [
      { name: "AURA", base: AURA_BASE, routes: AURA_ROUTES },
      { name: "Doctorium", base: DOCTORIUM_BASE, routes: DOCTORIUM_ROUTES },
    ];

function extract(re, html) {
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
}

async function checkRoute(base, r) {
  const problems = [];
  const t0 = Date.now();
  let res, html;
  try {
    res = await fetch(base + r.path, {
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

// Redirect-only kontrol (marka korkuluğu): durum kodu + Location öneki. Gövde okunmaz.
async function checkRedirect(rd) {
  const label = `${new URL(rd.base).hostname}${rd.path} →`;
  const t0 = Date.now();
  try {
    const res = await fetch(rd.base + rd.path, {
      redirect: "manual",
      headers: { "user-agent": "aura-synthetic-check/1.0 (+github-actions)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    const location = res.headers.get("location") ?? "";
    const problems = [];
    if (res.status !== rd.status) problems.push(`durum ${res.status} (${rd.status} beklenir)`);
    if (!location.startsWith(rd.locationStartsWith)) problems.push(`location beklenmiyor: "${location}" ("${rd.locationStartsWith}" ile başlamalı)`);
    return { path: label, ms, problems };
  } catch (e) {
    return { path: label, ms: Date.now() - t0, problems: [`istek başarısız: ${e?.cause?.code ?? e?.name ?? e}`] };
  }
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
async function checkAsset(base) {
  try {
    const html = await (await fetch(base + "/", { signal: AbortSignal.timeout(TIMEOUT_MS) })).text();
    const m = html.match(/(?:src|href)="(\/_next\/static\/[^"]+)"/);
    if (!m) return "ana sayfada /_next/static referansı bulunamadı";
    const res = await fetch(base + m[1], { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status === 200 ? null : `asset ${m[1].slice(0, 80)} → durum ${res.status}`;
  } catch (e) {
    return `asset kontrolü başarısız: ${e?.name ?? e}`;
  }
}

const failures = [];
const runRoutes = async (base, routes) => {
  const out = [];
  for (const r of routes) out.push(await checkRoute(base, r)); // sırayla — hedefe nazik, süre ölçümü gürültüsüz
  return out;
};

for (const t of TARGETS) {
  console.log(`\nSentetik kontroller → ${t.name} (${t.base}) (${new Date().toISOString()})`);

  let results = await runRoutes(t.base, t.routes);

  // Geçici ağ dalgalanması 30 dk'lık kadansta yanlış alarm üretmesin: düşen rotalara 5 sn sonra tek tekrar.
  const failedPaths = results.filter((r) => r.problems.length).map((r) => r.path);
  if (failedPaths.length) {
    await new Promise((res) => setTimeout(res, 5_000));
    const retried = await runRoutes(t.base, t.routes.filter((r) => failedPaths.includes(r.path)));
    results = results.map((r) => retried.find((x) => x.path === r.path) ?? r);
  }

  for (const r of results) {
    const mark = r.problems.length ? "✗" : "✓";
    const slow = r.slow ? ` ⚠ yavaş (>${SLOW_MS / 1000}sn)` : "";
    console.log(` ${mark} ${r.path.padEnd(20)} ${String(r.ms).padStart(5)}ms${slow}${r.problems.length ? " — " + r.problems.join(" · ") : ""}`);
    if (r.problems.length) failures.push(`${t.name} ${r.path}: ${r.problems.join(" · ")}`);
  }

  try {
    const days = await certDaysLeft(new URL(t.base).hostname);
    console.log(` ${days < CERT_MIN_DAYS ? "✗" : "✓"} TLS sertifika: ${days} gün kaldı`);
    if (days < CERT_MIN_DAYS) failures.push(`${t.name} TLS sertifikasına ${days} gün kaldı (<${CERT_MIN_DAYS})`);
  } catch (e) {
    if (t.base.startsWith("https://")) { console.log(` ✗ TLS sertifika kontrolü: ${e.message}`); failures.push(`${t.name} TLS kontrolü başarısız: ${e.message}`); }
  }

  const assetProblem = await checkAsset(t.base);
  console.log(` ${assetProblem ? "✗" : "✓"} statik asset ${assetProblem ? "— " + assetProblem : "erişilebilir"}`);
  if (assetProblem) failures.push(`${t.name} ${assetProblem}`);
}

// Yalnız varsayılan (çoklu-hedef) modda: marka-korkuluğu redirect kontrolleri (tek hedef elle
// koşumunda anlamsız — o zaten hangi projeyi hedeflediğini biliyor).
if (!explicitBase) {
  console.log(`\nMarka-korkuluğu redirect kontrolleri`);
  for (const rd of DOCTORIUM_REDIRECTS) {
    const r = await checkRedirect(rd);
    const mark = r.problems.length ? "✗" : "✓";
    console.log(` ${mark} ${r.path.padEnd(45)} ${String(r.ms).padStart(5)}ms${r.problems.length ? " — " + r.problems.join(" · ") : ""}`);
    if (r.problems.length) failures.push(`redirect ${r.path}: ${r.problems.join(" · ")}`);
  }
}

if (failures.length) {
  console.error(`\nSONUÇ: ${failures.length} kontrol BAŞARISIZ`);
  process.exit(1);
}
console.log("\nSONUÇ: tüm kontroller geçti");
