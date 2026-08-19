// Kongre araştırma turu BİRLEŞTİRİCİSİ (v6.119) — kalıcı araç.
//
// NE YAPAR: araştırma ajanlarının ürettiği `*-sonuc.json` dosyalarını mevcut
// `prisma/seed-data/congresses.json` üzerine BİRLEŞTİRİR ve sonucu yazar. DB'ye DOKUNMAZ —
// tek çıktısı seed kaynağıdır; DB'ye yazma ayrı adımdır (`seed-congresses.ts`).
//
// NEDEN AYRI ARAÇ: kongre modülünün tazeleme döngüsü üç parçalı —
//   1) `congress-refresh-queue.ts`  → bu hafta hangi kongrelere bakılacak (iş listesi)
//   2) araştırma ajanları           → web'den doğrulanmış veri (`*-sonuc.json`)
//   3) BU ARAÇ                      → ajan çıktısını küratörlü kaynağa güvenli birleştirme
// Elle birleştirme her turda aynı üç hatayı üretiyordu: (a) ajanın dokunmadığı kayıt kaybolur,
// (b) kongre yeniden adlandırılınca eski satır hayalet olarak kalır, (c) çok-branşlı kongrenin
// satırları ayrışır ve seed'in "branşları birleştir" dalı bozulur. Üçü de aşağıda kilitli.
//
// GÜVENLİK: varsayılan DRY-RUN. Yazmak için --yaz. Yazmadan önce mevcut dosyanın yanına
// zaman damgasız `.yedek` kopyası bırakır (üzerine yazma kazası geri alınabilsin).
//
// Kullanım:
//   npx tsx scripts/merge-congress-research.ts --dizin <sonuc-klasoru>          → rapor (dry-run)
//   npx tsx scripts/merge-congress-research.ts --dizin <sonuc-klasoru> --yaz    → congresses.json'ı güncelle
import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { congressExternalId } from "./congress-id";
import { bestMatch, identityKeyBase, BENZERLIK_ESIGI } from "./congress-match";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const dirIdx = args.indexOf("--dizin");
const RESULT_DIR = dirIdx >= 0 ? args[dirIdx + 1] : "";

if (!RESULT_DIR || !existsSync(RESULT_DIR)) {
  console.error("⛔ --dizin <ajan sonuç klasörü> zorunlu (içinde *-sonuc.json dosyaları olmalı).");
  process.exit(1);
}

/** congresses.json satırı — seed-congresses.ts `Row` arayüzüyle aynı sözleşme. */
interface Row {
  branchSlug: string;
  name: string;
  edition?: string | null;
  organizer?: string | null;
  scope: string;
  frequency?: string | null;
  nextStart?: string | null;
  nextEnd?: string | null;
  city?: string | null;
  country?: string | null;
  officialUrl?: string | null;
  abstractDeadline?: string | null;
  earlyBirdDeadline?: string | null;
  registrationNotes?: string | null;
  sourceUrls?: string[];
  confidence?: string;
  verifiedAt?: string | null;
  format?: string | null;
  language?: string | null;
  cmeCredit?: string | null;
  venue?: string | null;
  themes?: string | null;
  warning?: string | null;
  /// Çok-branşlı kongrelerde satırların BİREBİR aynı tutulması gerektiğini hatırlatan not
  /// (seed son işlenen satırdan yazar; satırlar ayrışırsa hangi branşın verisi kazandığı
  /// işlem sırasına kalır). Bu araç notu kendisi basar.
  multiBranchNote?: string;
}

/** Ajan çıktısı — Row + araştırma turu meta alanları. */
interface AgentRow extends Row {
  listeAdi?: string;
  durum?: string;
  cozumNotu?: string | null;
  gercekKongreDegil?: boolean;
}

const ROW_KEYS: (keyof Row)[] = [
  "branchSlug", "name", "edition", "organizer", "scope", "frequency", "nextStart", "nextEnd",
  "city", "country", "officialUrl", "abstractDeadline", "earlyBirdDeadline", "registrationNotes",
  "sourceUrls", "confidence", "verifiedAt", "format", "language", "cmeCredit", "venue",
  "themes", "warning",
];

/** Bir satırın "veri zenginliği" — çok-branşlı çakışmada hangi sürümün kazanacağını belirler. */
function richness(r: Row): number {
  let n = 0;
  for (const k of ROW_KEYS) {
    const v = r[k];
    if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) n++;
  }
  if (r.confidence === "dogrulandi") n += 3; // doğrulanmış veri kısmiden üstün
  if (r.nextStart) n += 2;                   // tarihli kayıt tarihsizden üstün
  return n;
}

