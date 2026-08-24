// Uzmanlık derneği NÖBETÇİSİ (v6.129, kullanıcı isteği 2026-08-19).
// Koşucu: .github/workflows/association-watch.yml (haftalık) veya elle:
//   node scripts/association-watch.mjs                 → tüm dernekler, rapor
//   node scripts/association-watch.mjs --json          → makine-okunur (ajan iş listesi)
//   node scripts/association-watch.mjs --slug=tkd      → tek dernek
//
// ── NE YAPAR / NE YAPMAZ ────────────────────────────────────────────────────
// YAPAR: her derneğin duyuru sayfasını çeker, içerik İMZASINI önceki koşununkiyle karşılaştırır,
//        yeterince DEĞİŞENLERİ ve ERİŞİLEMEYENLERİ listeler.
// YAPMAZ: HTML'den tarih/etkinlik/haber ÇIKARMAZ, veritabanına HİÇBİR ŞEY YAZMAZ.
//
// 🔴 BU AYRIM BİLİNÇLİ VE MERKEZİDİR. 30 dernek sitesinde 30 farklı HTML yapısından otomatik
// tarih çıkarmak kırılgandır; yanlış bildiri/erken-kayıt tarihi doktorun gerçek kaybıdır
// ("asla uydurma" ilkesi — bkz. prisma/seed-data/congresses.json başlığı). İçerik imzası ise
// sayfanın YAPISINDAN BAĞIMSIZDIR ve yanlış veri üretemez: yalnız "buraya bak" sinyali verir.
// Veri çıkarımı küratörlü/ajanlı turda kalır (scripts/congress-refresh-queue.ts → merge).
//
// 🪤 ÖLÇÜLMÜŞ TUZAKLAR (2026-08-19, hepsi bu araç kurulurken CANLI yaşandı):
//   • Ölü domain HTTP 200 dönebilir → yalnız duruma bakan denetim onu "temiz" sanar. Gövde
//     İÇERİĞİ de sınanır (çok kısa / yakalama-park sayfası imzası → şüpheli) VE sorunlu her
//     kayıt bağımsız çözümleyiciye sorulur (dnsCheck).
//   • Yerel çözümleyici YALAN SÖYLEYEBİLİR: iki adres "TLS zinciri eksik" gibi görünüyordu,
//     sertifika CN=192.168.1.1 / ZTE-ROOT-CA çıktı — MODEM yakalaması. Gerçek: biri NXDOMAIN,
//     diğeri SERVFAIL. Teşhis artık araca gömülü.
//   • Hash EŞİTLİĞİ kurum sitelerinde çalışmaz (rotasyonlu içerik + CAPTCHA) → benzerlik +
//     sayfa başına öğrenilen oynaklık tabanı. Ayrıntı: "Parmak izi" bölümü.
//
// Durum kaydı: .association-watch-state.json (repo köküne yazılır; Actions'ta cache ile taşınır).
// Kayıt yoksa ilk koşu "temel alındı" der ve hiçbir değişiklik raporlamaz (yanlış alarm olmasın).


import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, ".association-watch-state.json");
const AS_JSON = process.argv.includes("--json");
const ONLY = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
const TIMEOUT_MS = 20_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// ── Dernek listesi ──────────────────────────────────────────────────────────
// lib/association-sources.ts TypeScript'tir; bu script bağımlılıksız Node ile koşar (Actions'ta
// `npm ci` yok — synthetic-checks.mjs emsali). Liste oradan TÜRETİLİR: kaynak dosyayı okuyup
// slug/site/newsPath alanları çıkarılır. Böylece TEK kaynak korunur; çoğaltma yok.
// 🪤 Elle kopyalansaydı, derneği lib'e ekleyen kişi nöbetçiyi güncellemeyi unuturdu (sessiz kayıp).
function loadAssociations() {
  const src = readFileSync(join(ROOT, "src/lib/association-sources.ts"), "utf8");
  const body = src.slice(src.indexOf("export const ASSOCIATIONS"));
  const out = [];
  for (const line of body.split("\n")) {
    if (!line.trim().startsWith("{ slug:")) continue;
    const f = (k) => new RegExp(`\\b${k}:\\s*"([^"]*)"`).exec(line)?.[1] ?? null;
    const slug = f("slug");
    const site = f("site");
    if (!slug || !site) continue;
    out.push({
      slug, site, name: f("name") ?? slug,
      newsPath: f("newsPath"),
      rss: f("rss"),
      // Adresi doğrulanamamış dernek listede KALIR ve izlenir — düzelirse nöbetçi yakalar.
      unverified: /\bunverified:\s*true/.test(line),
    });
  }
  if (!out.length) throw new Error("association-sources.ts okunamadı — ASSOCIATIONS listesi boş çıktı");
  return out;
}

