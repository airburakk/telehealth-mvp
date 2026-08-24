// Kaynaklar arası kongre birleştirmesi (v6.121) — idempotent, kalıcı güvenlik ağı.
//
// SORUN: v6.120 TTB akredite etkinlik ingest'ini ekledi (source="ttb-kredilendirme").
// Küratörlü kayıtlar source="curated" ile duruyor. @@unique([source, externalId]) her
// kaynağı KENDİ İÇİNDE tekilleştirir ama kaynaklar ARASINDA eşleştirme yoktur → aynı
// etkinlik doktorun listesinde iki kart olur (ölçülen vaka: "35. Ulusal Patoloji
// Kongresi", 28-31 Ekim 2026 İstanbul — biri KNG34948, biri küratörlü).
//
// ⚠️ Bu, kardeş üç araçtan da FARKLI bir sorundur — dördü karıştırılmamalı:
//   • fix-congress-duplicates.ts → eski `branş:ad` kimlik ŞEMASININ göçü (v6.68)
//   • prune-congress-orphans.ts  → adı değişen kongrenin küratörlü ARTIĞI (v6.119)
//   • merge-congress-research.ts → ajan çıktısının seed KAYNAĞINA birleştirilmesi (v6.119)
//   • BU ARAÇ                    → iki AYRI KAYNAĞIN aynı etkinliği (v6.121)
// Üçü de tek kaynağın içine bakar; kaynaklar arasını yalnız bu araç görür.
//
// ── HANGİ SATIR KALIR: SEÇİM DEĞİL, ZORUNLULUK ────────────────────────────────
// Kalan satır TTB-DIŞI olmak ZORUNDA. Gerekçe estetik değil mekanik: seed-congresses.ts
// (curated, externalId) üzerinden upsert eder — küratörlü satır silinseydi bir sonraki seed
// onu geri yaratırdı. Aynı asimetri diğer yönde de var: ingest-ttb-events.ts
// (source, externalId) üzerinden upsert eder → TTB satırını silmek TEK BAŞINA KARARSIZDIR,
// bir sonraki ingest koşusu onu geri yaratır ve çift kayıt döner.
//   → Bu yüzden birleştirme, kalan satıra `ttbCode`'u ÇIPA olarak yazar; ingest (v6.121
//     yaması) önce çipaya bakar, başka kaynaktaki satırda bulursa YENİ SATIR AÇMAZ, yalnız
//     TTB'ye ait alanları tazeler. Çipa = akreditasyon kodunun kendisi (doğal anahtar);
//     yeni şema alanı, migration ve okuma yolu değişikliği GEREKMEZ.
//
// ── EŞLEŞTİRME: congress-match.ts'ten, YENİDEN TÜRETİLMEZ ────────────────────
// Ad benzerliği TEK KAYNAKTAN gelir (congress-match.ts) — kendi ölçütünü yazmak, bu aracın
// "aynı kongre" dediğine prune/merge araçlarının "farklı" demesi demektir. O modül iki dersi
// zaten kilitlemiş durumda (v6.119'da veri kaybıyla öğrenilmiş):
//   • JENERİK belirteç listesi — "ulusal/kongresi/congress/annual" gibi ŞABLON sözcükler
//     elenmezse alakasız kongreler benzer görünür ("52. Ulusal Hematoloji Kongresi" ile
//     "35. Ulusal Patoloji Kongresi" düz Jaccard'da 0.50, trigram-Dice'ta 0.84 alır — Dice
//     şablonu ÖDÜLLENDİRİR — ama FARKLI kongrelerdir).
//   • KANIT KAPISI — tek ortak belirteçle skor 1.0 çıkmasın diye ≥2 ortak belirteç ya da
//     havuzda neredeyse benzersiz (df≤2) bir belirteç şartı.
// Aday SEÇİMİ bu script'te değil, saf yardımcı modüldedir: `congress-cross-source.ts`
// (test: tests/unit/congress-cross-source.test.ts). Script'in içinde kalsaydı test edilemezdi
// ve yanlış bir "evet" sessizce satır siler + doktor takibini yanlış kongreye taşırdı.
// İki yol birlikte kullanılır (merge-congress-research.ts ile aynı desen):
//   1) YAPISAL: congressExternalId(identityKeyBase(ad)) eşitliği. Bulanık kapının göremediği
//      vakayı kesin çözer ("…Türk Romatoloji Kongresi" ↔ "…(TURKROM)": ayırt edici belirteçlerin
//      hepsi jenerik olduğu için IDF skoru düşük kalır, yapısal anahtar birebir tutar).
//   2) BULANIK: bestMatch(...) ≥ BENZERLIK_ESIGI. IDF havuzu TÜM TTB-dışı satırlardır —
//      tarihle daraltılmış küçük havuzda df anlamsızlaşır ve kanıt kapısı işlevsiz kalırdı.
//
// Ad benzerliği TEK BAŞINA yetmez; şu üç sinyal SKORDAN BAĞIMSIZ doğrular (bu yüzden skor
// kendini onaylayamaz):
//   • startDate farkı ≤ --gun (varsayılan 2)
//   • endDate ikisinde de doluysa ≤2 gün farklı olmalı (ölçümde 5/5 çiftte BİREBİR tuttu)
//   • şehir ikisinde de doluysa çelişmemeli
// Ayrıca KARŞILIKLI-EN-İYİ aranır: A'nın en iyisi B ve B'nin en iyisi A olmalı (bir TTB satırı
// iki küratörlü satıra da benziyorsa körlemesine birleştirmek veri kaybıdır).
// Bunlardan biri tutmazsa çift OTOMATİK BİRLEŞMEZ; İNCELE bandına düşer ve DOKUNULMADAN
// raporlanır. Sessiz karar verilmez.
//
// ── ALAN DEVRİ: ALAN ALAN, "kaynak kazanır" DEĞİL ────────────────────────────
// Ölçüm ikisinin de bir şey bildiğini gösterdi (dev, 5 eşleşen çift):
//   • Küratörlü: bildiri/erken kayıt tarihi, kayıt ücreti, temalar, url, dil, edisyon,
//     sıklık, kapak — TTB'de bu alanların TAMAMI boş (0/75).
//   • TTB: ttbCode (küratörlüde 0/172), doğrulanmış eventType (küratörlü satırların
//     TAMAMI varsayılan "kongre" — bilgi taşımıyor; TTB'de sempozyum/kurs/eğitim… var),
//     daha GENİŞ branş listesi (Toraks: TTB 3 branş ↔ küratör 1).
//   • cmeCredit'te küratörlü metin 3/5 çiftte TTB'ninkinden ZENGİN → yalnız boşsa doldurulur.
//   • `scope` de TTB'den devredilir (kullanıcı kararı, 2026-08-19). Ölçülen çatışma: Toraks
//     kongresinde küratör "ulusal", TTB "uluslararasi" diyordu. TTB akreditasyon OTORİTESİDİR
//     ve kapsamı resmî kayıtta tutar; ayrıca üç değerli ("uluslararasi-katilimli"), küratörlü
//     veri iki değerli → TTB daha ayrıntılı. Değişiklik SESSİZ DEĞİL, koşumda raporlanır.
//     ⚠️ scope doktorun BİRİNCİL süzgeç eksenidir; yanlış değer kongreyi yanlış listeye taşır.
//
// ── KOŞUM SIRASI (önemli) ────────────────────────────────────────────────────
//   seed-congresses.ts  →  ingest-ttb-events.ts  →  BU SCRIPT
// Gerekçe: seed'in `data` bloğu ttbCode/eventType İÇERMEZ (çipa seed'e dayanıklıdır ✓) ama
// branchSlugs/cmeCredit/sourceUrls/**scope** İÇERİR → seed yeniden koşarsa devredilen
// ZENGİNLEŞTİRME geri alınır (çipa kalır, süs gider). Bu script yeniden koşunca geri gelir;
// scope'u ingest de çipa dalından tazeler (seed sonrası ingest tek başına da yeter).
//
// İDEMPOTENT: birleşmiş çiftte TTB satırı artık yoktur → ikinci koşu 0 işlem raporlar.
// Yarım kalmış koşu (TTB satırı duruyor ama çipa yazılmış) da toparlanır: çipası başka
// kaynakta görünen TTB satırı yeniden SKORLANMAZ, doğrudan o satırla eşleştirilir.
// GERİ ALMA: kalan satırın ttbCode'unu null'a çekmek birleşmeyi bozar — bir sonraki ingest
// TTB satırını yeniden yaratır (bilinçli "birleştirmeyi geri al" yolu).
//
// GÜVENLİK: seed-congresses.ts ile aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Dokunulan tablolar: MedicalCongress + CongressFollow — PHI yok (kamuya açık etkinlik bilgisi).
//
// Kullanım:
//   npx tsx scripts/merge-congress-sources.ts                  → DEV dry-run
//   npx tsx scripts/merge-congress-sources.ts --yaz            → DEV'e uygula
//   npx tsx scripts/merge-congress-sources.ts --esik=0.75 --gun=1
//   npx tsx scripts/merge-congress-sources.ts --prod --yaz     → PROD'a uygula
import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { BENZERLIK_ESIGI } from "./congress-match";
import { caprazAdayBul, yapisalDizinKur, CAPRAZ_ALT_SINIR } from "./congress-cross-source";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const argVal = (ad: string) => args.find((a) => a.startsWith(`--${ad}=`))?.split("=")[1];

