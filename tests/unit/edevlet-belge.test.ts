// e-Devlet barkodlu belge doğrulaması + v6.119 aktivasyon kapısı — saf mantık sözleşmeleri.
//
// ⚠️ Buradaki PDF metinleri SENTETİKTİR (gerçek e-Devlet belgesi görülmeden yazıldı). Testler
// ayrıştırıcının SÖZLEŞMESİNİ kilitler (fail-closed davranış, TC sağlaması, ad eşleşmesi), gerçek
// belge biçimini DOĞRULAMAZ. Biçim kalibrasyonu ayrı ve yereldir:
//   npx tsx scripts/edevlet-parse-dene.ts <belge.pdf>
// Kalibrasyon yapılmadan "otomatik doğrulama çalışıyor" DENMEZ — desen tutmazsa sonuç PENDING olur,
// yani kalibrasyonsuz hâl GÜVENLİDİR (kapı açılmaz), yalnız otomatik geçiş oranı düşer.
import { describe, it, expect } from "vitest";
import {
  parseEdevletBelge, degerlendir, isValidTckn, normalizeTrName, nameMatches, onayKarari,
} from "@/lib/edevlet-belge";
import {
  canActivate, hasRequiredDocs, hasAcceptedRequiredDocs, activationState, canCompleteOnboarding,
} from "@/lib/doctor-activation";

// Sentetik ama algoritmik GEÇERLİ TC (gerçek kişiye ait değil): 1-0×8-7-8
const GECERLI_TC = "10000000078";

const BELGE = `
T.C. YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
Yükseköğretim Mezun Belgesi

Adı Soyadı : AYŞE NUR YILMAZ
T.C. Kimlik No : ${GECERLI_TC}
Program : TIP FAKÜLTESİ
Mezuniyet Durumu : MEZUN

Barkod No : A1B2-C3D4-E5F6
Bu belge https://www.turkiye.gov.tr/belge-dogrulama adresinden doğrulanabilir.
`;

describe("TC kimlik no sağlaması — 11 haneli her sayı TC değildir", () => {
  it("algoritmik geçerli TC'yi kabul eder", () => {
    expect(isValidTckn(GECERLI_TC)).toBe(true);
    expect(isValidTckn("11111111110")).toBe(true);
  });
  it("sağlaması tutmayan / biçimsiz değerleri reddeder", () => {
    expect(isValidTckn("12345678901")).toBe(false); // sağlama hanesi yanlış
    expect(isValidTckn("01234567890")).toBe(false); // ilk hane 0
    expect(isValidTckn("1234567890")).toBe(false); // 10 hane
    expect(isValidTckn("123456789012")).toBe(false); // 12 hane
    expect(isValidTckn("abcdefghijk")).toBe(false);
  });
  it("belge/tescil numarası gibi 11 haneli sayılar TC sanılmaz", () => {
    // Sağlama sayesinde rastgele 11 hane elenir — yanlış eşleştirmenin ana kaynağı buydu.
    const belge = parseEdevletBelge("Belge No : 20260819123\nBarkod No : A1B2-C3D4-E5F6");
    expect(belge.tckn).toBeNull();
  });
});

describe("Türkçe ad normalizasyonu — İ/ı tuzağı", () => {
  it("İ ve I aynı ASCII harfe katlanır", () => {
    // Saf toLowerCase "İ" için i + birleşen nokta üretir → naif karşılaştırma sessizce patlar.
    expect(normalizeTrName("İSMAİL ÇAĞLAR")).toBe("ismail caglar");
    expect(normalizeTrName("Işıl Öztürk")).toBe("isil ozturk");
  });
  it("unvanları atar", () => {
    expect(normalizeTrName("Prof. Dr. Ayşe Yılmaz")).toBe("ayse yilmaz");
    expect(normalizeTrName("Op. Dr. Mehmet Şen")).toBe("mehmet sen");
  });
});

