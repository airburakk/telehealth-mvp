import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { analyzeTriage } from "../src/lib/triage";
import { assessCheckIn } from "../src/lib/postop";
import { computePackage } from "../src/lib/pricing";

const db = new PrismaClient();

const DOCTORS = [
  { name: "Mehmet Yıldız", title: "Prof. Dr.", branch: "Onkoloji", city: "İstanbul", languages: "Türkçe,İngilizce,Arapça", color: "#0f2a4a", bio: "Tıbbi onkoloji, akciğer ve meme kanseri. 22 yıl deneyim, JCI akrediteli merkez." },
  { name: "Ayşe Demir", title: "Prof. Dr.", branch: "Kardiyoloji", city: "Ankara", languages: "Türkçe,Rusça", color: "#9a1750", bio: "Girişimsel kardiyoloji, koroner anjiyo ve stent." },
  { name: "Caner Aksoy", title: "Op. Dr.", branch: "Ortopedi", city: "İzmir", languages: "Türkçe,İngilizce", color: "#0e7490", bio: "Diz ve kalça protezi, spor yaralanmaları, artroskopi." },
  { name: "Elif Kaya", title: "Doç. Dr.", branch: "Tüp Bebek (IVF)", city: "İstanbul", languages: "Türkçe,Rusça,İngilizce", color: "#7c3aed", bio: "Üreme endokrinolojisi ve IVF. Yüksek başarı oranlı laboratuvar." },
  { name: "Burak Şahin", title: "Op. Dr.", branch: "Saç Ekimi", city: "İstanbul", languages: "Türkçe,İngilizce,Arapça", color: "#b45309", bio: "FUE ve DHT saç ekimi, sakal ve kaş ekimi." },
  { name: "Selin Arslan", title: "Op. Dr.", branch: "Estetik Cerrahi", city: "İstanbul", languages: "Türkçe,Rusça", color: "#be185d", bio: "Rinoplasti, meme estetiği ve vücut şekillendirme." },
  { name: "Hakan Çelik", title: "Prof. Dr.", branch: "Nöroşirürji", city: "Ankara", languages: "Türkçe,İngilizce", color: "#1d4ed8", bio: "Omurga cerrahisi, bel ve boyun fıtığı, beyin tümörleri." },
  { name: "Deniz Yalçın", title: "Uzm. Dr.", branch: "Dahiliye (İç Hastalıkları)", city: "İstanbul", languages: "Türkçe,İngilizce", color: "#047857", bio: "İç hastalıkları, diyabet ve genel tıbbi değerlendirme." },
];

const CASES = [
  { patientName: "Karim B.", country: "DZ", language: "Arapça", symptoms: "Babamda akciğer kanseri şüphesi var. Biyopsi sonucu çıktı, ikinci görüş ve tedavi planı istiyoruz.", durationText: "2 ay", attachments: "akciger-BT.pdf,biyopsi-raporu.pdf", assign: false },
  { patientName: "Olga P.", country: "RU", language: "Rusça", symptoms: "Saç dökülmesi son aylarda çok arttı, ön bölge açıldı. FUE saç ekimi düşünüyorum.", durationText: "1 yıl", attachments: "sac-fotograf.jpg", assign: false },
  { patientName: "Aigerim T.", country: "KZ", language: "Kazakça", symptoms: "3 yıldır çocuğumuz olmuyor, tüp bebek (IVF) tedavisi araştırıyoruz. Hormon tahlillerimiz mevcut.", durationText: "3 yıl", attachments: "hormon-paneli.pdf", assign: true },
  { patientName: "Ahmed M.", country: "LY", language: "Arapça", symptoms: "Dizimde menisküs yırtığı var, MR çektirdim. Protez gerekebilir dediler, ortopedi görüşü istiyorum.", durationText: "6 ay", attachments: "diz-MR.pdf", assign: false },
  { patientName: "Dmitry K.", country: "RU", language: "Rusça", symptoms: "Şiddetli göğüs ağrısı, nefes darlığı ve çarpıntı şikayetim var. Tansiyonum yüksek.", durationText: "3 gün", attachments: "", assign: false },
];

