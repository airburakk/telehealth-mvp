// EKLEMELİ (additive) demo veri betiği — canlı Neon'a YALNIZCA yeni demo vakaları ekler.
// HİÇBİR ŞEY SİLMEZ (deleteMany YOK) → mevcut canlı veri (İkinci Görüş, Ücretsiz Sağlık Hizmeti, FHIR vb.) korunur.
// Tekrar çalıştırılabilir (idempotent): aynı isimli vaka zaten varsa atlanır.
// Branş/aciliyet kural-tabanlı triyajdan türetilir (seed.ts ile aynı mantık) → AI anahtarı gerekmez.
// Çalıştır: npx tsx scripts/add-demo-cases.ts
import { PrismaClient } from "@prisma/client";
import { analyzeTriage } from "../src/lib/triage";
import { assessCheckIn } from "../src/lib/postop";
import { computePackage } from "../src/lib/pricing";

const db = new PrismaClient();

// createdAt son 14 güne yayılır → operasyon panelindeki "14 gün trend" grafiği dolar.
const NEW_CASES = [
  { patientName: "James W.", country: "GB", language: "İngilizce", symptoms: "Her iki gözümde yüksek miyop var, kalın gözlük kullanıyorum. Lasik lazer tedavisi ile görme kusurumdan kurtulmak istiyorum.", durationText: "2 yıl", attachments: "goz-muayene.pdf", assign: true, daysAgo: 11 },
  { patientName: "Hans M.", country: "DE", language: "Almanca", symptoms: "Üst çenemde birkaç eksik diş var. İmplant ve gülüş tasarımı (gülüş estetiği) için tedavi planı ve fiyat teklifi istiyorum.", durationText: "8 ay", attachments: "panoramik-rontgen.jpg", assign: false, daysAgo: 2 },
  { patientName: "Natalia V.", country: "RU", language: "Rusça", symptoms: "Burun şeklimden ve burun kemerimden memnun değilim. Rinoplasti (burun estetiği) ameliyatı düşünüyorum.", durationText: "1 yıl", attachments: "profil-foto.jpg", assign: false, daysAgo: 6 },
  { patientName: "Klaus B.", country: "DE", language: "Almanca", symptoms: "Babamda prostat büyümesi var, geceleri sık idrara çıkıyor ve işeme zorluğu yaşıyor. Üroloji değerlendirmesi ve PSA takibi istiyoruz.", durationText: "5 ay", attachments: "psa-sonuc.pdf", assign: true, daysAgo: 9 },
  { patientName: "Aibek S.", country: "KG", language: "Kırgızca", symptoms: "Kronik sinüzit ve burun tıkanıklığı şikayetim var, sürekli geniz akıntısı ve horlama oluyor. KBB cerrahisi gerekebilir mi?", durationText: "2 yıl", attachments: "", assign: false, daysAgo: 1 },
  { patientName: "Günel A.", country: "AZ", language: "Azerice", symptoms: "Rahimde miyom tespit edildi, adet düzensizliği ve kasık ağrısı yaşıyorum. Kadın doğum (jinekoloji) görüşü ve tedavi seçenekleri istiyorum.", durationText: "7 ay", attachments: "ultrason.pdf", assign: true, daysAgo: 7 },
  { patientName: "Nurlan T.", country: "KZ", language: "Kazakça", symptoms: "Kronik böbrek hastalığı son evrede, böbrek nakli için canlı verici (donör) değerlendirmesi istiyoruz. Uzun süredir nakil bekleme listesindeyiz.", durationText: "1 yıl", attachments: "nefroloji-raporu.pdf", assign: false, daysAgo: 12 },
  { patientName: "Mehmet K.", country: "TR", language: "Türkçe", symptoms: "Bel fıtığı nedeniyle bacağıma yayılan ağrı ve uyuşma var. Omurga cerrahisi / disk ameliyatı gerekli mi diye nöroşirürji görüşü istiyorum.", durationText: "4 ay", attachments: "bel-MR.pdf", assign: false, daysAgo: 4 },
  { patientName: "Stefan R.", country: "DE", language: "Almanca", symptoms: "Uzun süredir KOAH hastasıyım; öksürük, balgam ve hırıltı artıyor. Astım tedavimin gözden geçirilmesini istiyorum.", durationText: "3 yıl", attachments: "", assign: false, daysAgo: 0 },
  { patientName: "Pierre L.", country: "FR", language: "Fransızca", symptoms: "Sürekli reflü ve mide yanması var, gastrit şüphesiyle endoskopi planlanıyor. Gastroenteroloji ikinci görüşü istiyorum.", durationText: "6 ay", attachments: "endoskopi-rapor.pdf", assign: true, daysAgo: 8 },
  { patientName: "Irina M.", country: "RU", language: "Rusça", symptoms: "Cilt yüzeyimde renk değiştiren şüpheli bir ben var; ben kontrolü ve cilt muayenesi istiyorum. Yüzümde akne ve leke de var.", durationText: "3 ay", attachments: "ben-foto.jpg", assign: false, daysAgo: 3 },
  { patientName: "Aliya N.", country: "KZ", language: "Kazakça", symptoms: "Tiroid bezimde guatr var ve hormon değerlerim düzensiz. Halsizlik ve kilo değişimi yaşıyorum, endokrinoloji takibi istiyorum.", durationText: "1 yıl", attachments: "tiroid-usg.pdf", assign: false, daysAgo: 10 },
  { patientName: "Sergey D.", country: "RU", language: "Rusça", symptoms: "Sürekli halsizlik ve kansızlık (anemi) var, hemoglobin düşük çıkıyor. Boyunda şişlik nedeniyle lenfoma açısından hematoloji değerlendirmesi istiyoruz.", durationText: "5 ay", attachments: "kan-tahlili.pdf", assign: true, daysAgo: 5 },
  { patientName: "Emma T.", country: "GB", language: "İngilizce", symptoms: "Aylardır depresyon ve yoğun anksiyete yaşıyorum, uykusuzluk ve sürekli stres var. Psikiyatri desteği ve psikoterapi istiyorum.", durationText: "8 ay", attachments: "", assign: false, daysAgo: 13 },
  { patientName: "Elnur M.", country: "AZ", language: "Azerice", symptoms: "Kalp kapağı yetmezliğim var, kapak ameliyatı ve bypass önerildi. Açık kalp cerrahisi / kalp ameliyatı için kalp ve damar cerrahisi ikinci görüşü istiyorum.", durationText: "2 ay", attachments: "anjiyo-rapor.pdf", assign: false, daysAgo: 2 },
];