function pickRowFields(a: AgentRow): Row {
  const out = {} as Row;
  for (const k of ROW_KEYS) {
    const v = a[k];
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ── 1) Ajan sonuçlarını topla ──────────────────────────────────────────────────────────────
const files = readdirSync(RESULT_DIR).filter((f) => f.endsWith("-sonuc.json")).sort();
if (!files.length) {
  console.error(`⛔ ${RESULT_DIR} içinde *-sonuc.json bulunamadı.`);
  process.exit(1);
}

const agentRows: AgentRow[] = [];
const kategoriler: AgentRow[] = []; // gercekKongreDegil — seed'e GİRMEZ, yalnız rapora
for (const f of files) {
  const parsed = JSON.parse(readFileSync(join(RESULT_DIR, f), "utf-8")) as AgentRow[];
  if (!Array.isArray(parsed)) { console.error(`⛔ ${f} bir JSON dizisi değil.`); process.exit(1); }
  // 🪤 DOĞRULAMA ÇIKTISI KARIŞMASI (v6.119'da yaşandı): doğrulama ajanlarının dosyaları da
  // `*-sonuc.json` adını taşıyordu ve araştırma verisi sanılıp birleştirildi (193 → 274 satır).
  // Doğrulama satırının imzası `hukum` alanıdır; taşıyan dosya ATLANIR ve nedeni yazılır.
  if (parsed.some((r) => (r as { hukum?: string }).hukum !== undefined)) {
    console.log(`⏭️  ${f}: DOĞRULAMA çıktısı (\`hukum\` alanı var) — birleştirmeye girmez, atlandı`);
    continue;
  }
  for (const r of parsed) {
    if (!r.branchSlug || !r.name) { console.error(`⛔ ${f}: branchSlug/name eksik kayıt var.`); process.exit(1); }
    // Araştırma satırının zorunlu imzası: `scope`. Yoksa dosya bu boru hattına ait değildir.
    if (!r.scope) { console.error(`⛔ ${f}: "${r.name}" kaydında scope yok — bu bir araştırma çıktısı mı?`); process.exit(1); }
    (r.gercekKongreDegil ? kategoriler : agentRows).push(r);
  }
  console.log(`📥 ${f}: ${parsed.length} kayıt`);
}

// ── 2) Mevcut kaynağı oku ─────────────────────────────────────────────────────────────────
const SEED_PATH = join(process.cwd(), "prisma", "seed-data", "congresses.json");
const mevcut = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as Row[];
console.log(`\n📚 Mevcut kaynak: ${mevcut.length} satır · ajan çıktısı: ${agentRows.length} satır (+${kategoriler.length} kategori, seed'e girmez)`);

// ── 3) Birleştir — anahtar (branchSlug, externalId); yeniden adlandırma ad benzerliğiyle ──
const key = (branchSlug: string, name: string) => `${branchSlug}::${congressExternalId(name)}`;
const sonuc = new Map<string, Row>();
for (const r of mevcut) sonuc.set(key(r.branchSlug, r.name), r);

const rapor = { yeni: [] as string[], guncellenen: [] as string[], yenidenAdlandirilan: [] as string[] };
const kimlikKorunan: string[] = [];              // yıl farkıyla gelen ad değişikliği emildi
const yenidenAdlandirilanEski = new Set<string>(); // gerçekten silinen eski anahtarlar

for (const a of agentRows) {
  const k = key(a.branchSlug, a.name);
  const row = pickRowFields(a);

  if (sonuc.has(k)) {
    sonuc.set(k, { ...sonuc.get(k)!, ...row });
    rapor.guncellenen.push(`[${a.branchSlug}] ${a.name}`);
    continue;
  }

  // YAPISAL kimlik denemesi — bulanık eşleştirmeden ÖNCE. Fark yalnız yıl ve/veya sondaki
  // parantezli ekse aynı kongredir; ayırt edici belirteçleri jenerik olan adlarda (Türk · Ulusal ·
  // Romatoloji) IDF kapısı kapandığı için bulanık yol bunu KAÇIRIR ve mükerrer satır doğardı.
  const yapisal = [...sonuc.values()].find(
    (m) => m.branchSlug === a.branchSlug &&
      congressExternalId(identityKeyBase(m.name)) === congressExternalId(identityKeyBase(a.name)),
  );
  if (yapisal) {
    const eskiKey = key(yapisal.branchSlug, yapisal.name);
    sonuc.set(eskiKey, { ...yapisal, ...row, name: yapisal.name });
    rapor.guncellenen.push(`[${a.branchSlug}] ${yapisal.name} (yapısal kimlik: "${a.name}")`);
    if (yapisal.name !== a.name) kimlikKorunan.push(`[${a.branchSlug}] "${a.name}" → kimlik "${yapisal.name}" olarak korundu`);
    continue;
  }

  // Yeniden adlandırma: aynı branşta, ajanın "yeni" DEMEDİĞİ ve adı çok benzeyen mevcut satır.
  // (b) hatası buradan kapanır — yoksa eski ad hayalet satır olarak kalırdı.
  // IDF ağırlıklı: aday havuzu = AYNI BRANŞTAKİ satırlar. Havuzun her adında geçen belirteç
  // (ör. romatoloji branşında "romatoloji") ağırlıksız kalır → yanlış eşleşme üretemez.
  const eslesme = bestMatch(a.name, [...sonuc.values()].filter((m) => m.branchSlug === a.branchSlug), (m) => m.name);
  const aday = eslesme ? { m: eslesme.item, s: eslesme.score } : null;

  if (a.durum && a.durum !== "yeni" && aday && aday.s >= BENZERLIK_ESIGI) {
    // ⚠️ KİMLİK KORUMASI: fark YALNIZ yıl belirtecinden ibaretse adı DEĞİŞTİRME.
    // externalId addan üretilir; "AAOS Annual Meeting" → "... 2027" yeniden adlandırması gelecek
    // turda "... 2028" üretir ve her yıl YENİ satır açar (eskisi hayalet kalır). Şema da bunu
    // söylüyor: yıl `edition`/`nextStart`'ta yaşar, adda değil. Veriyi al, kimliği koru.
    if (congressExternalId(identityKeyBase(aday.m.name)) === congressExternalId(identityKeyBase(a.name))) {
      const eskiKey = key(aday.m.branchSlug, aday.m.name);
      sonuc.set(eskiKey, { ...aday.m, ...row, name: aday.m.name });
      rapor.guncellenen.push(`[${a.branchSlug}] ${aday.m.name} (yıl-farkı adı yok sayıldı: "${a.name}")`);
      kimlikKorunan.push(`[${a.branchSlug}] "${a.name}" → kimlik "${aday.m.name}" olarak korundu`);
      continue;
    }
    sonuc.delete(key(aday.m.branchSlug, aday.m.name));
    sonuc.set(k, { ...aday.m, ...row });
    rapor.yenidenAdlandirilan.push(`[${a.branchSlug}] "${aday.m.name}" → "${a.name}"`);
    yenidenAdlandirilanEski.add(key(aday.m.branchSlug, aday.m.name));
    continue;
  }

  sonuc.set(k, row);
  rapor.yeni.push(`[${a.branchSlug}] ${a.name}`);
}

// (a) hatası: ajanın hiç dokunmadığı mevcut satırlar — silinmez, raporlanır.
const dokunulan = new Set(agentRows.map((a) => key(a.branchSlug, a.name)));
const dokunulmayan = mevcut.filter(
  (m) => !dokunulan.has(key(m.branchSlug, m.name)) && !yenidenAdlandirilanEski.has(key(m.branchSlug, m.name)),
);

// ── 4) (c) hatası: çok-branşlı kongrelerin satırlarını EŞİTLE ─────────────────────────────
// seed `findUnique(externalId)` ile tek satır bulur ve SON işlenen satırın verisini yazar;
// satırlar ayrışırsa hangi branşın verisinin kazandığı JSON sırasına kalır (sessiz veri kaybı).
const byExternal = new Map<string, Row[]>();
for (const r of sonuc.values()) {
  const id = congressExternalId(r.name);
  (byExternal.get(id) ?? byExternal.set(id, []).get(id)!).push(r);
}
const esitlenen: string[] = [];
for (const [id, grup] of byExternal) {
  if (grup.length < 2) continue;
  const kazanan = grup.slice().sort((x, y) => richness(y) - richness(x))[0];
  for (const r of grup) {
    const slug = r.branchSlug;
    for (const k2 of ROW_KEYS) {
      if (k2 === "branchSlug") continue;
      (r as unknown as Record<string, unknown>)[k2] = (kazanan as unknown as Record<string, unknown>)[k2];
    }
    r.branchSlug = slug;
    r.multiBranchNote = `Çok branşlı kongre (${grup.map((g) => g.branchSlug).join(" + ")}) — satırlar branchSlug DIŞINDA birebir aynı tutulur; seed son işlenen satırdan yazar.`;
  }
  esitlenen.push(`${id} → ${grup.map((g) => g.branchSlug).join(" + ")}`);
}

// ── 5) Rapor ──────────────────────────────────────────────────────────────────────────────
const cikti = [...sonuc.values()].sort((a, b) =>
  a.branchSlug === b.branchSlug ? a.name.localeCompare(b.name, "tr") : a.branchSlug.localeCompare(b.branchSlug, "tr"),
);

console.log(`\n${"═".repeat(70)}`);
console.log(`🆕 YENİ            ${rapor.yeni.length}`);
console.log(`♻️  GÜNCELLENEN     ${rapor.guncellenen.length}`);
console.log(`✏️  YENİDEN ADLANDIRILAN ${rapor.yenidenAdlandirilan.length}`);
console.log(`🔒 KİMLİK KORUNDU (yıl farkı) ${kimlikKorunan.length}`);
console.log(`🤝 ÇOK-BRANŞLI EŞİTLENEN ${esitlenen.length}`);
console.log(`😴 AJAN DOKUNMADI  ${dokunulmayan.length} (korundu)`);
console.log(`🚫 KATEGORİ (seed dışı) ${kategoriler.length}`);
console.log(`${"═".repeat(70)}`);
console.log(`📦 SONUÇ: ${mevcut.length} → ${cikti.length} satır`);

const tarihli = cikti.filter((r) => r.nextStart).length;
const urlsiz = cikti.filter((r) => !r.officialUrl).length;
const dogrulandi = cikti.filter((r) => r.confidence !== "kismi").length;
console.log(`   tarihli ${tarihli}/${cikti.length} · URL'siz ${urlsiz} · doğrulandı ${dogrulandi} · kısmi ${cikti.length - dogrulandi}`);
console.log(`   branş: ${new Set(cikti.map((r) => r.branchSlug)).size} · benzersiz kongre: ${byExternal.size}`);

const dok = (baslik: string, satirlar: string[], limit = 999) => {
  if (!satirlar.length) return;
  console.log(`\n${baslik}`);
  for (const s of satirlar.slice(0, limit)) console.log(`   · ${s}`);
  if (satirlar.length > limit) console.log(`   … +${satirlar.length - limit}`);
};
dok("🆕 Yeni kayıtlar:", rapor.yeni);
dok("✏️  Yeniden adlandırılanlar:", rapor.yenidenAdlandirilan);
dok("🔒 Kimliği korunanlar (ada yıl eklenmesi reddedildi):", kimlikKorunan);
dok("🤝 Çok-branşlı eşitlenenler:", esitlenen);
dok("😴 Ajanın dokunmadığı mevcut kayıtlar (korundu):", dokunulmayan.map((r) => `[${r.branchSlug}] ${r.name}`));
dok("🚫 Gerçek kongre olmayan kalemler (seed'e girmedi, vault'ta iz kalır):",
  kategoriler.map((r) => `[${r.branchSlug}] ${r.listeAdi ?? r.name} — ${r.cozumNotu ?? "gerekçe yok"}`));

// ── 6) Yaz ────────────────────────────────────────────────────────────────────────────────
if (DRY) {
  console.log(`\n🔍 DRY-RUN — hiçbir dosya değişmedi. Yazmak için: --yaz`);
} else {
  copyFileSync(SEED_PATH, `${SEED_PATH}.yedek`);
  writeFileSync(SEED_PATH, `${JSON.stringify(cikti, null, 1)}\n`, "utf-8");
  writeFileSync(join(RESULT_DIR, "kategori-cozulemedi.json"), `${JSON.stringify(kategoriler, null, 1)}\n`, "utf-8");
  console.log(`\n✅ Yazıldı: ${SEED_PATH} (yedek: .yedek)`);
  console.log(`   Kategori kalemleri: ${join(RESULT_DIR, "kategori-cozulemedi.json")}`);
  console.log(`\n▶️  Sıradaki adım: npx tsx scripts/seed-congresses.ts        (DEV dry-run)`);
}
