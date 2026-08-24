// Ortak yardımcı modül (çalıştırılabilir script DEĞİL) — kongre adı eşleştirme.
//
// TEK KAYNAK: `merge-congress-research.ts` (yeniden adlandırma tespiti) ve
// `prune-congress-orphans.ts` (yetim → halef eşleme) benzerliği BURADAN alır.
// İkisi ayrışırsa birleştirmenin "aynı kongre" dediğine temizleyici "farklı" der (ya da tersi)
// ve yetim satırlar sessizce birikir. `congress-id.ts` ile aynı gerekçe.
//
// 🪤 v6.119'da yaşanan hata — buraya yazılıyor ki tekrarlanmasın:
// İlk uygulama belirteçleri `length > 3` ile süzüyordu. Bu, kongre adlarının EN AYIRT EDİCİ
// parçasını (ERA · EHA · ACS · AUA · TOD — hepsi 3 harf) çöpe atıyordu. Geriye yalnız jenerik
// "congress" kalınca payda 1 oluyor ve benzerlik %100 çıkıyordu:
//   "ACS Clinical Congress (American College of Surgeons)"  ≈  "EHA Congress"   → %100 🔴
//   "23. Ulusal Hipertansiyon ... Kongresi"                 ≈  "60. TOD Ulusal Kongresi" → %100 🔴
// Doğru yaklaşım tersidir: kısa belirteçleri KORU, JENERİK olanları ele.

/** Addan yıl belirtecini düşür — "AAOS Annual Meeting 2027" ile "AAOS Annual Meeting" aynı kongredir. */
export function stripYear(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([),\]])/g, "$1")
    .trim();
}

/// Bilgi taşımayan jenerik belirteçler. Bunlar hemen her kongre adında geçtiği için
/// kesişimde sayılırlarsa alakasız iki kongre "benziyor" görünür.
const JENERIK = new Set([
  // TR
  "ulusal", "uluslararasi", "uluslararasi", "milli", "turk", "turkiye", "kongre", "kongresi",
  "sempozyum", "sempozyumu", "toplanti", "toplantisi", "dernegi", "dernek", "kurultay",
  "kurultayi", "bilimsel", "yillik", "katilimli", "birlikte", "ile", "ve", "gunleri", "haftasi",
  // EN
  "congress", "conference", "annual", "meeting", "society", "association", "international",
  "world", "european", "american", "national", "the", "of", "and", "scientific", "sessions",
  "session", "assembly", "week", "summit", "symposium", "joint",
]);

/** tr-TR küçük harf + ASCII'leştirme — congress-id.ts ile aynı harf eşlemesi. */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c");
}

/** Ayırt edici belirteçler: yıl ve sıra numaraları düşer, jenerikler elenir, KISA olanlar KALIR. */
function distinctiveTokens(s: string): Set<string> {
  return new Set(
    normalize(stripYear(s))
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 2)
      .filter((w) => !/^\d+$/.test(w)) // "23.", "60." gibi edisyon numaraları
      .filter((w) => !JENERIK.has(w)),
  );
}

/**
 * İki kongre adının aynı kongreyi gösterme olasılığı — 0..1.
 *
 * Ölçüt "kapsama"dır (kesişim / küçük kümenin boyutu), Jaccard DEĞİL: kongre adları çoğu zaman
 * uzun parantezli açıklamalarını kaybederek kısalır ("ERA Congress (European Renal Association)"
 * → "ERA Congress") ve Jaccard bunu uzunluk farkı yüzünden cezalandırıp GERÇEK eşleşmeyi kaçırır.
 *
 * Tek ayırt edici belirteci olan adlarda (kısalmış "ERA Congress" → {era}) kapsama ancak o
 * belirteç KARŞI TARAFTA da varsa 1.0 verir — yani "era" ile "eha" birbirini tutmaz.
 * Hiç ayırt edici belirteci olmayan ad (tamamı jenerik) DAİMA 0 döner: eşleşme uydurulmaz.
 */
export function nameSimilarity(a: string, b: string): number {
  const A = distinctiveTokens(a), B = distinctiveTokens(b);
  if (!A.size || !B.size) return 0;
  let ortak = 0;
  for (const t of A) if (B.has(t)) ortak++;
  return ortak / Math.min(A.size, B.size);
}

/** Sondaki parantezli eki düşür — "X Kongresi (TURKROM)" ile "X Kongresi" aynı kongredir. */
export function stripTrailingParen(s: string): string {
  return s.replace(/\s*\([^()]*\)\s*$/u, "").trim();
}

