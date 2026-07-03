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
  // ── Tüm klinik branşları kapsamak için eklenen hekimler ──
  { name: "Zeynep Aydın", title: "Dt.", branch: "Diş Tedavisi", city: "İstanbul", languages: "Türkçe,İngilizce,Arapça", color: "#0891b2", bio: "İmplant, gülüş tasarımı ve dijital diş hekimliği." },
  { name: "Murat Şen", title: "Op. Dr.", branch: "Göz Cerrahisi", city: "Ankara", languages: "Türkçe,İngilizce", color: "#2563eb", bio: "LASIK/SMILE, katarakt ve akıllı lens cerrahisi." },
  { name: "Okan Demirtaş", title: "Doç. Dr.", branch: "Genel Cerrahi", city: "İzmir", languages: "Türkçe,İngilizce", color: "#15803d", bio: "Fıtık, safra kesesi ve obezite cerrahisi (laparoskopik)." },
  { name: "Pelin Acar", title: "Prof. Dr.", branch: "Nöroloji", city: "İstanbul", languages: "Türkçe,Rusça", color: "#6d28d9", bio: "Baş ağrısı, MS, epilepsi ve inme sonrası takip." },
  { name: "Serkan Koç", title: "Prof. Dr.", branch: "Gastroenteroloji", city: "Ankara", languages: "Türkçe,İngilizce", color: "#a16207", bio: "Endoskopi, kolonoskopi ve karaciğer hastalıkları." },
  { name: "Gül Yılmaz", title: "Doç. Dr.", branch: "Endokrinoloji ve Metabolizma", city: "İstanbul", languages: "Türkçe,Arapça", color: "#0d9488", bio: "Tiroid, diyabet ve hormonal bozukluklar." },
  { name: "Emre Kılıç", title: "Prof. Dr.", branch: "Nefroloji", city: "İstanbul", languages: "Türkçe,İngilizce", color: "#1e40af", bio: "Böbrek hastalıkları, diyaliz ve nakil öncesi değerlendirme." },
  { name: "Aslı Çetin", title: "Uzm. Dr.", branch: "Göğüs Hastalıkları", city: "İzmir", languages: "Türkçe,İngilizce", color: "#0369a1", bio: "Astım, KOAH ve uyku apnesi." },
  { name: "Tolga Eren", title: "Prof. Dr.", branch: "Hematoloji", city: "Ankara", languages: "Türkçe,Rusça", color: "#b91c1c", bio: "Anemi, lösemi, lenfoma ve kemik iliği nakli." },
  { name: "Nazlı Öztürk", title: "Doç. Dr.", branch: "Romatoloji", city: "İstanbul", languages: "Türkçe,İngilizce", color: "#c2410c", bio: "Romatoid artrit, lupus ve ailevi Akdeniz ateşi." },
  { name: "Barış Aslan", title: "Uzm. Dr.", branch: "Enfeksiyon Hastalıkları", city: "İstanbul", languages: "Türkçe,İngilizce,Arapça", color: "#166534", bio: "Hepatit, HIV ve kronik enfeksiyon yönetimi." },
  { name: "Ece Korkmaz", title: "Uzm. Dr.", branch: "Dermatoloji (Cilt Hastalıkları)", city: "İstanbul", languages: "Türkçe,Rusça", color: "#db2777", bio: "Cilt hastalıkları, akne ve estetik dermatoloji." },
  { name: "Sinan Avcı", title: "Doç. Dr.", branch: "Psikiyatri", city: "Ankara", languages: "Türkçe,İngilizce", color: "#7c3aed", bio: "Depresyon, anksiyete bozuklukları ve psikoterapi." },
  { name: "Derya Şimşek", title: "Uzm. Dr.", branch: "Fiziksel Tıp ve Rehabilitasyon", city: "İzmir", languages: "Türkçe,İngilizce", color: "#ca8a04", bio: "Bel-boyun ağrısı, spor yaralanması ve nörolojik rehabilitasyon." },
  { name: "Canan Ünal", title: "Uzm. Dr.", branch: "Çocuk Sağlığı ve Hastalıkları", city: "İstanbul", languages: "Türkçe,Arapça", color: "#e11d48", bio: "Genel pediatri, büyüme-gelişme ve çocuk enfeksiyonları." },
  { name: "Volkan Taş", title: "Prof. Dr.", branch: "Üroloji", city: "İstanbul", languages: "Türkçe,İngilizce", color: "#0e7490", bio: "Prostat, böbrek taşı ve androloji." },
  { name: "Sema Polat", title: "Op. Dr.", branch: "Kulak Burun Boğaz (KBB)", city: "Ankara", languages: "Türkçe,Rusça", color: "#4f46e5", bio: "Sinüs cerrahisi, işitme ve burun estetiği." },
  { name: "Leyla Doğan", title: "Prof. Dr.", branch: "Kadın Hastalıkları ve Doğum", city: "İstanbul", languages: "Türkçe,Arapça,İngilizce", color: "#be185d", bio: "Jinekoloji, yüksek riskli gebelik ve laparoskopik cerrahi." },
  { name: "Kerem Bulut", title: "Prof. Dr.", branch: "Kalp ve Damar Cerrahisi", city: "Ankara", languages: "Türkçe,İngilizce", color: "#991b1b", bio: "Koroner bypass, kalp kapağı ve aort cerrahisi." },
  { name: "Onur Yavuz", title: "Doç. Dr.", branch: "Göğüs Cerrahisi", city: "İstanbul", languages: "Türkçe,İngilizce", color: "#1d4ed8", bio: "Akciğer kanseri ve minimal invaziv toraks cerrahisi." },
  { name: "Levent Karaca", title: "Prof. Dr.", branch: "Organ Nakli", city: "İstanbul", languages: "Türkçe,İngilizce,Arapça", color: "#047857", bio: "Böbrek ve karaciğer nakli, canlı verici programı." },
  { name: "Filiz Aydın", title: "Doç. Dr.", branch: "Radyasyon Onkolojisi", city: "Ankara", languages: "Türkçe,Rusça", color: "#7e22ce", bio: "Modern radyoterapi (IMRT/SBRT) ve onkolojik tedavi." },
];