describe("Ad eşleştirme", () => {
  it("unvan ve sıra farkını tolere eder", () => {
    expect(nameMatches("AYŞE NUR YILMAZ", "Dr. Ayşe Nur Yılmaz")).toBe(true);
    expect(nameMatches("YILMAZ AYŞE NUR", "Ayşe Nur Yılmaz")).toBe(true);
  });
  it("göbek adı yalnız bir tarafta olsa da eşleşir", () => {
    expect(nameMatches("AYŞE NUR YILMAZ", "Ayşe Yılmaz")).toBe(true);
  });
  it("farklı kişiyi eşleştirmez", () => {
    expect(nameMatches("AYŞE NUR YILMAZ", "Fatma Yılmaz")).toBe(false);
    expect(nameMatches("AYŞE YILMAZ", "Ayşe Demir")).toBe(false);
  });
  it("tek sözcük yetmez (fail-closed)", () => {
    expect(nameMatches("YILMAZ", "Ayşe Yılmaz")).toBe(false);
    expect(nameMatches("AYŞE YILMAZ", "Yılmaz")).toBe(false);
  });
  it("boş/eksik girdi eşleşme SAYILMAZ", () => {
    expect(nameMatches(null, "Ayşe Yılmaz")).toBe(false);
    expect(nameMatches("AYŞE YILMAZ", null)).toBe(false);
  });
});

// ── GERÇEK BELGE YAPISI (2026-08-19 kalibrasyonu) ──────────────────────────────────────────────
// Aşağıdaki metin, gerçek bir YÖK Mezun Belgesi'nin metin katmanının BİREBİR YAPISIDIR; yalnız
// kişisel değerler sentetikle değiştirilmiştir (gerçek ad/TC/barkod repoya GİRMEZ).
// Kilitlenen üç tuzak — üçü de ilk yazdığım desenleri kırmıştı:
//   1. Barkod ETİKETSİZ, TİRESİZ ve belgenin EN ÜST satırında ("YOKME…" ön eki, 18 karakter)
//   2. "Adı Soyadı" ile değer arasında İKİ NOKTA YOK (':' karakterleri ayrı sütuna toplanıyor)
//   3. TC değeri etiketine YAPIŞIK ("10000000078T.C. Kimlik No") → `\b\d{11}\b` ıskalar
//   4. "Anne Adı" / "Baba Adı" satırları var → çıplak "Adı" deseni anne adını yakalardı
const GERCEK_YAPI = `YOKME1A2B3C4D5E6F7
ANKARA
T.C.
YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
19.08.2026
MEZUN BELGESİ
Adı Soyadı AYŞE NUR YILMAZ
Anne Adı MÜBECCEL
ÜMİTBaba Adı
Doğum Tarihi 05.10.1980
İLGİLİ MAKAMA
${GECERLI_TC}T.C. Kimlik No :
:
:
Program HACETTEPE ÜNİVERSİTESİ/TIP FAKÜLTESİ/TIP:
Hacettepe Üniversitesi tarafından kimlik ve mezun bilgileri bildirilen Ayşe Nur Yılmaz yukarıda belirtilen programdan
mezun olmuştur.
Diploma No 1910:
Mezuniyet Tarihi 19.09.2002:
Durum MEZUNİYET:
Bu belgenin doğruluğunu barkod numarası ile https://www.turkiye.gov.tr/belge-dogrulama adresinden,
mobil cihazlarınıza yükleyeceğiniz e-Devlet Kapısına ait Barkodlu Belge Doğrulama veya YÖK Mobil
uygulaması vasıtası ile yandaki karekod okutularak kontrol edilebilir.`;

describe("📐 Gerçek YÖK Mezun Belgesi yapısı (canlı kalibrasyon regresyonu)", () => {
  it("etiketsiz/tiresiz üst-satır barkodunu okur", () => {
    expect(parseEdevletBelge(GERCEK_YAPI).barcode).toBe("YOKME1A2B3C4D5E6F7");
  });
  it("iki nokta OLMADAN yazılmış 'Adı Soyadı' değerini okur", () => {
    expect(parseEdevletBelge(GERCEK_YAPI).name).toBe("AYŞE NUR YILMAZ");
  });
  it("🪤 anne/baba adını doktorun adı sanmaz", () => {
    const n = parseEdevletBelge(GERCEK_YAPI).name;
    expect(n).not.toMatch(/MÜBECCEL|ÜMİT/);
  });
  it("🪤 etikete YAPIŞIK TC'yi okur (\\b sözcük sınırı burada çalışmaz)", () => {
    expect(parseEdevletBelge(GERCEK_YAPI).tckn).toBe(GECERLI_TC);
  });
  it("türü MEZUNIYET, programı tıp olarak tanır", () => {
    const b = parseEdevletBelge(GERCEK_YAPI);
    expect(b.tur).toBe("MEZUNIYET");
    expect(b.tipProgrami).toBe(true);
  });
  it("uçtan uca OTOMATİK GEÇER", () => {
    expect(degerlendir(parseEdevletBelge(GERCEK_YAPI), "Ayşe Nur Yılmaz").ok).toBe(true);
  });
  it("🎯 aynı yapıdaki HUKUK mezuniyeti GEÇMEZ (canlı belgeyle doğrulandı)", () => {
    // Gerçek kalibrasyon belgesi hukuk fakültesi mezuniyetiydi ve sistem doğru sebeple reddetti.
    const hukuk = GERCEK_YAPI.replace("HACETTEPE ÜNİVERSİTESİ/TIP FAKÜLTESİ/TIP", "İSTANBUL BİLGİ ÜNİVERSİTESİ/HUKUK FAKÜLTESİ/HUKUK");
    const s = degerlendir(parseEdevletBelge(hukuk), "Ayşe Nur Yılmaz");
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/program/i);
  });
});

