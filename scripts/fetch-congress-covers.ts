// Kongre kapak görseli toplayıcı (v6.64) — kalıcı araç.
//
// NE YAPAR: `url` alanı dolu kongrelerin resmî sayfasından og:image (yedek: twitter:image)
// meta'sını okur, görseli SUNUCUDA (bu makinede) indirir, sharp ile ~320px webp'e YENİDEN
// ENCODE eder ve data URI olarak `MedicalCongress.coverImage` alanına yazar.
//
// NEDEN DATA URI (Blob değil): CSP `img-src 'self' data:` — dış host da Blob hostu da yasak;
// data: zaten izinli. Yeniden-encode SVG/steganografi dahil her türlü aktif içeriği söker
// (çıktı daima raster webp), hotlink yapılmadığı için link ölse de kapak yaşar, bant genişliği
// çalınmaz. Kapak UI'da 64×64 gösterildiğinden 320px bol; tipik çıktı 5-20KB (103 kongre ≈ ~1.5MB).
// ⚠️ Liste sorgusu `upcomingCongresses` bu yüzden AÇIK select'lidir (coverImage çekmez) — kongre
// listesine yeni alan eklerken oradaki select'e de ekle (tsc eksiği yakalar).
//
// OG:IMAGE YOKSA: kongre atlanır, UI branş amblemi çizmeye devam eder (tasarımın fallback'i).
// "Otomatik temizlenir/tam kapak" garantisi HİÇBİR YERDE verilmez.
//
// GÖRSEL ELEME (kullanıcı kalite şartı, 2026-08-04): og:image çoğu sitede kongre afişi değil
// site-geneli logo/soyut tema görseli çıkıyor (ör. dernek logosu, süs küresi) — bunlar "kongre
// hakkında bilgi vermez" ve kapak olarak YANILTICIDIR. Her indirilen görsel Claude'a (vision)
// kongre adıyla birlikte sorulur; yalnız "kongreyi tanıtan afiş/duyuru" hükmü alanlar yazılır.
// ŞÜPHEDE RED (fail-closed: yanlış kapak basmaktansa amblem). ANTHROPIC_API_KEY yoksa script
// hiç koşmaz — elemesiz doldurma yolu bilinçli olarak YOK. --force koşusunda RED alan mevcut
// kapak NULL'a çekilir (yanlış doldurulmuşları temizleme yolu).
//
// GÜVENLİK: seed-congresses.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (siteleri TARAR ama DB'ye YAZMAZ; yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Yazılan tek alan MedicalCongress.coverImage — PHI yok (kamuya açık kongre görseli).
//
// Kullanım:
//   npx tsx scripts/fetch-congress-covers.ts                  → DEV dry-run (tarar, yazmaz)
//   npx tsx scripts/fetch-congress-covers.ts --yaz            → DEV'e yaz
//   npx tsx scripts/fetch-congress-covers.ts --yaz --limit=5  → DEV'e ilk 5 kongre
//   npx tsx scripts/fetch-congress-covers.ts --prod --yaz     → PROD'a yaz
//   --force: coverImage'ı DOLU olanları da yeniler (varsayılan: yalnız boşlar)
import "dotenv/config";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const FORCE = args.includes("--force");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0) || Infinity;

// Bazı dernek siteleri (HealthTürkiye deneyimi) bot-UA'yı 403'ler → gerçekçi tarayıcı UA.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const HTML_TIMEOUT_MS = 15_000;
const IMG_TIMEOUT_MS = 20_000;
const IMG_MAX_BYTES = 10 * 1024 * 1024; // ham indirme sınırı
const OUT_MAX_BYTES = 80 * 1024; //        yeniden-encode sonrası sınır (DB şişmesin)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, ms: number, accept: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "tr,en;q=0.8" },
    });
  } finally {
    clearTimeout(t);
  }
}

