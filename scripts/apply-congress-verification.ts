// Kongre DOĞRULAMA turu uygulayıcısı (v6.119) — kalıcı araç.
//
// NE YAPAR: doğrulama ajanlarının `{ branchSlug, name, hukum, duzeltmeler, kanit, not }` biçimli
// çıktılarını `prisma/seed-data/congresses.json` üzerine uygular. Araştırma turu "veriyi getirir",
// doğrulama turu "veriyi çürütür" — bu araç ikincisinin hükmünü kaynağa işler.
//
// ⚠️ Doğrulama dosyaları araştırma dosyalarından AYRI klasörde tutulur. Gerekçe (v6.119'da yaşandı):
// ikisi de `*-sonuc.json` adını taşıyordu, `merge-congress-research.ts` doğrulama çıktısını
// araştırma verisi sanıp birleştirdi (193 → 274 satır). Artık merge `hukum` alanı gören dosyayı
// atlıyor, bu araç ise YALNIZ `hukum` taşıyanları kabul ediyor — iki yönlü kilit.
//
// UYGULANAN: yalnız `hukum === "duzeltildi"` satırlarının `duzeltmeler` alanları.
// `dogru` = değişiklik yok · `teyit-edilemedi` = kanıt bulunamadı, veriye DOKUNULMAZ (uydurma yok)
// · `riskli`/`temiz` (URL denetimi hükümleri) da `duzeltmeler` doluysa uygulanır.
//
// `duzeltmeler` içinde `null` GEÇERLİ bir değerdir (alanı BOŞALT demektir — ör. bayat tarihi sil).
//
// GÜVENLİK: varsayılan DRY-RUN (yazma için --yaz). DB'ye DOKUNMAZ; tek çıktısı seed kaynağıdır.
// Yazmadan önce `.yedek-dogrulama` kopyası bırakır.
//
// Kullanım:
//   npx tsx scripts/apply-congress-verification.ts --dizin <dogrulama-klasoru>
//   npx tsx scripts/apply-congress-verification.ts --dizin <dogrulama-klasoru> --yaz
import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { congressExternalId } from "./congress-id";
import { nameSimilarity, BENZERLIK_ESIGI } from "./congress-match";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const dirIdx = args.indexOf("--dizin");
const DIR = dirIdx >= 0 ? args[dirIdx + 1] : "";

if (!DIR || !existsSync(DIR)) {
  console.error("⛔ --dizin <doğrulama klasörü> zorunlu (içinde *-sonuc.json dosyaları olmalı).");
  process.exit(1);
}

interface Row { branchSlug: string; name: string; [k: string]: unknown }
interface Hukum {
  branchSlug: string;
  name: string;
  hukum: string;
  duzeltmeler?: Record<string, unknown>;
  kanit?: string;
  not?: string;
  kusur?: string;
}

/// Doktor-yüzü alanlardan İÇ SÜREÇ NOTUNU ayıkla.
/// Gerekçe: doğrulama ajanları `registrationNotes`in başına yöntem cümlesi yazıyor
/// ("🔓 BOT KORUMASI AŞILDI (site, tarayıcı UA ile HTTP 200).") — arkasındaki içerik değerli
/// (tam ücret tarifesi) ama bu cümle DOKTORA gösterilen kartta yer almamalı: kanıt zaten
/// `sourceUrls`/`kanit`ta yaşıyor. Yalnız 🔓 ile başlayan İLK cümle düşer, gerisi korunur.
const SUREC_NOTU = /^🔓[^.]*\.\s*/u;
function temizle(alan: string, deger: unknown): unknown {
  if (alan !== "registrationNotes" && alan !== "themes" && alan !== "warning") return deger;
  if (typeof deger !== "string") return deger;
  return deger.replace(SUREC_NOTU, "").trim();
}

const SEED_PATH = join(process.cwd(), "prisma", "seed-data", "congresses.json");
const rows = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as Row[];

// ── Hükümleri topla ───────────────────────────────────────────────────────────────────────
const hukumler: Hukum[] = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith("-sonuc.json")).sort()) {
  const parsed = JSON.parse(readFileSync(join(DIR, f), "utf-8")) as Hukum[];
  if (!Array.isArray(parsed)) { console.error(`⛔ ${f} bir JSON dizisi değil.`); process.exit(1); }
  // Ters kilit: bu araç YALNIZ doğrulama çıktısı kabul eder.
  const yabanci = parsed.filter((r) => r.hukum === undefined);
  if (yabanci.length) {
    console.error(`⛔ ${f}: ${yabanci.length} kayıtta \`hukum\` yok — bu bir ARAŞTIRMA çıktısı olabilir.`);
    console.error(`   Araştırma çıktısı merge-congress-research.ts'e verilir, buraya değil.`);
    process.exit(1);
  }
  hukumler.push(...parsed);
  console.log(`📥 ${f}: ${parsed.length} hüküm`);
}