describe("Belge ayrıştırma", () => {
  it("barkod, ad ve TC'yi çıkarır; e-Devlet işaretini görür", () => {
    const b = parseEdevletBelge(BELGE);
    expect(b.barcode).toBe("A1B2-C3D4-E5F6");
    expect(b.name).toBe("AYŞE NUR YILMAZ");
    expect(b.tckn).toBe(GECERLI_TC);
    expect(b.isEdevlet).toBe(true);
  });
  it("etiketsiz doğrulama cümlesinden de barkod okur", () => {
    const b = parseEdevletBelge(
      "Bu belgeyi belge-dogrulama adresinden ZZ99-YY88-XX77 kodu ile doğrulayabilirsiniz.",
    );
    expect(b.barcode).toBe("ZZ99-YY88-XX77");
  });
  it("e-Devlet olmayan metinde işaret bulmaz", () => {
    expect(parseEdevletBelge("Sıradan bir PDF metni.").isEdevlet).toBe(false);
  });
});

describe("🔴 Belge TÜRÜ kapısı — 'barkodlu e-Devlet belgesi' olmak YETMEZ", () => {
  // 2026-08-19'da yakalanan açık: tür bakılmadığında kişinin KENDİ adına, e-Devlet'ten,
  // barkodlu çıkan HERHANGİ bir belgesi diploma sanılıyor ve klinik erişimi otomatik açıyordu.
  const IKAMETGAH = `
T.C. İÇİŞLERİ BAKANLIĞI
Yerleşim Yeri ve Diğer Adres Belgesi

Adı Soyadı : AYŞE NUR YILMAZ
T.C. Kimlik No : ${GECERLI_TC}

Barkod No : A1B2-C3D4-E5F6
Bu belge https://www.turkiye.gov.tr/belge-dogrulama adresinden doğrulanabilir.
`;
  const ADLI_SICIL = `
T.C. ADALET BAKANLIĞI — Adli Sicil Kaydı
Adı Soyadı : AYŞE NUR YILMAZ
Barkod No : Q1W2-E3R4-T5Y6
turkiye.gov.tr/belge-dogrulama
`;

  it("ikametgah belgesi diploma yerine GEÇEMEZ (kendi adına + barkodlu + e-Devlet olsa bile)", () => {
    const b = parseEdevletBelge(IKAMETGAH);
    expect(b.isEdevlet).toBe(true); // e-Devlet ✓
    expect(b.barcode).toBe("A1B2-C3D4-E5F6"); // barkod ✓
    expect(b.name).toBe("AYŞE NUR YILMAZ"); // ad ✓ (profille eşleşir!)
    expect(b.tur).toBeNull(); // ...ama TÜR tanınmaz → kapı kapalı
    const s = degerlendir(b, "Ayşe Nur Yılmaz");
    expect(s.ok).toBe(false);
    expect(s.tanindi).toBe(false);
    expect(s.reason).toMatch(/t[üu]r/i);
  });

  it("adli sicil kaydı da GEÇEMEZ", () => {
    expect(degerlendir(parseEdevletBelge(ADLI_SICIL), "Ayşe Nur Yılmaz").ok).toBe(false);
  });

  it("öğrenci belgesi DIPLOMA yerine geçemez (tür karışması)", () => {
    const ogrenci = `
T.C. YÜKSEKÖĞRETİM KURULU BAŞKANLIĞI
Öğrenci Belgesi
Adı Soyadı : AYŞE NUR YILMAZ
Program : TIP FAKÜLTESİ
Barkod No : A1B2-C3D4-E5F6
turkiye.gov.tr/belge-dogrulama`;
    const b = parseEdevletBelge(ogrenci);
    expect(b.tur).toBe("OGRENCI");
    // Diploma beklenirken öğrenci belgesi → GEÇMEZ
    expect(degerlendir(b, "Ayşe Nur Yılmaz", "MEZUNIYET").ok).toBe(false);
    // ...ama öğrenci belgesi beklenirken GEÇER
    expect(degerlendir(b, "Ayşe Nur Yılmaz", "OGRENCI").ok).toBe(true);
  });

  it("tıp DIŞI mezuniyet belgesi klinik kapıyı AÇMAZ", () => {
    const hukuk = BELGE.replace("TIP FAKÜLTESİ", "HUKUK FAKÜLTESİ");
    const s = degerlendir(parseEdevletBelge(hukuk), "Ayşe Nur Yılmaz");
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/program/i);
  });

  it("diş hekimliği programı KABUL edilir (resmî ad — terim istisnası)", () => {
    const dis = BELGE.replace("TIP FAKÜLTESİ", "DİŞ HEKİMLİĞİ FAKÜLTESİ");
    expect(degerlendir(parseEdevletBelge(dis), "Ayşe Nur Yılmaz").ok).toBe(true);
  });
});

