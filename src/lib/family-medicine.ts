/** Source directory, not a clinical protocol. No patient data or treatment rules. */
export const FAMILY_MEDICINE_BRANCH = "aile-hekimligi";
export interface FamilyMedicineSourceReview {
  sourceVersion: { label: string | null; verifiedAt: string | null };
  technicalCheck: { checkedAt: string | null };
  clinicalReview:
    | { status: "pending" }
    | { status: "reviewed"; reviewer: string; reviewedAt: string };
}

// No live link check or clinical editorial review has been completed for this
// directory. A year in a title is not a verified source version.
const PENDING_SOURCE_REVIEW: FamilyMedicineSourceReview = {
  sourceVersion: { label: null, verifiedAt: null },
  technicalCheck: { checkedAt: null },
  clinicalReview: { status: "pending" },
};

/** Keep link availability, source version and clinical review independent. */
export function familyMedicineSourceReviewLabels(review: FamilyMedicineSourceReview) {
  return {
    version: review.sourceVersion.label && review.sourceVersion.verifiedAt
      ? `${review.sourceVersion.label} (sürüm kontrolü: ${review.sourceVersion.verifiedAt})`
      : "Henüz doğrulanmadı",
    technical: review.technicalCheck.checkedAt ?? "Henüz yapılmadı",
    clinical: review.clinicalReview.status === "reviewed"
      ? `${review.clinicalReview.reviewer} · ${review.clinicalReview.reviewedAt}`
      : "Henüz yapılmadı",
  };
}

export const FAMILY_MEDICINE_RESOURCES = [
  { review: { sourceVersion: { label: "22 Mayıs 2026 duyurusu; 19 Mayıs 2026 / 33258 RG bilgisi", verifiedAt: "2026-11-07" }, technicalCheck: { checkedAt: "2026-11-07" }, clinicalReview: { status: "pending" } } as FamilyMedicineSourceReview, id: "report-regulation", title: "Sağlık Raporları Yönetmeliği", publisher: "Sağlık Bakanlığı / Mevzuat İşleri", kind: "Resmî yayımlanma duyurusu", description: "Bakanlık duyurusu yönetmeliğin 19 Mayıs 2026 tarihinde yayımlandığını bildiriyor. Rapor türüne özgü maddeler ve sonraki değişiklikler ayrıca incelenmelidir.", url: "https://shgmmevzuatdb.saglik.gov.tr/TR-117242/saglik-raporlari-yonetmeligi-yayimlandi.html" },
  { review: { sourceVersion: { label: "2 Temmuz 2026 kaldırılma duyurusu", verifiedAt: "2026-11-07" }, technicalCheck: { checkedAt: "2026-11-07" }, clinicalReview: { status: "pending" } } as FamilyMedicineSourceReview, id: "report-repeal", title: "2019 rapor yönergesi yürürlükten kaldırıldı", publisher: "Sağlık Bakanlığı / Sosyal Güvenlik Uygulamaları", kind: "Yürürlük uyarısı", description: "Bakanlık, 2019 yönergesinin 26 Haziran 2026 tarihli Makam Oluru ile kaldırıldığını bildiriyor. Eski yönerge güncel işlem kuralı olarak kullanılmamalıdır.", url: "https://shgmsgudb.saglik.gov.tr/TR-118487/saglik-raporlari-usul-ve-esaslari-hakkinda-yonerge-yururlukten-kaldirilmistir.html" },
  { review: { sourceVersion: { label: "2 Kasım 2026 duyurusu; DENİZ 1 Eylül 2026 sürüm bilgisi", verifiedAt: "2026-11-07" }, technicalCheck: { checkedAt: "2026-11-07" }, clinicalReview: { status: "pending" } } as FamilyMedicineSourceReview, id: "asm-forms", title: "ASM / AHB izleme ve değerlendirme formları", publisher: "Bingöl İl Sağlık Müdürlüğü", kind: "Resmî form duyurusu", description: "Duyuru, DENİZ üzerinde 1 Eylül 2026'dan itibaren kullanılan sürüme göre hazırlanan formlara erişim sağlar. Form maddeleri burada klinik veya hukuki onaydan geçirilmemiştir.", url: "https://bingolism.saglik.gov.tr/TR-396607/aile-hekimligi-izleme-ve-degerlendirme-formlari.html" },
  { review: PENDING_SOURCE_REVIEW, id: "hyp", title: "HYP tarama ve izlem", publisher: "Sağlık Bakanlığı / HSGM", kind: "Resmî kılavuz", description: "Kronik hastalık tarama ve takip süreçlerinin kaynak belgesi. Uygulama öncesi güncel sürümü kontrol edin.", url: "https://hsgm.saglik.gov.tr/depo/birimler/aile-hekimligi-uygulama-ve-gelistirme-db/Dokumanlar/Yonerge/Ek_Hastalik_Yonetim_Platformu_HYP_Tarama_ve_Takip_Kilavuzu_1.pdf" },
  { review: PENDING_SOURCE_REVIEW, id: "tahud", title: "Tanı ve Tedavi Rehberi 2026", publisher: "TAHUD", kind: "Meslek derneği kaynağı", description: "Birinci basamak için derneğin rehber sayfası. İçerik kaynak sitesinde açılır.", url: "https://tahud.org.tr/kitap/tani-ve-tedavi-rehberi-2026" },
  { review: PENDING_SOURCE_REVIEW, id: "asm", title: "ASM / AHB izleme ve değerlendirme", publisher: "Şırnak İl Sağlık Müdürlüğü", kind: "2026 rehber duyurusu", description: "ASM işleyişi ve değerlendirme rehberine erişim. Yerel uygulama ve son sürüm yetkili kaynaktan doğrulanmalıdır.", url: "https://sirnakism.saglik.gov.tr/TR-371263/asm-ahb-izleme-ve-degerlendirme-rehberi-2026.html" },
  { review: PENDING_SOURCE_REVIEW, id: "regulation", title: "9 Nisan 2026 yönetmelik değişikliği", publisher: "Resmî Gazete", kind: "Mevzuat kaynağı", description: "Aile hekimliği uygulamasına ilişkin değişiklik metni. Daha sonraki değişiklikleri ve yürürlük hükümlerini birlikte kontrol edin.", url: "https://www.resmigazete.gov.tr/eskiler/2026/04/20260409-6.htm" },
] as const;
export const FAMILY_MEDICINE_ENTRY_POINTS = [
  { title: "Akademik yayınlar", href: "/doktor/doctorium?m=akademik&b=aile-hekimligi", description: "Özelleştir bölümünde Aile Hekimliği'ni seçerek birinci basamak yayınlarını akışınıza ekleyin." },
  { title: "Sağlık hukuku", href: "/doktor/doctorium?m=mevzuat", description: "Mevzuat, içtihat ve doktrin kaynakları. Genel hukuk akışı; yalnız ASM'ye özel bir değişiklik alarmı değildir." },
  { title: "Eğitim ve etkinlikler", href: "/doktor/doctorium?m=etkinlik&b=aile-hekimligi&t=hepsi", description: "Aile Hekimliği tercihinden sonra kongre, kurs ve eğitimleri inceleyin; seçtiklerinizi mevcut takviminizden takip edin." },
  { title: "Doctorium Post", href: "/doktor/doctorium/ozet", description: "Mevcut kişisel seçkinizi açın. Bülten ve e-posta tercihleri Özelleştir bölümünden yönetilir." },
] as const;