const CASES = [
  { patientName: "Karim B.", country: "DZ", language: "Arapça", symptoms: "Babamda akciğer kanseri şüphesi var. Biyopsi sonucu çıktı, ikinci görüş ve tedavi planı istiyoruz.", durationText: "2 ay", attachments: "akciger-BT.pdf,biyopsi-raporu.pdf", assign: false },
  { patientName: "Olga P.", country: "RU", language: "Rusça", symptoms: "Saç dökülmesi son aylarda çok arttı, ön bölge açıldı. FUE saç ekimi düşünüyorum.", durationText: "1 yıl", attachments: "sac-fotograf.jpg", assign: false },
  { patientName: "Aigerim T.", country: "KZ", language: "Kazakça", symptoms: "3 yıldır çocuğumuz olmuyor, tüp bebek (IVF) tedavisi araştırıyoruz. Hormon tahlillerimiz mevcut.", durationText: "3 yıl", attachments: "hormon-paneli.pdf", assign: true },
  { patientName: "Ahmed M.", country: "LY", language: "Arapça", symptoms: "Dizimde menisküs yırtığı var, MR çektirdim. Protez gerekebilir dediler, ortopedi görüşü istiyorum.", durationText: "6 ay", attachments: "diz-MR.pdf", assign: false },
  { patientName: "Dmitry K.", country: "RU", language: "Rusça", symptoms: "Şiddetli göğüs ağrısı, nefes darlığı ve çarpıntı şikayetim var. Tansiyonum yüksek.", durationText: "3 gün", attachments: "", assign: false },

  // ── Branş/ülke çeşitliliği için ek demo vakalar (kuyruk + hekim dizini + operasyon paneli zenginleşir) ──
  { patientName: "James W.", country: "GB", language: "İngilizce", symptoms: "Her iki gözümde yüksek miyop var, kalın gözlük kullanıyorum. Lasik lazer tedavisi ile görme kusurumdan kurtulmak istiyorum.", durationText: "2 yıl", attachments: "goz-muayene.pdf", assign: true },
  { patientName: "Hans M.", country: "DE", language: "Almanca", symptoms: "Üst çenemde birkaç eksik diş var. İmplant ve gülüş tasarımı (gülüş estetiği) için tedavi planı ve fiyat teklifi istiyorum.", durationText: "8 ay", attachments: "panoramik-rontgen.jpg", assign: false },
  { patientName: "Natalia V.", country: "RU", language: "Rusça", symptoms: "Burun şeklimden ve burun kemerimden memnun değilim. Rinoplasti (burun estetiği) ameliyatı düşünüyorum.", durationText: "1 yıl", attachments: "profil-foto.jpg", assign: false },
  { patientName: "Klaus B.", country: "DE", language: "Almanca", symptoms: "Babamda prostat büyümesi var, geceleri sık idrara çıkıyor ve işeme zorluğu yaşıyor. Üroloji değerlendirmesi ve PSA takibi istiyoruz.", durationText: "5 ay", attachments: "psa-sonuc.pdf", assign: true },
  { patientName: "Aibek S.", country: "KG", language: "Kırgızca", symptoms: "Kronik sinüzit ve burun tıkanıklığı şikayetim var, sürekli geniz akıntısı ve horlama oluyor. KBB cerrahisi gerekebilir mi?", durationText: "2 yıl", attachments: "", assign: false },
  { patientName: "Günel A.", country: "AZ", language: "Azerice", symptoms: "Rahimde miyom tespit edildi, adet düzensizliği ve kasık ağrısı yaşıyorum. Kadın doğum (jinekoloji) görüşü ve tedavi seçenekleri istiyorum.", durationText: "7 ay", attachments: "ultrason.pdf", assign: true },
  { patientName: "Nurlan T.", country: "KZ", language: "Kazakça", symptoms: "Kronik böbrek hastalığı son evrede, böbrek nakli için canlı verici (donör) değerlendirmesi istiyoruz. Uzun süredir nakil bekleme listesindeyiz.", durationText: "1 yıl", attachments: "nefroloji-raporu.pdf", assign: false },
  { patientName: "Mehmet K.", country: "TR", language: "Türkçe", symptoms: "Bel fıtığı nedeniyle bacağıma yayılan ağrı ve uyuşma var. Omurga cerrahisi / disk ameliyatı gerekli mi diye nöroşirürji görüşü istiyorum.", durationText: "4 ay", attachments: "bel-MR.pdf", assign: false },
  { patientName: "Stefan R.", country: "DE", language: "Almanca", symptoms: "Uzun süredir KOAH hastasıyım; öksürük, balgam ve hırıltı artıyor. Astım tedavimin gözden geçirilmesini istiyorum.", durationText: "3 yıl", attachments: "", assign: false },
  { patientName: "Pierre L.", country: "FR", language: "Fransızca", symptoms: "Sürekli reflü ve mide yanması var, gastrit şüphesiyle endoskopi planlanıyor. Gastroenteroloji ikinci görüşü istiyorum.", durationText: "6 ay", attachments: "endoskopi-rapor.pdf", assign: true },
  { patientName: "Irina M.", country: "RU", language: "Rusça", symptoms: "Cilt yüzeyimde renk değiştiren şüpheli bir ben var; ben kontrolü ve cilt muayenesi istiyorum. Yüzümde akne ve leke de var.", durationText: "3 ay", attachments: "ben-foto.jpg", assign: false },
  { patientName: "Aliya N.", country: "KZ", language: "Kazakça", symptoms: "Tiroid bezimde guatr var ve hormon değerlerim düzensiz. Halsizlik ve kilo değişimi yaşıyorum, endokrinoloji takibi istiyorum.", durationText: "1 yıl", attachments: "tiroid-usg.pdf", assign: false },
  { patientName: "Sergey D.", country: "RU", language: "Rusça", symptoms: "Sürekli halsizlik ve kansızlık (anemi) var, hemoglobin düşük çıkıyor. Boyunda şişlik nedeniyle lenfoma açısından hematoloji değerlendirmesi istiyoruz.", durationText: "5 ay", attachments: "kan-tahlili.pdf", assign: true },
  { patientName: "Emma T.", country: "GB", language: "İngilizce", symptoms: "Aylardır depresyon ve yoğun anksiyete yaşıyorum, uykusuzluk ve sürekli stres var. Psikiyatri desteği ve psikoterapi istiyorum.", durationText: "8 ay", attachments: "", assign: false },
  { patientName: "Elnur M.", country: "AZ", language: "Azerice", symptoms: "Kalp kapağı yetmezliğim var, kapak ameliyatı ve bypass önerildi. Açık kalp cerrahisi / kalp ameliyatı için kalp ve damar cerrahisi ikinci görüşü istiyorum.", durationText: "2 ay", attachments: "anjiyo-rapor.pdf", assign: false },
];