describe("Otomatik doğrulama kararı — fail-closed", () => {
  it("tam belge + eşleşen ad → OTOMATİK GEÇER", () => {
    const s = degerlendir(parseEdevletBelge(BELGE), "Ayşe Nur Yılmaz");
    expect(s.ok).toBe(true);
    expect(s.tanindi).toBe(true);
    expect(s.barcode).toBe("A1B2-C3D4-E5F6");
  });
  it("ad eşleşmezse GEÇMEZ ama TANINIR (en şüpheli hâl — incelemeciye bayrak)", () => {
    const s = degerlendir(parseEdevletBelge(BELGE), "Fatma Demir");
    expect(s.ok).toBe(false);
    expect(s.tanindi).toBe(true); // belge gerçek görünüyor, ad tutmuyor → başkasının belgesi olabilir
    expect(s.reason).toMatch(/ad/i);
  });
  it("e-Devlet işareti yoksa GEÇMEZ", () => {
    const s = degerlendir(parseEdevletBelge("Adı Soyadı : AYŞE YILMAZ\nBarkod No : A1B2-C3D4-E5F6"), "Ayşe Yılmaz");
    expect(s.ok).toBe(false);
  });
  it("barkod okunamazsa GEÇMEZ", () => {
    const metin = "turkiye.gov.tr\nYükseköğretim Mezun Belgesi\nProgram : TIP FAKÜLTESİ\nAdı Soyadı : AYŞE YILMAZ";
    const s = degerlendir(parseEdevletBelge(metin), "Ayşe Yılmaz");
    expect(s.ok).toBe(false);
    expect(s.reason).toMatch(/barkod/i);
  });
  it("profil adı boşsa GEÇMEZ (OAuth boş-kimlik hesabı otomatik aktive olamaz)", () => {
    expect(degerlendir(parseEdevletBelge(BELGE), null).ok).toBe(false);
    expect(degerlendir(parseEdevletBelge(BELGE), "").ok).toBe(false);
  });
  it("gerekçe metni TC'yi DIŞARI SIZDIRMAZ", () => {
    // reason audit detail'ine yazılabiliyor → TC asla içinde geçmemeli (KVKK veri minimizasyonu).
    for (const ad of ["Ayşe Nur Yılmaz", "Fatma Demir", null]) {
      expect(degerlendir(parseEdevletBelge(BELGE), ad).reason).not.toContain(GECERLI_TC);
    }
  });
});