const TTB_SOURCE = "ttb-kredilendirme";

// Ad benzerliği eşiği kardeş araçlarla ORTAK (congress-match.BENZERLIK_ESIGI = 0.6) —
// ayrıştırmak, aynı iki adın araca göre farklı karara bağlanması demek olurdu.
const SKOR_ESIK = Number(argVal("esik") ?? BENZERLIK_ESIGI);
const GUN_ESIK = Number(argVal("gun") ?? 2);
// İNCELE bandı: birleştirilmez, yalnız raporlanır — "eşiğin dibinde ne var" görünür olsun
// diye. Sessiz eşik, gözden kaçan gerçek eşleşmeyi görünmez kılar.
const INCELE_SKOR = CAPRAZ_ALT_SINIR;
const INCELE_GUN = 7;

/** JSON string[] birleşimi (bozuk/boş değer sessizce atlanır, sıra korunur). */
function birlesim(...jsonDizileri: string[]): string[] {
  return [...new Set(jsonDizileri.flatMap((s) => {
    try {
      const v = JSON.parse(s) as unknown;
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  }))];
}

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run)" : "(YAZILACAK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }
  if (!Number.isFinite(SKOR_ESIK) || !Number.isFinite(GUN_ESIK)) {
    console.error("⛔ --esik / --gun sayı olmalı.");
    process.exit(1);
  }
  console.log(`⚙️  Eşik: ad skoru ≥ ${SKOR_ESIK} · Δgün ≤ ${GUN_ESIK} (İNCELE: ≥${INCELE_SKOR} / ≤${INCELE_GUN}g)`);

  // Dinamik import: db.ts env'i modül yüklenirken okur (yukarıdaki --prod ayarı önce bitmeli).
  const { db } = await import("../src/lib/db");

  // coverImage ÇEKİLMEZ (data URI ~5-20KB/kayıt) — bu script kapağa dokunmaz, kalan satırınki
  // olduğu gibi kalır; TTB satırlarında zaten kapak yok (ingest yazmıyor).
  const hepsi = await db.medicalCongress.findMany({
    select: {
      id: true, source: true, externalId: true, title: true, city: true,
      startDate: true, endDate: true, organizer: true, venue: true, scope: true,
      eventType: true, ttbCode: true, cmeCredit: true, branchSlugs: true,
      sourceUrls: true, verifiedAt: true, createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  type Satir = (typeof hepsi)[number];

  const ttbSatirlari = hepsi.filter((r) => r.source === TTB_SOURCE);
  // Sol taraf = TTB DIŞI her şey: küratörlü + elle girilmiş (source=null) kayıtlar. Elle
  // girilen satır da TTB kaydını çiftler; kaynağı null diye görmezden gelmek eksik tarama olurdu.
  const solSatirlar = hepsi.filter((r) => r.source !== TTB_SOURCE);
  console.log(`\n📚 Kayıt: TTB ${ttbSatirlari.length} · TTB-dışı ${solSatirlar.length} (toplam ${hepsi.length})`);

  if (!ttbSatirlari.length || !solSatirlar.length) {
    console.log("ℹ️  Eşleştirilecek kaynak çifti yok — çıkılıyor.");
    await db.$disconnect();
    return;
  }

  // ── Çipa taraması: yarım kalmış koşuyu toparla ────────────────────────────
  // Çipası (ttbCode) zaten TTB-dışı bir satırda görünen TTB satırı, önceki koşuda karara
  // bağlanmıştır → yeniden SKORLANMAZ, doğrudan o satırla eşleştirilir.
  const cipaSahibi = new Map<string, Satir[]>();
  for (const r of solSatirlar) {
    if (!r.ttbCode) continue;
    const g = cipaSahibi.get(r.ttbCode);
    g ? g.push(r) : cipaSahibi.set(r.ttbCode, [r]);
  }
  for (const [kod, sahipler] of cipaSahibi) {
    if (sahipler.length > 1) {
      console.error(`⚠️  ttbCode ${kod} BİRDEN ÇOK satırda: ${sahipler.map((s) => s.externalId ?? s.id).join(", ")}`);
      console.error("    → ingest hangisini tazeleyeceğini seçemez; fazlalık elle temizlenmeli.");
    }
  }

  // ── Eşleştirme ────────────────────────────────────────────────────────────
  // Aday seçimi congress-cross-source.ts'te (saf + test edilebilir); burası yalnız EŞİK
  // politikası ve yazma. Havuz TAM verilir — bestMatch IDF'i havuzdan hesaplar.
  interface Aday {
    sol: Satir; ttb: Satir; skor: number; yapisal: boolean; gunFark: number;
    sehirCelisiyor: boolean; bitisCelisiyor: boolean;
  }
  const yapisalDizin = yapisalDizinKur(solSatirlar);

  const adaylar: Aday[] = [];
  for (const ttb of ttbSatirlari) {
    if (ttb.ttbCode && cipaSahibi.has(ttb.ttbCode)) continue; // çipalı → aşağıda ele alınır
    const aday = caprazAdayBul(ttb, solSatirlar, ttbSatirlari, yapisalDizin);
    if (!aday || aday.gunFark > INCELE_GUN) continue;
    adaylar.push({ ttb, ...aday });
  }

  // Bir TTB-dışı satır iki TTB satırınca seçilmiş olabilir → yalnız en yüksek skorlu kalır.
  const solSahibi = new Map<string, Aday>();
  for (const a of adaylar) {
    const v = solSahibi.get(a.sol.id);
    if (!v || a.skor > v.skor) solSahibi.set(a.sol.id, a);
  }

  const otomatik: Aday[] = [];
  const incele: { a: Aday; neden: string }[] = [];
  for (const a of adaylar) {
    const nedenler: string[] = [];
    if (!a.yapisal && a.skor < SKOR_ESIK) nedenler.push(`ad skoru ${a.skor.toFixed(3)} < ${SKOR_ESIK}`);
    if (a.gunFark > GUN_ESIK) nedenler.push(`Δgün ${a.gunFark} > ${GUN_ESIK}`);
    if (a.sehirCelisiyor) nedenler.push(`şehir çelişiyor (${a.sol.city} ↔ ${a.ttb.city})`);
    if (a.bitisCelisiyor) nedenler.push("bitiş tarihi çelişiyor");
    if (solSahibi.get(a.sol.id) !== a) nedenler.push("aynı satır için daha güçlü aday var");
    nedenler.length ? incele.push({ a, neden: nedenler.join(" · ") }) : otomatik.push(a);
  }
  otomatik.sort((x, y) => y.skor - x.skor);

  // Çipalı (yarım kalmış) çiftler otomatik kümeye eklenir — karar önceki koşuda verilmişti.
  const cipali: Aday[] = [];
  for (const ttb of ttbSatirlari) {
    const sahipler = ttb.ttbCode ? cipaSahibi.get(ttb.ttbCode) : undefined;
    if (!sahipler?.length) continue;
    cipali.push({
      sol: sahipler[0], ttb, skor: 1, yapisal: true, gunFark: 0,
      sehirCelisiyor: false, bitisCelisiyor: false,
    });
  }
  if (cipali.length) console.log(`🔁 Yarım kalmış ${cipali.length} çift çipadan (ttbCode) toparlanacak.`);
  const birlesecek = [...cipali, ...otomatik];

  // ── Rapor + uygulama ──────────────────────────────────────────────────────
  console.log(`\n═══ OTOMATİK BİRLEŞECEK: ${birlesecek.length} ═══`);
  let tasinanTakip = 0, scopeCatismasi = 0, turDegisen = 0; // scopeCatismasi = TTB'ye çekilen kapsam sayısı

  for (const a of birlesecek) {
    const { sol, ttb } = a;
    const branslar = birlesim(sol.branchSlugs, ttb.branchSlugs);
    const kaynaklar = birlesim(sol.sourceUrls, ttb.sourceUrls);
    // cmeCredit: küratörlü metin ölçümde daha zengin → yalnız BOŞSA TTB'ninki yazılır.
    const cme = sol.cmeCredit || ttb.cmeCredit || null;
    const dogrulama = [sol.verifiedAt, ttb.verifiedAt].filter(Boolean) as Date[];

    console.log(`\n🔗 ${sol.title.slice(0, 70)}`);
    console.log(`   kalan  : [${sol.source ?? "elle"}] ${sol.externalId ?? sol.id} · ${sol.startDate.toISOString().slice(0, 10)} · ${sol.city ?? "-"}`);
    console.log(`   silinen: [TTB] ${ttb.ttbCode} · ${ttb.startDate.toISOString().slice(0, 10)} · ${ttb.city ?? "-"} (${a.yapisal ? "yapısal" : `ad ${a.skor.toFixed(3)}`} · Δ${a.gunFark}g)`);
    console.log(`   devir  : ttbCode=${ttb.ttbCode} · tür ${sol.eventType} → ${ttb.eventType}${sol.eventType !== ttb.eventType ? " ⭐" : ""}`);
    console.log(`            branş [${branslar.join(", ")}] · kaynakURL ${kaynaklar.length} · cme ${sol.cmeCredit ? "küratörlü korunur" : (ttb.cmeCredit ? "TTB'den dolduruldu" : "yok")}`);
    if (sol.eventType !== ttb.eventType) turDegisen++;
    if (sol.scope !== ttb.scope) {
      scopeCatismasi++;
      console.log(`   ↔ SCOPE: küratörlü "${sol.scope}" → TTB "${ttb.scope}" (TTB yetkili — akreditasyon kaydı)`);
    }

    // Takip taşıma: TTB satırındaki takipler kalan satıra geçer. Şemada FK/relation YOK →
    // taşınmazsa takipler sessizce yetim kalır ve kongre alarmları ölür.
    // Aynı doktor iki satırı da takip ediyorsa tek kayıt kalır, sentAlerts ∪ (alarm tekrarlanmaz).
    const takipler = await db.congressFollow.findMany({ where: { congressId: { in: [sol.id, ttb.id] } } });
    const doktorBazli = new Map<string, typeof takipler>();
    for (const t of takipler) {
      const g = doktorBazli.get(t.doctorId);
      g ? g.push(t) : doktorBazli.set(t.doctorId, [t]);
    }
    const takipIslemleri: Prisma.PrismaPromise<unknown>[] = [];
    let grupTakip = 0;
    for (const tGrup of doktorBazli.values()) {
      if (tGrup.length === 1 && tGrup[0].congressId === sol.id) continue; // zaten yerinde
      const alarmlar = birlesim(...tGrup.map((t) => t.sentAlerts));
      const tutulan = tGrup.find((t) => t.congressId === sol.id) ?? tGrup[0];
      takipIslemleri.push(db.congressFollow.update({
        where: { id: tutulan.id },
        data: { congressId: sol.id, sentAlerts: JSON.stringify(alarmlar) },
      }));
      for (const t of tGrup) {
        if (t.id !== tutulan.id) takipIslemleri.push(db.congressFollow.delete({ where: { id: t.id } }));
      }
      grupTakip += tGrup.filter((t) => t.congressId !== sol.id).length;
    }
    tasinanTakip += grupTakip;
    if (grupTakip) console.log(`   takip  : ${grupTakip} kayıt kalan satıra taşınıyor/birleşiyor`);

    if (DRY) continue;

    // Sıra ÖNEMLİ: önce TTB satırı silinir, sonra çipa yazılır — böylece hiçbir anda
    // ttbCode iki satırda birden durmaz (ingest'in çipa aramasını ikircikli bırakırdı).
    await db.$transaction([
      ...takipIslemleri,
      db.medicalCongress.delete({ where: { id: ttb.id } }),
      db.medicalCongress.update({
        where: { id: sol.id },
        data: {
          ttbCode: ttb.ttbCode,
          eventType: ttb.eventType,
          // scope TTB'den (kullanıcı kararı 2026-08-19) — akreditasyon otoritesi kapsamı
          // resmî kayıtta tutar ve üç değerli; küratörlü veri iki değerli.
          scope: ttb.scope,
          cmeCredit: cme,
          organizer: sol.organizer ?? ttb.organizer,
          venue: sol.venue ?? ttb.venue,
          branchSlugs: JSON.stringify(branslar),
          sourceUrls: JSON.stringify(kaynaklar),
          verifiedAt: dogrulama.length
            ? new Date(Math.max(...dogrulama.map((d) => d.getTime())))
            : null,
        },
      }),
    ]);
  }

  // ── İNCELE bandı: dokunulmaz, görünür kılınır ─────────────────────────────
  incele.sort((x, y) => y.a.skor - x.a.skor);
  console.log(`\n═══ İNCELE (birleştirilmedi, eşiğin dibinde): ${incele.length} ═══`);
  for (const { a, neden } of incele.slice(0, 25)) {
    console.log(`\n  ad ${a.skor.toFixed(3)} · Δ${a.gunFark}g — ${neden}`);
    console.log(`    [${a.sol.source ?? "elle"}] ${a.sol.title.slice(0, 70)} · ${a.sol.startDate.toISOString().slice(0, 10)} · ${a.sol.city ?? "-"}`);
    console.log(`    [TTB]      ${a.ttb.title.slice(0, 70)} · ${a.ttb.startDate.toISOString().slice(0, 10)} · ${a.ttb.city ?? "-"} · ${a.ttb.ttbCode}`);
  }
  if (incele.length > 25) console.log(`\n  … ve ${incele.length - 25} çift daha.`);

  console.log(
    `\n${DRY ? "🔍 DRY-RUN (yazılmadı; uygulamak için --yaz)" : "✅ Uygulandı"} — ` +
    `birleşen ${birlesecek.length} · taşınan takip ${tasinanTakip} · tür düzeltilen ${turDegisen} · ` +
    `incelenecek ${incele.length}` +
    (scopeCatismasi ? ` · scope TTB'ye çekilen ${scopeCatismasi}` : ""),
  );
  if (!DRY && birlesecek.length) {
    console.log("↪️  Sonraki ingest koşusu bu etkinlikleri ttbCode çipasından tanıyacak (yeni satır AÇMAZ).");
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("⛔", e);
  process.exit(1);
});