/**
 * KİMLİK anahtarı — iki adın "aynı kongre" sayılıp sayılmayacağının YAPISAL (bulanık olmayan)
 * ölçütü. Yıl belirteci ve sondaki parantezli ek düşürülür; kalan ad `congressExternalId`
 * ile normalize edilir.
 *
 * Neden bulanık eşleştirmeden AYRI: "…Türk Romatoloji Kongresi" ile "…Türk Romatoloji Kongresi
 * (TURKROM)" arasındaki fark yalnız bir parantezdir, ama ayırt edici belirteçleri jenerik
 * olduğu için (turk · romatoloji) IDF kapısı bunları eşleştiremez ve MÜKERRER satır doğar.
 * Yapısal kural bunu kesin olarak çözer; bulanık eşleştirme yalnız gerçek ad değişikliklerine kalır.
 */
export function identityKeyBase(name: string): string {
  return stripYear(stripTrailingParen(stripYear(name))).trim();
}

/** Ayırt edici belirteçler — dışa açık (bestMatch ve testler kullanır). */
export function tokens(s: string): Set<string> {
  return distinctiveTokens(s);
}

/**
 * Aday havuzu içinden en olası eşi bul — IDF (nadirlik) ağırlıklı.
 *
 * 🪤 NEDEN PAIRWISE `nameSimilarity` YETMEZ (v6.119'da veri kaybına yol açtı):
 * bir belirtecin bilgi değeri HANGİ HAVUZDA arandığına bağlıdır. Romatoloji branşında
 * "romatoloji" kelimesi neredeyse HER kongrede geçer, yani hiçbir şey ayırt etmez:
 *   "Ulusal Romatoloji Kongresi"  ≈  "3. TRASD Antalya Romatoloji Sempozyumu"  → %100 🔴
 * Sabit bir jenerik listesi bunu çözemez ("romatoloji" kardiyoloji havuzunda ayırt edicidir).
 * Gerçek olay: "…(TURKROM)" satırı yeniden adlandırma ararken %100 berabere kaldı ve YANLIŞ
 * satırı (Ulusal Romatoloji Kongresi) yuttu → gerçek bir kongre kaynaktan SİLİNDİ.
 *
 * Çözüm: her belirtece havuzdaki nadirliğine göre ağırlık ver (idf). Her adda geçen belirtecin
 * ağırlığı ~0 olur; bir kez geçen kısaltmanınki yüksek. Küçük kümenin toplam ağırlığı sıfıra
 * yakınsa (yani ayırt edici hiçbir kanıt yoksa) skor 0 döner — eşleşme UYDURULMAZ.
 */
export function bestMatch<T>(
  hedef: string,
  adaylar: T[],
  adiAl: (c: T) => string,
): { item: T; score: number } | null {
  if (!adaylar.length) return null;
  const hedefTok = distinctiveTokens(hedef);
  if (!hedefTok.size) return null;

  const adayTok = adaylar.map((c) => distinctiveTokens(adiAl(c)));
  const N = adaylar.length + 1;
  const df = new Map<string, number>();
  for (const küme of [...adayTok, hedefTok]) {
    for (const t of küme) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = (t: string) => Math.log(N / ((df.get(t) ?? 0) + 0.5));

  let en: { item: T; score: number } | null = null;
  for (let i = 0; i < adaylar.length; i++) {
    const A = hedefTok, B = adayTok[i];
    if (!B.size) continue;
    const paylasilan = [...A].filter((t) => B.has(t));
    if (!paylasilan.length) continue;

    // KANIT KAPISI — orandan ÖNCE gelir. Oran tek başına aldatıcıdır: tek ortak belirtecin
    // olduğu yerde pay = payda olur ve skor daima 1.0 çıkar, o belirteç ne kadar sıradan olursa
    // olsun ("Ulusal Romatoloji Kongresi" ↔ "TRASD Antalya Romatoloji Sempozyumu" → %100 🔴).
    // Kabul için ya EN AZ İKİ ortak belirteç ya da havuzda NEREDEYSE BENZERSİZ (df ≤ 2, yani
    // hedef + tek aday) bir ortak belirteç şart. "era" benzersizdir, "romatoloji" değildir.
    const nadirOrtak = paylasilan.some((t) => (df.get(t) ?? 0) <= 2);
    if (paylasilan.length < 2 && !nadirOrtak) continue;

    const kucuk = A.size <= B.size ? A : B;
    let payda = 0;
    for (const t of kucuk) payda += Math.max(0, idf(t));
    if (payda < 0.15) continue; // ayırt edici kanıt yok → eşleşme uydurma
    let pay = 0;
    for (const t of paylasilan) pay += Math.max(0, idf(t));
    const skor = Math.min(1, pay / payda);
    if (!en || skor > en.score) en = { item: adaylar[i], score: skor };
  }
  return en;
}

/** Yeniden adlandırma / halef eşiği — iki araç da aynı değeri kullanır. */
export const BENZERLIK_ESIGI = 0.6;