/** <meta> taglarından og:image ailesini çıkarır — attribute SIRASI değişken olduğundan
 *  (content önce de gelebilir) tag içi property/content ayrı ayrı aranır. */
function extractOgImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 600_000); // meta'lar baştadır; dev HTML'lerde boğulma
  const metas = head.match(/<meta\s[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];
  const found = new Map<string, string>();
  for (const tag of metas) {
    const key =
      /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? null;
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? null;
    if (key && content && wanted.includes(key) && !found.has(key)) found.set(key, content);
  }
  for (const key of wanted) {
    const raw = found.get(key);
    if (!raw) continue;
    // HTML entity'li URL'ler sık (&amp;) — asgari decode.
    const decoded = raw.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    try {
      const abs = new URL(decoded, pageUrl); // göreli og:image'ı mutlaklaştır
      if (abs.protocol === "http:" || abs.protocol === "https:") return abs.href;
    } catch {
      /* bozuk URL → sıradaki adaya bak */
    }
  }
  return null;
}

/** Görsel eleme — ai-clinical.ts'in tool-forced deseniyle: görsel bu kongreyi TANITAN afiş mi?
 *  Fail-closed: API hatası, parse hatası ya da tereddüt → RED (kapak yazılmaz, amblem kalır). */
const VERDICT_TOOL: Anthropic.Tool = {
  name: "submit_cover_verdict",
  description: "Kongre kapak adayı görselin hükmü.",
  input_schema: {
    type: "object",
    properties: {
      isPoster: {
        type: "boolean",
        description:
          "true: görsel BU kongreyi tanıtan afiş/duyuru (kongre adı, edisyonu, tarihi, yeri görünüyor " +
          "YA DA kongreye özgü tasarlanmış tanıtım görseli); " +
          "false: dernek/kurum logosu, soyut süs/tema görseli, stok fotoğraf, site-geneli banner — " +
          "kongre hakkında bilgi vermeyen her şey. Emin değilsen false.",
      },
      reason: { type: "string", description: "Tek cümlelik Türkçe gerekçe." },
    },
    required: ["isPoster", "reason"],
  },
};

// Lazy client (ai-clinical.ts deseni) — modül yükünde değil ilk çağrıda kurulur.
function ai(): Anthropic {
  return new Anthropic();
}

