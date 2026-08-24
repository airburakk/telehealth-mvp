// Kongre YETİM (hayalet) satır temizleyicisi (v6.119) — kalıcı araç.
//
// SORUN: `seed-congresses.ts` idempotenttir ama YALNIZ upsert yapar — hiçbir satırı silmez.
// Bir kongrenin adı değişince `externalId` (addan üretilir) de değişir → seed YENİ satır açar,
// eski satır DB'de KALIR. Tarihi gelecekteyse `upcomingCongresses` ikisini de döndürür ve doktor
// takvimde AYNI kongreyi İKİ KEZ görür. 2026-08-19 turunda DEV'de 9 yetim oluştu, 8'i görünürdü.
//
// ⚠️ Bu, `fix-congress-duplicates.ts`ten FARKLI bir sorundur: o, eski `branş:ad` biçimli kimlikleri
// göç ettirir (kimlik ŞEMASI değişimi); bu ise adı değişen kongrenin ARTIĞINI toplar.
//
// NE YAPAR:
//   1) `source="curated"` DB satırlarından `congresses.json`'da kimliği BULUNMAYANLARI bulur.
//   2) Her yetim için güncel satırlar arasından en olası HALEFİ arar (yıl-soyulmuş ad benzerliği).
//   3) Yetimi takip eden doktorların `CongressFollow` kayıtlarını halefe TAŞIR (doktor takibini
//      kaybetmesin). Doktor halefi zaten takip ediyorsa yinelenen kayıt silinir (unique kısıt).
//   4) Yetim satırı siler.
//
// HALEFİ BULUNAMAYAN yetim SİLİNMEZ — raporlanır. Sebep: gerçekten kaldırılmış bir kongre ile
// ad benzerliği eşiğinin altında kalan bir yeniden adlandırmayı ayırt edemeyiz; sessizce silmek
// veri kaybı riskidir. Bilinçli silmek için --halefsiz-de-sil.
//
// GÜVENLİK: kardeş araçlarla aynı korkuluk deseni —
//   • Varsayılan DRY-RUN (yazma için --yaz)
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL
//   • --prod'suz DATABASE_URL prod parmak izine uyuyorsa DURUR
// Silinen tek şey kamuya açık kongre kaydıdır — PHI yok. Yine de SİLME işlemidir: önce dry-run.
//
// Kullanım:
//   npx tsx scripts/prune-congress-orphans.ts                 → DEV raporu (dry-run)
//   npx tsx scripts/prune-congress-orphans.ts --yaz           → DEV'de temizle
//   npx tsx scripts/prune-congress-orphans.ts --prod          → PROD raporu (dry-run)
//   npx tsx scripts/prune-congress-orphans.ts --prod --yaz    → PROD'da temizle
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { congressExternalId } from "./congress-id";
import { bestMatch, BENZERLIK_ESIGI } from "./congress-match";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const HALEFSIZ_DE_SIL = args.includes("--halefsiz-de-sil");