const watchUrl = (a) => (a.newsPath ? new URL(a.newsPath, a.site).href : a.site + "/");

// ── Parmak izi: BENZERLİK, eşitlik DEĞİL ────────────────────────────────────
//
// 🔴 İLK TASARIM YANLIŞTI VE ÖLÇÜMDE ÇÖKTÜ. Hash eşitliği ("gövde aynı mı?") kurum sitelerinde
// çalışmıyor: 2026-08-19'da dakikalar arayla yapılan iki çekimde 33 siteden 2'si "değişti" dedi.
// Sebep gerçek içerik değişimi değildi:
//   • plastikcerrahi.org.tr → "Videolar" bölümünü HER İSTEKTE karıştırıyor (rastgele rotasyon)
//   • klimik.org.tr        → giriş formunda matematik-CAPTCHA ("4 + ? = 12") her istekte yeni
// Token/tarih temizliği bunu çözmez (sorun oynak SAYI değil, oynak İÇERİK BLOĞU); kelime kümesine
// geçmek de çözmedi (rotasyon farklı KELİMELER getiriyor). Yanlış alarm veren nöbetçi, hiç
// olmayandan kötüdür — okuyan kişi kısa sürede hepsini görmezden gelmeye başlar.
//
// ÇÖZÜM İKİ PARÇALI:
//   1. bottom-k sketch (MinHash ailesi) — kelime kümesinden sabit boyutlu imza; iki imzanın
//      kesişim oranı Jaccard benzerliğini yaklaşık verir. Sabit ~128 sayı/site (state küçük kalır).
//   2. SAYFA BAŞINA ÖĞRENİLEN OYNAKLIK TABANI — sayfa listeye ilk girdiğinde ARDIŞIK İKİ kez
//      çekilir; ikisinin benzerliği o sayfanın doğal gürültüsüdür (kararlı sayfada 1.0,
//      rotasyonlu sayfada ~0.93). Eşik bu tabandan türetilir, sabit bir sayı DEĞİL — çünkü
//      "ne kadar oynaklık normaldir" sorusunun cevabı her sitede farklı.
const SKETCH_K = 128;
const MIN_THRESHOLD = 0.80; // taban ne kadar düşük olursa olsun bunun altına inilmez

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 32-bit FNV-1a — kriptografik değil, dağılım yeter (sketch üyeliği için). */
function h32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Metin → bottom-k imza (artan sıralı k hash). Salt sayılar atılır (CAPTCHA/sayaç gürültüsü). */
function sketch(text) {
  const words = new Set(
    text.toLocaleLowerCase("tr-TR").split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !/^\p{N}+$/u.test(w)),
  );
  return [...new Set([...words].map(h32))].sort((a, b) => a - b).slice(0, SKETCH_K);
}

/** İki bottom-k imzanın yaklaşık Jaccard benzerliği (0..1). */
function similarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  const n = Math.min(a.length, b.length, SKETCH_K);
  const setB = new Set(b.slice(0, n));
  let common = 0;
  for (const x of a.slice(0, n)) if (setB.has(x)) common++;
  return common / n;
}

/** Ölü/yakalama sayfası imzaları — HTTP 200 dönen ölü domain sınıfı (turkrom2026.org dersi). */
const CAPTIVE_SIGNS = [
  "bu alan adı satılık", "domain for sale", "parked domain", "buy this domain",
  "modem", "router setup", "kurulum sihirbaz", "default page", "index of /",
];
function suspicious(text) {
  if (text.length < 400) return "gövde çok kısa (<400 karakter) — sayfa boş ya da yakalanmış olabilir";
  const low = text.toLocaleLowerCase("tr-TR");
  const hit = CAPTIVE_SIGNS.find((s) => low.includes(s));
  return hit ? `yakalama/park sayfası imzası: "${hit}"` : null;
}