async function main() {
  // ⚠️ Yıkıcı-seed güvenlik kapısı (T8 — ortam izolasyonu).
  // Bu betik çekirdek tabloları deleteMany ile TAM RESET eder. Yerel .env üretim Neon DB'sine
  // bağlı olabileceğinden (bkz. .env.example: "YEREL + ÜRETİM AYNI Neon DB"), kazara çalıştırma
  // canlı veriyi geri dönüşsüz yok eder. Çalıştırmak için açık onay zorunlu: ALLOW_DESTRUCTIVE_SEED=1
  const targetHost = (() => {
    try { return new URL(process.env.DATABASE_URL ?? "").host; } catch { return "(bilinmiyor)"; }
  })();
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
    console.error(
      `\n⛔ Yıkıcı seed engellendi (hedef DB: ${targetHost}).\n` +
      "Bu betik tüm kullanıcı/doktor/vaka verisini SİLER (tam reset).\n" +
      "Üretim ve yerel şu an aynı Neon DB olabilir → kazara veri kaybı riski.\n" +
      "Yalnız İZOLE bir dev/dev-branch DB'de çalıştır:  ALLOW_DESTRUCTIVE_SEED=1 npm run db:seed\n" +
      "Demo verisi eklemek için yıkıcı-olmayan scriptleri tercih et (add-demo-cases.ts / enrich-profiles.ts).\n"
    );
    process.exit(1);
  }
  console.log(`⚠️  Yıkıcı seed ONAYLANDI — hedef DB sıfırlanacak: ${targetHost}`);

  console.log("Temizleniyor...");
  await db.complaint.deleteMany();
  await db.checkIn.deleteMany();
  await db.recovery.deleteMany();
  await db.booking.deleteMany();
  await db.consultation.deleteMany();
  await db.shareAccess.deleteMany();
  await db.shareLink.deleteMany();
  await db.caseDocument.deleteMany();
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
        // Şema default'ları değişti (verified=false, jci=null) → demo vitrini için AÇIKÇA yazılır:
        verified: true, // demo doktorlar admin-onaylı sayılır (ücretsiz sağlık hizmeti/erişim kapıları açık)
        jci: true, // demo akreditasyon rozeti korunur (gerçek doktorda yalnız belge ile true)
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
  const patientUser = await db.user.findUnique({ where: { email: "hasta@air.test" } });
  const byName: Record<string, string> = {};
  for (const c of CASES) {
    const a = analyzeTriage({ symptoms: c.symptoms, durationText: c.durationText });
    const matchDoctor = doctors.find((doc) => doc.branch === a.branch);
    const created = await db.case.create({
      data: {
        userId: patientUser?.id ?? null, // demo vakalar demo hastaya ait (hasta↔vaka sahipliği)
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

  // ── Golden demo vakası (Karim B. · akciğer kanseri ikinci görüş) ───────────────────────────
  // TRUST omurgası (triyaj → AI belge → görüşme → güvenli paylaşım → FHIR/kanıt) canlı LLM çağrısı
  // OLMADAN demolanabilsin diye AI çıktıları (epikriz + belge değerlendirmesi) ÖNCEDEN doldurulur.
  // Canlı demoda soğuk/yavaş AI çağrısı riski sıfır. (Karim'in ENDED görüşmesi + booking'i zaten var.)
  console.log("Golden demo vakası (AI çıktıları önceden) ekleniyor...");
  const goldenId = byName["Karim B."];
  if (goldenId) {
    const dStruct = {
      tani: "Sağ akciğer üst lob primer akciğer karsinomu (non-küçük hücreli, adenokarsinom), evre IIIA — transbronşiyal biyopsi ile doğrulandı.",
      anamnez: "57 yaşında erkek; 2 aydır öksürük, hemoptizi (balgamda kan) ve kilo kaybı. Cezayir'de çekilen toraks BT'de sağ üst lobda 4 cm kitle; biyopsi adenokarsinom ile uyumlu. İkinci görüş ve tedavi planı için başvurdu.",
      tedaviSureci: "Multidisipliner onkoloji konseyi (göğüs cerrahisi + tıbbi onkoloji + radyasyon onkolojisi) değerlendirdi. PET-BT ve mediastinoskopi ile evreleme tamamlandı; neoadjuvan kemoterapi ardından cerrahi rezeksiyon planı onaylandı.",
      klinikSeyir: "Hasta planı kabul etti; ECOG performans skoru 1, genel durum stabil, ek hastalık yok.",
      cikisIlaclari: "Kemoterapi günlerinde antiemetik profilaksi; bulantı için gerektiğinde destek. Kesin doz onkoloji protokolüne göre belirlenir.",
      oneriler: "1. kemoterapi siklusu sonrası kontrol. Ateş, nefes darlığı veya kontrolsüz kanamada acil başvuru. Epikriz + görüntüler yurt dışı takip hekimine güvenli paylaşımla iletildi.",
    };
    const SECT: [string, string][] = [
      ["TANI", dStruct.tani], ["ÖYKÜ VE BAŞVURU", dStruct.anamnez],
      ["UYGULANAN TEDAVİ VE İŞLEMLER", dStruct.tedaviSureci], ["KLİNİK SEYİR VE İYİLEŞME", dStruct.klinikSeyir],
      ["ÇIKIŞ İLAÇLARI", dStruct.cikisIlaclari], ["ÖNERİLER VE KONTROL PLANI", dStruct.oneriler],
    ];
    await db.case.update({
      where: { id: goldenId },
      data: {
        icd10Code: "C34.1", // FHIR Condition kodlu döner (malign neoplazm, akciğer üst lobu)
        dischargeStructured: JSON.stringify(dStruct),
        dischargeReport: SECT.map(([t, b]) => `${t}\n${b}`).join("\n\n"),
        dischargeAt: new Date(),
      },
    });

    // AI ile önceden değerlendirilmiş tıbbi belge — doktor kokpitinde "AI ile değerlendir" çıktısı hazır (beat 2).
    await db.caseDocument.create({
      data: {
        caseId: goldenId,
        label: "biyopsi-raporu.pdf",
        mimeType: "application/pdf",
        content: null, // demo: ham içerik gerekmez; AI alanları önceden dolu
        aiDocType: "Epikriz / Tıbbi Rapor",
        aiSummary: "Transbronşiyal akciğer biyopsisi non-küçük hücreli akciğer karsinomu (adenokarsinom) ile uyumlu. Hastanın öksürük + hemoptizi şikâyetiyle doğrudan ilişkili; ileri evreleme ve onkolojik tedavi planı gerektirir.",
        aiTranslation: "Belge Fransızca düzenlenmişti. Türkçe çeviri: 'Histopatolojik inceleme — sağ üst lob: bezsel diferansiyasyon gösteren atipik epitel hücreleri; TTF-1 pozitif. Sonuç: akciğer adenokarsinomu ile uyumlu.'",
        aiFlags: "Kritik: malignite saptandı — ivedi onkoloji yönlendirmesi gerekli.",
        assessedAt: new Date(),
      },
    });

    // Hasta kontrollü güvenli paylaşım (yurt dışı takip hekimi) + bir erişim kaydı → denetim izi dolu görünür (beat 4).
    const goldenShare = await db.shareLink.create({
      data: {
        token: "demo-aura-karim",
        caseId: goldenId,
        recipientName: "Dr. Lefèvre · CHU Alger",
        scopes: "EPIKRIZ,RADYOLOJI,LAB",
        expiresAt: new Date(Date.now() + 14 * 86400000),
        allowDownload: false,
      },
    });
    await db.shareAccess.create({
      data: {
        shareLinkId: goldenShare.id,
        action: "VIEW",
        ip: "41.103.0.0",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/17.4",
        createdAt: new Date(Date.now() - 2 * 3600000),
      },
    });
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

  // Natalia (Estetik · rinoplasti) — normal seyreden post-op takibi
  if (byName["Natalia V."]) {
    const natalia = await db.recovery.create({ data: { caseId: byName["Natalia V."], branch: "Estetik Cerrahi", startedAt: new Date(Date.now() - 6 * 86400000) } });
    const nataliaCheckins = [
      { pain: 4, feverC: 37.0, meds: true, note: "Burun bölgesinde şişlik ve hafif morluk var, beklenen düzeyde.", days: 5 },
      { pain: 2, feverC: 36.6, meds: true, note: "Şişlik azaldı, atel çıkarıldı, genel durum iyi.", days: 2 },
    ];
    for (const ci of nataliaCheckins) {
      const a = assessCheckIn(ci);
      await db.checkIn.create({ data: { recoveryId: natalia.id, pain: ci.pain, feverC: ci.feverC, meds: ci.meds, note: ci.note, severity: a.severity, createdAt: new Date(Date.now() - ci.days * 86400000) } });
    }
  }

  // M5: demo hakediş için sonlanmış görüşmeler (doctors[0] = demo doktor)
  for (const nm of ["Karim B.", "Aigerim T.", "Olga P."]) {
    if (byName[nm]) {
      await db.consultation.create({ data: { caseId: byName[nm], doctorId: doctors[0].id, status: "ENDED", endedAt: new Date(), notes: "Görüşme tamamlandı." } });
    }
  }

  // Demo: tamamlanmış "mutlu yol" rezervasyonu (Escrow RELEASED) — IVF vakası → operasyon panelinde gelir/Escrow çeşitliliği
  const aigerimId = byName["Aigerim T."];
  const aCase = aigerimId ? await db.case.findUnique({ where: { id: aigerimId } }) : null;
  if (aCase) {
    const sel = { branch: aCase.branch, country: aCase.country, tier: "Premium" as const, hotelStars: 5 as const, hospitalType: "Özel" as const, nights: 8, translator: true, insuranceExtended: true, insuranceMalpractice: false };
    const q = computePackage(sel);
    await db.booking.create({
      data: {
        caseId: aigerimId, branch: sel.branch, country: sel.country, tier: sel.tier, hotelStars: sel.hotelStars,
        hospitalType: sel.hospitalType, nights: sel.nights, translator: sel.translator,
        insuranceExtended: sel.insuranceExtended, insuranceMalpractice: sel.insuranceMalpractice,
        subtotal: q.subtotal, platformFee: q.platformFee, total: q.total, currency: q.currency,
        breakdown: JSON.stringify(q.items), split: JSON.stringify(q.split),
        status: "CONFIRMED", escrowStatus: "RELEASED",
      },
    });
    await db.case.update({ where: { id: aigerimId }, data: { status: "DONE" } });
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