/// SİLME eşiği — birleştirmedeki yeniden-adlandırma eşiğinden (0.6) BİLİNÇLİ OLARAK YÜKSEK.
/// Asimetrik risk: yanlış yeniden adlandırma bir adı bozar (geri alınabilir), yanlış SİLME
/// gerçek bir kaydı ve doktorun takibini yok eder. Gerçek vaka (2026-08-19 prod dry-run):
///   "16. ESPRAS Quadrennial Congress" ≈ "Plastic Surgery The Meeting (ASPS)" → %62
/// Ortak belirteçler "plastic + surgery" — ikisi de plastik cerrahi havuzunda jenerik.
/// 0.6 eşiği bunu silerdi; 0.8 eşiği "halef bulunamadı" deyip DOKUNMUYOR.
const SILME_ESIGI = 0.8;
async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run)" : "(SİLİNECEK)"}`);
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(silinecek)"}`);
  }

  const { db } = await import("../src/lib/db");

  const kaynak = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data", "congresses.json"), "utf-8"),
  ) as { name: string; branchSlug: string; nextStart?: string | null }[];
  const gecerliKimlik = new Set(kaynak.map((r) => congressExternalId(r.name)));
  // Kapsama ölçüsü TARİHLİ kayıtlar üzerinden: seed `startDate` zorunlu olduğu için tarihsiz
  // satırlar DB'ye HİÇ girmez (bilinçli — takvim "tarihi belirsiz" satır göstermez). Kapsamayı
  // tüm kimlikler üzerinden ölçmek tavanı %78'e çakar ve bekçiyi yanlış alarma sürükler.
  const seedlenebilir = new Set(kaynak.filter((r) => r.nextStart).map((r) => congressExternalId(r.name)));

  const curated = await db.medicalCongress.findMany({
    where: { source: "curated" },
    select: { id: true, externalId: true, title: true, startDate: true, branchSlugs: true },
  });

  const yetimler = curated.filter((c) => c.externalId && !gecerliKimlik.has(c.externalId));
  const guncel = curated.filter((c) => c.externalId && gecerliKimlik.has(c.externalId));

  // 🔴 SIRA BEKÇİSİ: bu araç seed'den SONRA koşar. Önce koşarsa halef havuzu eksik olur ve
  // yetim, alakasız bir kayda eşleşip SİLİNİR (2026-08-19 prod dry-run: ESPRAS → ASPS %62).
  // Kaynaktaki kimliklerin büyük bölümü DB'de yoksa seed henüz koşmamıştır.
  const dbKimlik = new Set(guncel.map((c) => c.externalId as string));
  let kapsanan = 0;
  for (const k of seedlenebilir) if (dbKimlik.has(k)) kapsanan++;
  const kapsama = kapsanan / Math.max(1, seedlenebilir.size);
  if (kapsama < 0.9) {
    console.error(`
⛔ DURDURULDU — kaynaktaki ${seedlenebilir.size} TARİHLİ kimliğin yalnız ${kapsanan}'i DB'de (%${Math.round(kapsama * 100)}).`);
    console.error(`   Bu, seed'in HENÜZ KOŞMADIĞI anlamına gelir. Halef havuzu eksikken yetim eşleştirmesi`);
    console.error(`   yanlış kayıt siler. Önce: npx tsx scripts/seed-congresses.ts ${PROD ? "--prod " : ""}--yaz`);
    await db.$disconnect();
    process.exit(1);
  }

  console.log(`\n📚 Küratörlü DB satırı: ${curated.length} · JSON kimliği: ${gecerliKimlik.size}`);
  console.log(`👻 YETİM: ${yetimler.length}`);
  if (!yetimler.length) {
    console.log("\n✅ Temiz — yapılacak iş yok.");
    await db.$disconnect();
    return;
  }

  const bugun = new Date();
  let silinen = 0, tasinanTakip = 0, atlanan = 0;

  for (const y of yetimler) {
    // IDF ağırlıklı: aday havuzu = kaynakta karşılığı olan tüm küratörlü satırlar.
    const eslesme = bestMatch(y.title, guncel, (g) => g.title);
    const aday = eslesme ? { g: eslesme.item, s: eslesme.score } : null;
    const halef = aday && aday.s >= SILME_ESIGI ? aday.g : null;
    const gorunur = y.startDate >= bugun;
    const takipler = await db.congressFollow.findMany({
      where: { congressId: y.id },
      select: { id: true, doctorId: true },
    });

    const bayrak = gorunur ? "🔴 GÖRÜNÜR" : "⚫ geçmiş";
    console.log(`\n${bayrak}  ${y.title}`);
    console.log(`    kimlik: ${y.externalId} · tarih: ${y.startDate.toISOString().slice(0, 10)} · takip: ${takipler.length}`);

    if (!halef) {
      if (!HALEFSIZ_DE_SIL) {
        console.log(`    ⏭️  HALEF BULUNAMADI (en yakın: ${aday ? `"${aday.g.title}" %${Math.round(aday.s * 100)}` : "yok"} · silme eşiği %${SILME_ESIGI * 100}) → DOKUNULMADI`);
        atlanan++;
        continue;
      }
      console.log(`    ⚠️  Halef yok ama --halefsiz-de-sil verildi → silinecek`);
    } else {
      console.log(`    ↪️  halef: "${halef.title}" (benzerlik %${Math.round((aday?.s ?? 0) * 100)})`);
    }

    if (DRY) {
      silinen++;
      tasinanTakip += takipler.length;
      continue;
    }

    // Takipleri halefe taşı — doktor zaten halefi takip ediyorsa yinelenen kaydı sil (unique kısıt).
    if (halef) {
      for (const t of takipler) {
        const zaten = await db.congressFollow.findUnique({
          where: { doctorId_congressId: { doctorId: t.doctorId, congressId: halef.id } },
          select: { id: true },
        });
        if (zaten) {
          await db.congressFollow.delete({ where: { id: t.id } });
        } else {
          await db.congressFollow.update({ where: { id: t.id }, data: { congressId: halef.id } });
          tasinanTakip++;
        }
      }
    } else {
      // Halefsiz silmede takipler de gider (kayıt kalmayınca takip anlamsız).
      await db.congressFollow.deleteMany({ where: { congressId: y.id } });
    }

    await db.medicalCongress.delete({ where: { id: y.id } });
    silinen++;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`${DRY ? "🔍 DRY-RUN" : "✅ Uygulandı"} — silinen ${silinen} · taşınan takip ${tasinanTakip} · dokunulmayan ${atlanan}`);
  if (DRY) console.log(`   Uygulamak için: --yaz${PROD ? " (--prod ile birlikte)" : ""}`);
  if (atlanan) console.log(`   Halefsiz ${atlanan} yetim korundu — bilinçli silmek için --halefsiz-de-sil`);

  const kalan = await db.medicalCongress.count();
  console.log(`\nHedef DB: toplam ${kalan} kongre`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
