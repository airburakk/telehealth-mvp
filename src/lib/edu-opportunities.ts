// Kariyer EDU — staj / değişim / burs FIRSAT TAKVİMİ (üç katman Faz B1 iskeleti → E1 ilk veri 2026-09-05; rapor §7; plan
// output/doctorium-veri-fazlari-plani-2026-09-05.md B.1). SAF modül.
//
// Ürün formu Etkinlik (kongre) modülünün öğrenci karşılığıdır: takvim + son başvuru + süzgeç + hatırlatma (E2) + resmî kaynağa
// bağlantı. ⚖️ İLAN DEĞİL, SÜREÇ BİLGİSİ: başvur düğmesi, CV gönderimi, işveren eşleştirmesi YOK (İŞKUR özel istihdam bürosu
// izni sınırı — CareerPathway ile aynı dil; testte yasaklı sözcük listesi).
//
// VERİ KURALLARI (plan "değişmeyen kurallar"): her satır kurumun KENDİ sayfasından (sourceUrl, test: resmî alan adı listesi) ve
// doğrulama günü (verifiedAt) taşır · son başvuru ISO gün ya da null + deadlineNote ("dönemsel — …"; takvime DÜŞMEZ) · 👤 onay
// (approvedAt) olmayan satır GÖRÜNMEZ (approvedEduOpportunities) · burs kapsamı 👤 2026-09-05: kamu + üniversite + büyük vakıf
// (ilaç/cihaz/ticari kuruluş bursu DIŞARIDA — dolaylı tanıtım) · eligibility KISA özet, kaynak metin kopyalanmaz.
//
// E1 derlemesi 2026-09-05 (13 kayıt): TEV · VKV · TÜBİTAK 2209-A · TÜBİTAK 2247-C STAR · KYK · VGM · Farabi · Mevlana ·
// Erasmus+ KA131 · TurkMSIC SCOPE · TurkMSIC SCORE · AAMC VSLO · WHO stajı. Değerlendirilip ALINMAYANLAR: TÜBİTAK 2205
// (olimpiyat madalyası / temel bilimler — tıp kapsamı yok) · Amgen Scholars Europe (Türkiye üniversiteleri için uygunluk
// kaynakta net değil) · DAAD RISE (tıp programı listede yok) · YTB Türkiye Bursları (yalnız uluslararası öğrenci).
export type EduOpportunityKind = "staj" | "degisim" | "burs";

export const EDU_KIND_LABEL: Record<EduOpportunityKind, string> = {
  staj: "Staj / gözlemcilik",
  degisim: "Değişim programı",
  burs: "Burs / destek",
};

const COUNTRY: Record<string, string> = { TR: "Türkiye", US: "ABD", CH: "İsviçre", DE: "Almanya" };
/** ISO ülke kodu → Türkçe ad; null = çok ülkeli program. */
export function eduCountryLabel(code: string | null): string {
  return code ? (COUNTRY[code] ?? code) : "Çok ülkeli";
}

export interface EduOpportunity {
  id: string;
  kind: EduOpportunityKind;
  title: string;
  organizer: string;
  /** ISO ülke kodu ya da "TR"; çok ülkeli programda null. */
  country: string | null;
  /** ISO gün — son başvuru; dönemsel/duyurulmamış takvimde null (o zaman deadlineNote zorunlu; takvime düşmez). */
  deadline: string | null;
  /** deadline null iken: "dönemsel — genelde Ekim–Kasım; 2026-27 takvimi duyurulmadı" gibi kısa not. */
  deadlineNote: string | null;
  startsAt: string | null;
  /** Şartların KISA özeti (not ortalaması eşiği, dil belgesi, sınıf) — kaynak metin kopyalanmaz. */
  eligibility: string;
  sourceUrl: string;
  /** Kaynağı doğrulayan kişinin işaretlediği gün (ISO). */
  verifiedAt: string;
  /** 👤 yayın onayı günü (ISO) — null iken satır hiçbir yüzeyde GÖRÜNMEZ. */
  approvedAt: string | null;
}