// ── Bağımsız DNS teşhisi (2026-08-19'da bu araç kurulurken ÖĞRENİLDİ) ───────
//
// 🔴 YEREL ÇÖZÜMLEYİCİYE GÜVENİLMEZ. Ölçümde iki dernek adresi "TLS zinciri eksik" gibi
// görünüyordu; sertifikaya bakınca gerçek çıktı başkaydı: CN=192.168.1.1, issuer=ZTE-ROOT-CA —
// yani MODEM, çözülemeyen alan adını kendi arayüzüne yakalıyordu. Bağımsız çözümleyiciye
// (Cloudflare DoH) sorunca gerçek ortaya çıktı: biri NXDOMAIN (alan adı YOK), diğeri SERVFAIL.
// Bu üç durum ÜÇ FARKLI EYLEM gerektirir ve karıştırılırsa yanlış iş açılır:
//   NXDOMAIN → adres gerçekten ölü, kaynak listesi DÜZELTİLMELİ
//   SERVFAIL → yetkili DNS arızalı, geçici olabilir → izlemeye devam
//   çözülüyor ama bağlanılamıyor → gerçek TLS/ağ sorunu (özel-CA yolu düşünülebilir)
// Emsal: hafızadaki "ölü domain HTTP 200 dönebilir" tuzağı — orada teşhis elle yapılmıştı,
// burada araca gömüldü.
const DNS_STATUS = { 0: "cozuluyor", 2: "SERVFAIL (yetkili DNS arızalı)", 3: "NXDOMAIN (alan adı YOK)" };
async function dnsCheck(hostname) {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null; // DoH'a ulaşılamadı — teşhis atlanır, ölçüm yine de raporlanır
    const j = await res.json();
    return { status: j.Status, label: DNS_STATUS[j.Status] ?? `DNS status ${j.Status}`, answers: j.Answer?.length ?? 0 };
  } catch {
    return null;
  }
}

/** Tek çekim → metin (sınıflandırma dahil). `sk` yalnız sınıf "ok" ise dolar. */
async function fetchOnce(url) {
  const r = { status: null, klass: "", note: "", sk: null };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    r.status = res.status;
    if (!res.ok) { r.klass = "erisilemedi"; r.note = `HTTP ${res.status}`; return r; }
    const text = textOf(await res.text());
    const sus = suspicious(text);
    if (sus) { r.klass = "supheli"; r.note = sus; return r; }
    r.sk = sketch(text);
    r.klass = "ok";
  } catch (e) {
    const code = String(e?.cause?.code ?? e?.name ?? String(e).slice(0, 60));
    // Sertifika/TLS hatası TEK BAŞINA teşhis DEĞİLDİR — modem yakalaması da böyle görünür
    // (yukarıdaki DNS teşhisi notu). Sınıf aşağıda DNS sonucuyla birlikte kesinleşir.
    r.klass = /UNABLE_TO_VERIFY|SELF_SIGNED|CERT_/.test(code) ? "tls" : "erisilemedi";
    r.note = code;
  }
  return r;
}

/**
 * @param needBaseline sayfanın oynaklık tabanı henüz bilinmiyor → ARDIŞIK İKİNCİ çekim yapılır.
 *   Yalnız sayfa listeye ilk girdiğinde olur; sonraki koşular tek istek atar (siteye nezaket).
 */
async function probe(a, needBaseline) {
  const url = watchUrl(a);
  const r = { slug: a.slug, name: a.name, url, status: null, klass: "", note: "", sk: null, baseline: null, sim: null, rss: a.rss ?? null, dns: null };
  const first = await fetchOnce(url);
  Object.assign(r, { status: first.status, klass: first.klass, note: first.note, sk: first.sk });

  if (r.klass === "ok" && needBaseline) {
    const second = await fetchOnce(url);
    // Taban = aynı içeriğin iki ardışık çekimi ne kadar benzer. 1.0 = kararlı sayfa;
    // <1.0 = sayfa kendi kendine oynuyor (rotasyon/CAPTCHA) ve eşik ona göre gevşetilir.
    r.baseline = second.klass === "ok" ? similarity(first.sk, second.sk) : 1;
  }

  // Sorunlu her kayıt bağımsız çözümleyiciye sorulur — "site öldü mü, ağım mı yalan söylüyor?"
  if (r.klass !== "ok") {
    const dns = await dnsCheck(new URL(url).hostname);
    if (dns) {
      r.dns = dns.label;
      if (dns.status === 3) { r.klass = "olu"; r.note = `${dns.label} — kaynak listesindeki adres DÜZELTİLMELİ (ölçüm: ${r.note})`; }
      else if (dns.status === 2) { r.klass = "dns"; r.note = `${dns.label} — geçici olabilir, izlemede kal (ölçüm: ${r.note})`; }
      else if (r.klass === "tls") { r.note = `${r.note} — alan adı ÇÖZÜLÜYOR, gerçek TLS sorunu (özel-CA yolu: lib/ttb-ca.ts emsali)`; }
    }
  }
  return r;
}

/** Sayfanın kendi gürültü tabanından türeyen "değişti" eşiği. */
function thresholdFor(baseline) {
  // Taban 1.0 (kararlı sayfa) → 0.97: küçük bir düzenleme bile yakalanır.
  // Taban 0.93 (rotasyonlu sayfa) → 0.90: doğal oynaklık alarm üretmez, gerçek yeni içerik üretir.
  return Math.max(MIN_THRESHOLD, Math.min(0.97, (baseline ?? 1) - 0.03));
}