async function main() {
  console.log("Temizleniyor...");
  await db.complaint.deleteMany();
  await db.checkIn.deleteMany();
  await db.recovery.deleteMany();
  await db.booking.deleteMany();
  await db.consultation.deleteMany();
  await db.case.deleteMany();
  await db.doctor.deleteMany();
  await db.user.deleteMany();

  console.log("Kullanıcılar ekleniyor...");
  const pw = await bcrypt.hash("1234", 10);
  const USERS = [
    { email: "hasta@air.test", name: "Demo Hasta", role: "PATIENT" },
    { email: "doktor@air.test", name: "Dr. Demo Hekim", role: "DOCTOR" },
    { email: "koordinator@air.test", name: "Demo Koordinatör", role: "COORDINATOR" },
    { email: "kurul@air.test", name: "Kurul Üyesi", role: "ETHICS" },
  ];
  for (const u of USERS) await db.user.create({ data: { ...u, passwordHash: pw } });

  console.log("Doktorlar ekleniyor...");
  const doctors = [];
  let di = 0;
  for (const d of DOCTORS) {
    doctors.push(await db.doctor.create({
      data: {
        ...d,
        rating: Math.round((4.4 + ((di * 7) % 6) / 10) * 10) / 10,
        successRate: 90 + ((di * 3) % 9),
        experienceYears: 8 + ((di * 5) % 18),
        capacity: 12 + ((di * 4) % 18),
      },
    }));
    di++;
  }

  // M6: doğrulanmış hasta yorumları + demo doktor kullanıcısını profiline bağla
  const REVIEWS = [
    { author: "O. Petrov", country: "RU", stars: 5, text: "Süreç çok profesyoneldi, dil bariyeri hiç yaşamadık. Teşekkürler." },
    { author: "A. Benali", country: "DZ", stars: 5, text: "İkinci görüş ve tedavi planı için ideal. Doktor çok ilgiliydi." },
    { author: "K. Sultanov", country: "KZ", stars: 4, text: "Sonuçtan memnunuz, post-op takip süreci de iyiydi." },
  ];
  for (const dr of [doctors[0], doctors[1], doctors[3]]) {
    for (const rv of REVIEWS) await db.review.create({ data: { doctorId: dr.id, ...rv } });
  }
  await db.user.update({ where: { email: "doktor@air.test" }, data: { doctorId: doctors[0].id } });

  console.log("Demo vakalar ekleniyor...");
  const byName: Record<string, string> = {};
  for (const c of CASES) {
    const a = analyzeTriage({ symptoms: c.symptoms, durationText: c.durationText });
    const matchDoctor = doctors.find((doc) => doc.branch === a.branch);
    const created = await db.case.create({
      data: {
        patientName: c.patientName,
        country: c.country,
        language: c.language,
        symptoms: c.symptoms,
        durationText: c.durationText,
        attachments: c.attachments || null,
        branch: a.branch,
        urgency: a.urgency,
        confidence: a.confidence,
        reasoning: a.reasoning,
        status: c.assign && matchDoctor ? "IN_REVIEW" : "NEW",
        doctorId: c.assign && matchDoctor ? matchDoctor.id : null,
      },
    });
    byName[c.patientName] = created.id;
  }

  // Demo post-op takibi: Ahmed (Ortopedi) — biri kırmızı bayrak; Olga (Saç Ekimi) — normal
  console.log("Demo post-op takibi ekleniyor...");
  const ahmed = await db.recovery.create({ data: { caseId: byName["Ahmed M."], branch: "Ortopedi", startedAt: new Date(Date.now() - 4 * 86400000) } });
  const ahmedCheckins = [
    { pain: 3, feverC: 36.7, meds: true, note: "Dizde hafif ağrı, genel durum iyi.", days: 3 },
    { pain: 8, feverC: 38.8, meds: true, note: "Dikiş bölgesinde kızarıklık ve akıntı var, ağrı arttı.", days: 1 },
  ];
  for (const ci of ahmedCheckins) {
    const a = assessCheckIn(ci);
    await db.checkIn.create({ data: { recoveryId: ahmed.id, pain: ci.pain, feverC: ci.feverC, meds: ci.meds, note: ci.note, severity: a.severity, createdAt: new Date(Date.now() - ci.days * 86400000) } });
  }

  const olga = await db.recovery.create({ data: { caseId: byName["Olga P."], branch: "Saç Ekimi", startedAt: new Date(Date.now() - 9 * 86400000) } });
  const olgaCi = { pain: 1, feverC: 36.5, meds: true, note: "Yıkama yapıldı, kabuklanma normal." };
  await db.checkIn.create({ data: { recoveryId: olga.id, ...olgaCi, severity: assessCheckIn(olgaCi).severity, createdAt: new Date(Date.now() - 2 * 86400000) } });

  // M5: demo hakediş için sonlanmış görüşmeler (doctors[0] = demo doktor)
  for (const nm of ["Karim B.", "Aigerim T.", "Olga P."]) {
    if (byName[nm]) {
      await db.consultation.create({ data: { caseId: byName[nm], doctorId: doctors[0].id, status: "ENDED", endedAt: new Date(), notes: "Görüşme tamamlandı." } });
    }
  }

  // Demo: bir rezervasyon + ona bağlı bekleyen şikayet (Escrow iade senaryosu)
  console.log("Demo şikayet ekleniyor...");
  const karimId = byName["Karim B."];
  const kCase = await db.case.findUnique({ where: { id: karimId } });
  if (kCase) {
    const sel = { branch: kCase.branch, country: kCase.country, tier: "Standart" as const, hotelStars: 4 as const, hospitalType: "Özel" as const, nights: 6, translator: false, insuranceExtended: true, insuranceMalpractice: true };
    const q = computePackage(sel);
    const kBooking = await db.booking.create({
      data: {
        caseId: karimId, branch: sel.branch, country: sel.country, tier: sel.tier, hotelStars: sel.hotelStars,
        hospitalType: sel.hospitalType, nights: sel.nights, translator: sel.translator,
        insuranceExtended: sel.insuranceExtended, insuranceMalpractice: sel.insuranceMalpractice,
        subtotal: q.subtotal, platformFee: q.platformFee, total: q.total, currency: q.currency,
        breakdown: JSON.stringify(q.items), split: JSON.stringify(q.split),
      },
    });
    await db.case.update({ where: { id: karimId }, data: { status: "DONE" } });
    await db.complaint.create({
      data: {
        caseId: karimId, bookingId: kBooking.id,
        subject: "Operasyon ertelendi, ek konaklama ücreti talep edildi",
        description: "Planlanan tarihte operasyon gerçekleşmedi ve bizden ekstra konaklama ücreti istendi. Yaşadığımız mağduriyet için kısmi iade talep ediyoruz.",
        requestType: "REFUND", evidence: "yazismalar.pdf",
      },
    });
  }

  const dc = await db.doctor.count();
  const cc = await db.case.count();
  const rc = await db.recovery.count();
  const pc = await db.complaint.count();
  const uc = await db.user.count();
  console.log(`Tamamlandı ✓  ${uc} kullanıcı, ${dc} doktor, ${cc} vaka, ${rc} takip, ${pc} şikayet.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