async function main() {
  const patientUser = await db.user.findUnique({ where: { email: "hasta@air.test" } });
  const doctors = await db.doctor.findMany();
  if (!doctors.length) { console.warn("⚠ Canlı DB'de hekim yok — önce ana seed gerekebilir."); }

  const byName: Record<string, string> = {};
  const addedNames = new Set<string>();
  let added = 0, skipped = 0;

  for (const c of NEW_CASES) {
    const existing = await db.case.findFirst({ where: { patientName: c.patientName } });
    if (existing) { byName[c.patientName] = existing.id; skipped++; continue; }
    const a = analyzeTriage({ symptoms: c.symptoms, durationText: c.durationText });
    const matchDoctor = doctors.find((d) => d.branch === a.branch);
    const created = await db.case.create({
      data: {
        userId: patientUser?.id ?? null, // demo vakalar demo hastaya ait (hasta↔vaka sahipliği)
        patientName: c.patientName, country: c.country, language: c.language,
        symptoms: c.symptoms, durationText: c.durationText, attachments: c.attachments || null,
        branch: a.branch, urgency: a.urgency, confidence: a.confidence, reasoning: a.reasoning,
        status: c.assign && matchDoctor ? "IN_REVIEW" : "NEW",
        doctorId: c.assign && matchDoctor ? matchDoctor.id : null,
        createdAt: new Date(Date.now() - c.daysAgo * 86400000),
      },
    });
    byName[c.patientName] = created.id;
    addedNames.add(c.patientName);
    added++;
  }

  // Natalia (Estetik · rinoplasti) — normal seyreden post-op takibi (yalnız bu çalıştırmada eklendiyse)
  const nataliaId = byName["Natalia V."];
  if (nataliaId && addedNames.has("Natalia V.")) {
    const rec = await db.recovery.create({ data: { caseId: nataliaId, branch: "Estetik Cerrahi", startedAt: new Date(Date.now() - 6 * 86400000) } });
    const checkins = [
      { pain: 4, feverC: 37.0, meds: true, note: "Burun bölgesinde şişlik ve hafif morluk var, beklenen düzeyde.", days: 5 },
      { pain: 2, feverC: 36.6, meds: true, note: "Şişlik azaldı, atel çıkarıldı, genel durum iyi.", days: 2 },
    ];
    for (const ci of checkins) {
      await db.checkIn.create({ data: { recoveryId: rec.id, pain: ci.pain, feverC: ci.feverC, meds: ci.meds, note: ci.note, severity: assessCheckIn(ci).severity, createdAt: new Date(Date.now() - ci.days * 86400000) } });
    }
  }

  // James (Göz) — tamamlanmış "mutlu yol": görüşme + Escrow RELEASED rezervasyon + DONE (gelir/Escrow çeşitliliği)
  const jamesId = byName["James W."];
  const jCase = jamesId && addedNames.has("James W.") ? await db.case.findUnique({ where: { id: jamesId } }) : null;
  if (jCase && jCase.doctorId) {
    await db.consultation.create({ data: { caseId: jCase.id, doctorId: jCase.doctorId, status: "ENDED", startedAt: new Date(Date.now() - 3 * 86400000), endedAt: new Date(Date.now() - 3 * 86400000), notes: "Görüşme tamamlandı." } });
    const sel = { branch: jCase.branch, country: jCase.country, tier: "Standart" as const, hotelStars: 4 as const, hospitalType: "Özel" as const, nights: 4, translator: false, insuranceExtended: true, insuranceMalpractice: false };
    const q = computePackage(sel);
    await db.booking.create({
      data: {
        caseId: jCase.id, branch: sel.branch, country: sel.country, tier: sel.tier, hotelStars: sel.hotelStars,
        hospitalType: sel.hospitalType, nights: sel.nights, translator: sel.translator,
        insuranceExtended: sel.insuranceExtended, insuranceMalpractice: sel.insuranceMalpractice,
        subtotal: q.subtotal, platformFee: q.platformFee, total: q.total, currency: q.currency,
        breakdown: JSON.stringify(q.items), split: JSON.stringify(q.split),
        status: "CONFIRMED", escrowStatus: "RELEASED", createdAt: new Date(Date.now() - 2 * 86400000),
      },
    });
    await db.case.update({ where: { id: jCase.id }, data: { status: "DONE" } });
  }

  const total = await db.case.count();
  console.log(`✓ Eklendi: ${added} vaka · atlandı (zaten vardı): ${skipped} · canlıdaki toplam vaka: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