// ── Koşu ────────────────────────────────────────────────────────────────────
const list = loadAssociations().filter((a) => !ONLY || a.slug === ONLY);
const prev = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;

const results = [];
for (let i = 0; i < list.length; i += 5) { // nazik eşzamanlılık — kurum sitelerini yormayalım
  const chunk = list.slice(i, i + 5);
  results.push(...(await Promise.all(chunk.map((a) => probe(a, prev?.sites?.[a.slug]?.baseline == null)))));
}

const degisen = [], yeni = [], sorunlu = [], sabit = [];
for (const r of results) {
  if (r.klass !== "ok") { sorunlu.push(r); continue; }
  const before = prev?.sites?.[r.slug];
  if (!before?.sk) { yeni.push(r); continue; }
  r.sim = similarity(before.sk, r.sk);
  // Eşik önceki koşuda ÖĞRENİLEN tabandan gelir (bu koşuda taban yeniden ölçülmez — tek istek).
  r.threshold = thresholdFor(before.baseline ?? r.baseline);
  (r.sim < r.threshold ? degisen : sabit).push(r);
}

// Durum kaydı: yalnız BAŞARILI okumalar güncellenir — erişilemeyen derneğin eski imzası KORUNUR
// (silinseydi site geri geldiğinde "yeni" görünür ve aradaki gerçek değişim kaçardı).
// Taban da korunur: bir kez ölçülür, sayfa davranışı değişmedikçe yeniden ölçmeye gerek yok.
const sites = { ...(prev?.sites ?? {}) };
for (const r of results) {
  if (!r.sk) continue;
  sites[r.slug] = { sk: r.sk, baseline: r.baseline ?? prev?.sites?.[r.slug]?.baseline ?? 1 };
}
writeFileSync(STATE_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), sites }, null, 2) + "\n");

const pct = (v) => (v == null ? "?" : `%${Math.round(v * 100)}`);
if (AS_JSON) {
  console.log(JSON.stringify({
    degisen: degisen.map(({ sk, ...r }) => r),
    yeni: yeni.map(({ sk, ...r }) => r),
    sorunlu: sorunlu.map(({ sk, ...r }) => r),
    sabitSayisi: sabit.length,
  }, null, 2));
} else {
  console.log(`🔔 Dernek nöbetçisi — ${results.length} dernek tarandı${prev ? "" : " (İLK KOŞU: temel alındı, değişiklik raporlanmaz)"}\n`);
  if (degisen.length) {
    console.log(`📣 DEĞİŞEN (${degisen.length}) — duyuru sayfası güncellenmiş, bakılmalı:`);
    for (const r of degisen) console.log(`   ${r.slug.padEnd(16)} benzerlik ${pct(r.sim)} (eşik ${pct(r.threshold)})  ${r.url}`);
    console.log("");
  }
  if (yeni.length && prev) {
    console.log(`🆕 İLK KEZ OKUNDU (${yeni.length}) — temel alındı:`);
    for (const r of yeni) console.log(`   ${r.slug.padEnd(16)} oynaklık tabanı ${pct(r.baseline)}  ${r.url}`);
    console.log("");
  }
  if (sorunlu.length) {
    console.log(`⚠️  SORUNLU (${sorunlu.length}):`);
    for (const r of sorunlu) console.log(`   [${r.klass}] ${r.slug.padEnd(16)} ${r.note} — ${r.url}`);
    console.log("");
  }
  const oynak = results.filter((r) => (r.baseline ?? prev?.sites?.[r.slug]?.baseline ?? 1) < 0.99);
  if (oynak.length) {
    console.log(`🎲 Kendi kendine oynayan sayfa (${oynak.length}) — eşiği gevşetildi, yanlış alarm vermez:`);
    for (const r of oynak) console.log(`   ${r.slug.padEnd(16)} taban ${pct(r.baseline ?? prev?.sites?.[r.slug]?.baseline)}`);
    console.log("");
  }
  console.log(`✅ Değişmeyen: ${sabit.length}`);
  console.log(`\nSıradaki adım: DEĞİŞEN dernekler kongre tazeleme turuna girer —`);
  console.log(`   npx tsx scripts/congress-refresh-queue.ts --json`);
}

// Nöbetçi bir SİNYAL üreticisidir: değişiklik bulmak "başarı"dır, hata değil → exit 0.
// Yalnız aracın KENDİSİ çalışamazsa (liste okunamadı) yukarıda exception ile düşer.