// ── Uygula ────────────────────────────────────────────────────────────────────────────────
const sayac: Record<string, number> = {};
const uygulanan: string[] = [];
const eslesmeyen: string[] = [];
const dokunulmayan: string[] = [];

for (const h of hukumler) {
  sayac[h.hukum] = (sayac[h.hukum] ?? 0) + 1;

  const alanlar = h.duzeltmeler && Object.keys(h.duzeltmeler).length ? h.duzeltmeler : null;
  if (!alanlar) {
    if (h.hukum === "teyit-edilemedi") dokunulmayan.push(`[${h.branchSlug}] ${h.name} — kanıt yok, dokunulmadı`);
    continue;
  }

  const kimlik = congressExternalId(h.name);
  let hedef = rows.find((r) => r.branchSlug === h.branchSlug && congressExternalId(r.name) === kimlik);
  // Ad birebir tutmuyorsa (doğrulama ajanı kısaltmış olabilir) aynı branşta en yakın adı dene.
  if (!hedef) {
    const aday = rows
      .filter((r) => r.branchSlug === h.branchSlug)
      .map((r) => ({ r, s: nameSimilarity(r.name, h.name) }))
      .sort((a, b) => b.s - a.s)[0];
    if (aday && aday.s >= BENZERLIK_ESIGI) hedef = aday.r;
  }

  if (!hedef) {
    eslesmeyen.push(`[${h.branchSlug}] ${h.name} (${Object.keys(alanlar).join(", ")})`);
    continue;
  }

  const degisen: string[] = [];
  for (const [k, vHam] of Object.entries(alanlar)) {
    const v = temizle(k, vHam);
    const eski = hedef[k];
    if (JSON.stringify(eski) === JSON.stringify(v)) continue;
    if (!DRY) hedef[k] = v;
    degisen.push(`${k}: ${JSON.stringify(eski)?.slice(0, 40)} → ${JSON.stringify(v)?.slice(0, 60)}`);
  }
  // Doğrulanan kaydın tazelik damgası ilerler (tazeleme kuyruğu bunu okur).
  if (degisen.length && !DRY) hedef.verifiedAt = "2026-08-19";
  if (degisen.length) uygulanan.push(`[${hedef.branchSlug}] ${hedef.name}\n      ${degisen.join("\n      ")}`);
}

// ── Rapor ─────────────────────────────────────────────────────────────────────────────────
console.log(`\n📚 Kaynak: ${rows.length} satır · hüküm: ${hukumler.length}`);
console.log(`   ${Object.entries(sayac).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
console.log(`\n${"═".repeat(66)}`);
console.log(`✍️  ALAN DÜZELTMESİ UYGULANAN KAYIT  ${uygulanan.length}`);
console.log(`🚫 EŞLEŞMEYEN (kaynakta bulunamadı)  ${eslesmeyen.length}`);
console.log(`⏭️  KANIT YOK, DOKUNULMADI            ${dokunulmayan.length}`);
console.log(`${"═".repeat(66)}`);

const dok = (b: string, l: string[]) => { if (l.length) { console.log(`\n${b}`); for (const x of l) console.log(`   · ${x}`); } };
dok("✍️  Düzeltmeler:", uygulanan);
dok("🚫 Eşleşmeyenler (elle bakılmalı):", eslesmeyen);
dok("⏭️  Kanıt bulunamayanlar (veri korundu):", dokunulmayan);

if (DRY) {
  console.log(`\n🔍 DRY-RUN — dosya değişmedi. Uygulamak için: --yaz`);
} else {
  copyFileSync(SEED_PATH, `${SEED_PATH}.yedek-dogrulama`);
  writeFileSync(SEED_PATH, `${JSON.stringify(rows, null, 1)}\n`, "utf-8");
  console.log(`\n✅ Yazıldı: ${SEED_PATH} (yedek: .yedek-dogrulama)`);
  console.log(`\n▶️  Sıradaki adım: npx tsx scripts/seed-congresses.ts   (DEV dry-run)`);
}