describe("v6.119 aktivasyon kapısı — belge VARLIĞI artık yetmez", () => {
  const noMmss = { mmssInsurer: null, mmssPolicyNo: null, mmssCoverageLimit: null };

  it("PENDING diploma klinik kapıyı AÇMAZ (v6.119 sıkılaşmasının çekirdeği)", () => {
    expect(canActivate([{ type: "DIPLOMA", status: "PENDING" }], noMmss)).toBe(false);
  });
  it("REJECTED diploma klinik kapıyı AÇMAZ", () => {
    expect(canActivate([{ type: "DIPLOMA", status: "REJECTED" }], noMmss)).toBe(false);
  });
  it("ACCEPTED diploma AÇAR", () => {
    expect(canActivate([{ type: "DIPLOMA", status: "ACCEPTED" }], noMmss)).toBe(true);
    expect(hasAcceptedRequiredDocs([{ type: "DIPLOMA", status: "ACCEPTED" }])).toBe(true);
  });
  it("aynı tipte hem PENDING hem ACCEPTED varsa ACCEPTED kazanır (tekil belge yeniden yüklemesi)", () => {
    expect(canActivate(
      [{ type: "DIPLOMA", status: "PENDING" }, { type: "DIPLOMA", status: "ACCEPTED" }], noMmss,
    )).toBe(true);
  });

  it("🔴 onboarding kapısı ONAY BEKLEMEZ — yoksa doktor kayıtta asılı kalır", () => {
    // hasRequiredDocs (varlık) ile canActivate (onay) BİLİNÇLİ olarak ayrıdır.
    const pending = [{ type: "DIPLOMA", status: "PENDING" }];
    expect(hasRequiredDocs(pending)).toBe(true);
    expect(canActivate(pending, noMmss)).toBe(false);

    const tam = {
      ...noMmss, procedures: '{"K001":100}', licenseNo: "12345",
      specBoard: "Kardiyoloji Uzmanlık Belgesi", branch: "Kardiyoloji", city: "İstanbul",
    };
    expect(canCompleteOnboarding(pending, tam)).toBe(true);
  });
});

describe("onayKarari — offline × çevrimiçi kabul matrisi (v6.120)", () => {
  it("offline geçmeyen belge çevrimiçi sonuç ne olursa olsun KABUL EDİLMEZ", () => {
    for (const c of ["GECERLI", "GECERSIZ", "BELIRSIZ", "KAPALI", null] as const) {
      expect(onayKarari(false, c)).toBe(false);
    }
  });
  it("çevrimiçi teyit yok/kapalıyken offline tek başına karar verir (v6.119 canlı davranışı)", () => {
    expect(onayKarari(true, null)).toBe(true);
    expect(onayKarari(true, "KAPALI")).toBe(true);
  });
  it("devletin aslı da doğruladıysa KABUL (en güçlü hâl)", () => {
    expect(onayKarari(true, "GECERLI")).toBe(true);
  });
  it("🔴 devlet iddiayı desteklemediyse offline geçse bile KABUL EDİLMEZ (sahtecilik kırılır)", () => {
    expect(onayKarari(true, "GECERSIZ")).toBe(false);
  });
  it("🔴 teyit AÇIKKEN belirsizlik kapı AÇMAZ (fail-closed — kesintide PENDING birikir, bilinçli bedel)", () => {
    expect(onayKarari(true, "BELIRSIZ")).toBe(false);
  });
});

describe("activationState — doktora gösterilecek hâl", () => {
  it("belge yoksa MISSING", () => {
    expect(activationState([])).toBe("MISSING");
    expect(activationState([{ type: "MMSS", status: "ACCEPTED" }])).toBe("MISSING");
  });
  it("yüklendi ama doğrulanmadıysa PENDING_REVIEW", () => {
    expect(activationState([{ type: "DIPLOMA", status: "PENDING" }])).toBe("PENDING_REVIEW");
  });
  it("onaylıysa ACTIVE", () => {
    expect(activationState([{ type: "DIPLOMA", status: "ACCEPTED" }])).toBe("ACTIVE");
  });
  it("reddedildiyse REJECTED — PENDING'e göre öncelikli (doktor boşuna beklemesin)", () => {
    expect(activationState([
      { type: "DIPLOMA", status: "REJECTED" }, { type: "DIPLOMA", status: "PENDING" },
    ])).toBe("REJECTED");
  });
  it("ACCEPTED her şeyi yener", () => {
    expect(activationState([
      { type: "DIPLOMA", status: "REJECTED" }, { type: "DIPLOMA", status: "ACCEPTED" },
    ])).toBe("ACTIVE");
  });
});