const V = "2026-09-05";
/** 👤 yayın onayı — 13/13 kayıt, 2026-09-05 ("13 kaydın hepsini onayla"). Yeni kayıt null ile girilir, onaylanınca tarih alır. */
const A = "2026-09-05";

/** İnsan derlemeli fırsatlar — E1 (2026-09-05). approvedAt null = 👤 onay bekliyor (gizli); E1'in 13 kaydı 2026-09-05'te onaylandı. */
export const EDU_OPPORTUNITIES: readonly EduOpportunity[] = [
  // ── Burslar (kamu · üniversite · büyük vakıf) ──
  { id: "tev-universite-2026", kind: "burs", title: "TEV Üniversite Eğitim Bursu 2026-2027", organizer: "Türk Eğitim Vakfı", country: "TR",
    deadline: "2026-10-08", deadlineNote: null, startsAt: null,
    eligibility: "Lisans öğrencisi; akademik başarı ve maddi destek ihtiyacı birlikte aranır. Aylık 8.000 TL, Ekim–Haziran (9 ay). Başvuru 14 Eylül – 8 Ekim 2026, TEV'in Obigenç uygulamasından.",
    sourceUrl: "https://www.tev.org.tr/burs/tr/39/Universite-Egitim-Bursu", verifiedAt: V, approvedAt: A },
  { id: "vkv-universite-2026", kind: "burs", title: "Vehbi Koç Vakfı Üniversite Bursu 2026-2027", organizer: "Vehbi Koç Vakfı", country: "TR",
    deadline: "2026-10-09", deadlineNote: null, startsAt: null,
    eligibility: "T.C. vatandaşı, tam zamanlı lisans öğrencisi; not ortalaması en az 2,50/4 (60/100); maddi ihtiyaç; başka karşılıksız burs almıyor olma. Kapsamdaki 29 üniversitenin listesi kaynakta. Başvuru 21 Eylül – 9 Ekim 2026, VKV Burs Portalı.",
    sourceUrl: "https://www.vkv.org.tr/tr/burslar/universite-burslari-75", verifiedAt: V, approvedAt: A },
  { id: "tubitak-2209a", kind: "burs", title: "TÜBİTAK 2209-A Üniversite Öğrencileri Araştırma Projeleri Desteği", organizer: "TÜBİTAK BİDEB", country: "TR",
    deadline: null, deadlineNote: "Yılda bir çağrı, genelde Ekim–Kasım (2025 çağrısı 13 Ekim – 19 Kasım); 2026 çağrısı henüz duyurulmadı", startsAt: null,
    eligibility: "Ön lisans/lisans öğrencisi (tıp fakültesi dâhil; açıköğretim ve hazırlık sınıfı hariç); akademik danışmanla yürütülen araştırma projesi; 12 aya kadar, en fazla 12.000 TL. Başvuru TÜBİTAK TYBS üzerinden.",
    sourceUrl: "https://tubitak.gov.tr/en/scholarships/degree-associate-degree/destek-programlari/2209-research-project-support-programme-undergraduate-students", verifiedAt: V, approvedAt: A },
  { id: "tubitak-2247c-star", kind: "burs", title: "TÜBİTAK 2247-C Stajyer Araştırmacı Bursu (STAR)", organizer: "TÜBİTAK BİDEB", country: "TR",
    deadline: null, deadlineNote: "Dönemsel çağrılar (2026 yılı 1. dönem tamamlandı); sonraki çağrı TÜBİTAK duyurusuyla açılır", startsAt: null,
    eligibility: "Lisans öğrencisi (T.C. vatandaşı ya da Mavi Kart); tam/yarı zamanlı çalışmıyor olmak. TÜBİTAK merkezlerinde ya da TÜBİTAK/ADEP destekli projelerde stajyer araştırmacılık; aylık 6.000 TL, en fazla 6 ay. Başvuru e-bideb.",
    sourceUrl: "https://tubitak.gov.tr/en/scholarships/degree-associate-degree/scholarship-programs/2247-c-star-intern-researcher-scholarship-programme", verifiedAt: V, approvedAt: A },
  { id: "kyk-burs-kredi-2026", kind: "burs", title: "KYK Burs ve Öğrenim Kredisi 2026-2027", organizer: "Gençlik ve Spor Bakanlığı — Kredi ve Yurtlar Genel Müdürlüğü", country: "TR",
    deadline: null, deadlineNote: "Her yıl Ekim–Kasım'da e-Devlet üzerinden; 2026-2027 takvimi henüz duyurulmadı", startsAt: null,
    eligibility: "Örgün yükseköğretim öğrencisi; ekonomik ve sosyal durum beyanı kamu verileriyle teyit edilir; burs ya da öğrenim kredisi olarak ödenir. Başvuru yalnız e-Devlet.",
    sourceUrl: "https://kygm.gsb.gov.tr/", verifiedAt: V, approvedAt: A },
  { id: "vgm-yuksekogrenim-2026", kind: "burs", title: "Vakıflar Genel Müdürlüğü Yükseköğrenim Bursu 2026-2027", organizer: "T.C. Vakıflar Genel Müdürlüğü", country: "TR",
    deadline: null, deadlineNote: "Her yıl Ekim'de (2025: 21–31 Ekim) vgm.gov.tr üzerinden; 2026-2027 takvimi ek yerleştirme sonrası duyurulur", startsAt: null,
    eligibility: "Örgün yükseköğrenim öğrencisi; maddi durum ve başarı ölçütleri kaynakta. Başvuru yalnız vgm.gov.tr üzerinden — aracı siteler geçersiz.",
    sourceUrl: "https://www.vgm.gov.tr/sayfalar/burs-basvurulari", verifiedAt: V, approvedAt: A },
  // ── Değişim programları ──
  { id: "farabi", kind: "degisim", title: "Farabi Değişim Programı (yurt içi)", organizer: "Yükseköğretim Kurulu", country: "TR",
    deadline: null, deadlineNote: "Başvuru, kayıtlı olduğunuz üniversitenin Farabi ofisi duyurusuyla (çoğunlukla bahar döneminde, sonraki yıl için)", startsAt: null,
    eligibility: "Lisans not ortalaması en az 2,00/4; bir veya iki yarıyıl Türkiye'de başka bir üniversitede öğrenim. Tıp gibi yıllık sistemde eğitim veren programlarda karşı üniversitenin de yıllık sistemde olması gerekir.",
    sourceUrl: "https://farabi.yok.gov.tr/farabi-degisim-programi", verifiedAt: V, approvedAt: A },
  { id: "mevlana", kind: "degisim", title: "Mevlana Değişim Programı (yurt dışı)", organizer: "Yükseköğretim Kurulu", country: null,
    deadline: null, deadlineNote: "Başvuru, üniversitenizin uluslararası ilişkiler ofisi duyurusuyla; anlaşmalı üniversite listesi ofiste", startsAt: null,
    eligibility: "Türkiye'deki üniversitelerle protokolü olan yurt dışı üniversitelerde en az bir, en fazla iki yarıyıl öğrenim; not ortalaması ve dil şartı YÖK başvuru şartları belgesinde.",
    sourceUrl: "https://mevlana.yok.gov.tr/", verifiedAt: V, approvedAt: A },
  { id: "erasmus-ka131", kind: "degisim", title: "Erasmus+ KA131 Öğrenim ve Staj Hareketliliği (Avrupa)", organizer: "Türkiye Ulusal Ajansı", country: null,
    deadline: null, deadlineNote: "Başvuru kendi üniversitenizin duyurusuyla TURNAPortal üzerinden (çoğu üniversitede Şubat–Mart, sonraki akademik yıl için)", startsAt: null,
    eligibility: "Örgün lisans öğrencisi; not ortalaması ve yabancı dil eşiğini üniversiteniz Ulusal Ajans el kitabı çerçevesinde belirler. Staj hareketliliği 2–12 ay; hastane ve klinik stajı mümkün. Hibe, gidilen ülke grubuna göre.",
    sourceUrl: "https://www.ua.gov.tr/programlar/firsatlar/ka1-ka131-hed-program-ulkelerinde-staj/", verifiedAt: V, approvedAt: A },
  // ── Staj / gözlemcilik ──
  { id: "turkmsic-scope", kind: "staj", title: "TurkMSIC SCOPE — Yurt Dışı Klinik Staj Değişimi (IFMSA)", organizer: "Türk Tıp Öğrencileri Birliği", country: null,
    deadline: null, deadlineNote: "Yıllık Değişim Sınavı ile seçim; takvim degisim.turkmsic.org ve fakültenizin LEO'su üzerinden duyurulur", startsAt: null,
    eligibility: "TurkMSIC üyesi fakültelerin tıp öğrencileri; IFMSA ağında yurt dışı klinik staj (yaklaşık 4 hafta). Sıralama Değişim Sınavı puanıyla; fakülte değişim sorumlusu (LEO) başvuruyu yürütür.",
    sourceUrl: "https://turkmsic.org/scope", verifiedAt: V, approvedAt: A },
  { id: "turkmsic-score", kind: "staj", title: "TurkMSIC SCORE — Araştırma Değişimi (IFMSA)", organizer: "Türk Tıp Öğrencileri Birliği", country: null,
    deadline: null, deadlineNote: "Yıllık Değişim Sınavı ile seçim; takvim degisim.turkmsic.org üzerinden", startsAt: null,
    eligibility: "Tıp öğrencileri; yurt dışı laboratuvar ya da klinik araştırma projesinde yaklaşık 4 haftalık değişim, sorumlu öğretim üyesi rehberliğinde. Seçim Değişim Sınavı ile; yerel araştırma değişim sorumlusu (LORE) destek verir.",
    sourceUrl: "https://turkmsic.org/score", verifiedAt: V, approvedAt: A },
  { id: "aamc-vslo", kind: "staj", title: "AAMC VSLO — Yurt Dışı Seçmeli Staj ve Gözlemcilik (Global Network)", organizer: "Association of American Medical Colleges", country: null,
    deadline: null, deadlineNote: "Ev sahibi kurum katalogları çoğunlukla Şubat–Nisan'da açılır; başvuru fakültenizin daveti ve VSLO servisi üzerinden", startsAt: null,
    eligibility: "Fakülteniz VSLO Global Network üyesi olmalı (uluslararası ofisinize sorun). Sınıf, dil, sigorta ve ücret şartları kurum ve elektif bazında; başvuru yalnız Home kurum onayıyla iletilir.",
    sourceUrl: "https://students-residents.aamc.org/attending-medical-school/article/global-network/", verifiedAt: V, approvedAt: A },
  { id: "who-internship", kind: "staj", title: "Dünya Sağlık Örgütü Staj Programı (WHO Internship)", organizer: "Dünya Sağlık Örgütü", country: null,
    deadline: null, deadlineNote: "Sürekli başvuru; açık stajlar careers.who.int üzerinde yayımlanır", startsAt: null,
    eligibility: "En az 20 yaş; en az 3 yıl tam zamanlı üniversite eğitimini tamamlamış öğrenci ya da son 18 ayda mezun; tıp ve sağlık alanları uygun; görev ofisinin dilinde akıcılık. 6–24 hafta; yaşam desteği ödeneği ve sigorta sağlanır.",
    sourceUrl: "https://www.who.int/careers/internship-programme", verifiedAt: V, approvedAt: A },
];

/** Yalnız 👤 onaylı satırlar; tarihli olanlar önce (yakın son başvuru üstte), tarihsizler sonra (dizi sırası). */
export function approvedEduOpportunities(list: readonly EduOpportunity[] = EDU_OPPORTUNITIES): EduOpportunity[] {
  const rows = list.filter((o) => o.approvedAt !== null);
  const dated = rows.filter((o) => o.deadline).sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));
  return [...dated, ...rows.filter((o) => !o.deadline)];
}