async function isCongressPoster(webp: Buffer, title: string): Promise<{ ok: boolean; reason: string }> {
  try {
    const res = await ai().messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system:
        "Tıp kongresi takvimi için kapak görseli eleyicisisin. Sana bir kongre sitesinin og:image görseli " +
        "gösterilir; yalnız KONGREYİ TANITAN görseller kapak olur (doktoru yanıltmamak için logo/süs elenir). " +
        "Hükmü DAİMA submit_cover_verdict aracıyla ver.",
      tools: [VERDICT_TOOL],
      tool_choice: { type: "tool", name: "submit_cover_verdict" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data: webp.toString("base64") } },
          { type: "text", text: `Kongre: ${title}\nBu görsel bu kongreyi tanıtan bir afiş/duyuru görseli mi?` },
        ],
      }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return { ok: false, reason: "hüküm alınamadı" };
    const v = block.input as { isPoster?: boolean; reason?: string };
    return { ok: v.isPoster === true, reason: v.reason ?? "" };
  } catch (e) {
    return { ok: false, reason: `AI hatası: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** İndir + sharp ile raster webp'e yeniden encode et. Başarısızlıkta null (amblem kalır). */
async function toCoverWebp(imgUrl: string): Promise<Buffer | null> {
  const res = await fetchWithTimeout(imgUrl, IMG_TIMEOUT_MS, "image/*,*/*;q=0.5");
  if (!res.ok) throw new Error(`görsel HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`görsel değil (${type.split(";")[0] || "tip yok"})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > IMG_MAX_BYTES) throw new Error(`çok büyük (${Math.round(buf.byteLength / 1e6)}MB)`);

  // Yeniden encode: aktif içerik (SVG script vb.) rasterize olur, EXIF/metadata düşer.
  for (const quality of [78, 55]) {
    const out = await sharp(buf, { limitInputPixels: 40_000_000 })
      .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (out.byteLength <= OUT_MAX_BYTES) return out;
  }
  return null; // iki kalitede de sığmadı (aşırı karmaşık görsel) — atla
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("⛔ ANTHROPIC_API_KEY tanımlı değil — görsel eleme yapılamadan kapak yazılmaz (bilinçli fail-closed).");
    process.exit(1);
  }
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — tarar, YAZMAZ)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run — tarar, yazmaz)" : "(yazılacak)"}`);
  }

  // Dinamik import: db.ts env'i modül yüklenirken okur (yukarıdaki ayarlar önce bitmeli).
  const { db } = await import("../src/lib/db");

  const rows = await db.medicalCongress.findMany({
    where: { url: { not: null }, ...(FORCE ? {} : { coverImage: null }) },
    select: { id: true, title: true, url: true },
    orderBy: { startDate: "asc" },
  });
  const todo = rows.slice(0, LIMIT === Infinity ? rows.length : LIMIT);
  console.log(`\n📚 Aday: ${rows.length} kongre (url dolu${FORCE ? ", --force" : ", kapak boş"})` +
    (todo.length !== rows.length ? ` → --limit ile ${todo.length} taranacak` : ""));

  let written = 0, rejected = 0, noOg = 0, failed = 0;
  const failures: string[] = [];
  for (const [i, c] of todo.entries()) {
    const tag = `[${i + 1}/${todo.length}]`;
    try {
      const page = await fetchWithTimeout(c.url as string, HTML_TIMEOUT_MS, "text/html,*/*;q=0.8");
      if (!page.ok) throw new Error(`sayfa HTTP ${page.status}`);
      const og = extractOgImage(await page.text(), page.url); // page.url: redirect SONRASI taban
      if (!og) {
        noOg++;
        console.log(`${tag} ⚪ og:image yok — ${c.title}`);
        continue;
      }
      const webp = await toCoverWebp(og);
      if (!webp) {
        noOg++;
        console.log(`${tag} ⚪ görsel sığdırılamadı — ${c.title}`);
        continue;
      }
      const verdict = await isCongressPoster(webp, c.title);
      if (!verdict.ok) {
        rejected++;
        // --force turunda yanlış doldurulmuş mevcut kapak TEMİZLENİR (normal turda aday zaten boş).
        if (!DRY && FORCE) await db.medicalCongress.update({ where: { id: c.id }, data: { coverImage: null } });
        console.log(`${tag} 🚫 elendi: ${verdict.reason} — ${c.title}`);
        continue;
      }
      const dataUri = `data:image/webp;base64,${webp.toString("base64")}`;
      if (!DRY) await db.medicalCongress.update({ where: { id: c.id }, data: { coverImage: dataUri } });
      written++;
      console.log(`${tag} ✅ ${Math.round(webp.byteLength / 1024)}KB (${verdict.reason}) — ${c.title}`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? (e.name === "AbortError" ? "zaman aşımı" : e.message) : String(e);
      failures.push(`   · ${c.title} → ${msg}`);
      console.log(`${tag} ❌ ${msg} — ${c.title}`);
    }
    await sleep(400); // nazik tarama — siteleri dövme
  }

  console.log(`\n${DRY ? "🔍 DRY-RUN (yazılmadı)" : "✅ Yazıldı"} — kapak ${written} · AI eledi ${rejected} · og:image'sız ${noOg} · hata ${failed}`);
  if (failures.length) console.log(`\n⚠️ Ulaşılamayanlar (amblem fallback'i devrede kalır):\n${failures.join("\n")}`);
  const filled = await db.medicalCongress.count({ where: { coverImage: { not: null } } });
  console.log(`\nHedef DB: kapaklı kongre ${filled}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
