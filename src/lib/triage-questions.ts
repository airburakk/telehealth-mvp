// Branşa Özel Dinamik Triyaj Soruları (Modül 1)
// Her tıbbi branş için, video konsültasyon öncesi uzmanın ihtiyaç duyacağı yapılandırılmış
// ön-değerlendirme soruları. Yanıtlar Case.extra (JSON) olarak saklanır, triyaj AI'sına
// beslenir (branş + aciliyet) ve doktor kokpitinde gösterilir.
//
// Yanıtlar SORU ETİKETİYLE (label) anahtarlanır → hem AI hem doktor için kendiliğinden açıklayıcı.
// Branş anahtarları src/lib/triage.ts BRANCHES ile birebir aynı olmalıdır.

export type QType = "text" | "number" | "select" | "multi" | "bool" | "scale";

export interface TQuestion {
  id: string; // branş içinde benzersiz teknik kimlik (React key)
  label: string; // hastaya gösterilen soru — yanıt bu etiketle saklanır
  type: QType;
  options?: string[]; // select / multi için
  unit?: string; // number için (ör. "yıl", "kg")
  placeholder?: string;
  help?: string; // küçük açıklama
  recommended?: boolean; // yanıtlanması önerilen (UI'da işaretli)
}

export interface BranchQuestionSet {
  intro: string;
  questions: TQuestion[];
}

// ── Tüm branşlarda sorulan ortak sorular ──
export const COMMON_QUESTIONS: TQuestion[] = [
  { id: "age", label: "Hastanın yaşı", type: "number", unit: "yaş", recommended: true },
  { id: "sex", label: "Cinsiyet", type: "select", options: ["Kadın", "Erkek", "Belirtmek istemiyorum"] },
  { id: "chronic", label: "Bilinen kronik hastalık(lar)", type: "multi", options: ["Yok", "Diyabet", "Tansiyon", "Kalp hastalığı", "Astım/KOAH", "Tiroid", "Böbrek", "Karaciğer", "Kanser öyküsü"] },
  { id: "meds", label: "Sürekli kullanılan ilaçlar", type: "text", placeholder: "Yok / ilaç adları", recommended: true },
  { id: "allergy", label: "Bilinen alerji (ilaç/gıda)", type: "text", placeholder: "Yok / penisilin vb." },
  { id: "bloodthinner", label: "Kan sulandırıcı kullanıyor mu?", type: "bool", help: "Aspirin, warfarin, Eliquis vb." },
];

// ── Branşa özel sorular ──
export const BRANCH_QUESTIONS: Record<string, BranchQuestionSet> = {
  onkoloji: {
    intro: "Onkolojik değerlendirme için mevcut tanı, tetkik ve şikâyetlerinizi netleştirelim.",
    questions: [
      { id: "onk_status", label: "Kanser tanısı durumu", type: "select", options: ["Kesin tanı kondu", "Şüphe var, tetkikler sürüyor", "Henüz tetkik yapılmadı"], recommended: true },
      { id: "onk_site", label: "Etkilenen organ / bölge", type: "text", placeholder: "Ör. akciğer, meme, kalın bağırsak", recommended: true },
      { id: "onk_biopsy", label: "Biyopsi yapıldı mı?", type: "bool" },
      { id: "onk_stage", label: "Evre / patoloji raporu biliniyor mu?", type: "select", options: ["Evet, raporu var", "Hayır", "Bilmiyorum"] },
      { id: "onk_prior", label: "Daha önce alınan tedaviler", type: "multi", options: ["Hiçbiri", "Cerrahi", "Kemoterapi", "Radyoterapi", "İmmünoterapi", "Hedefe yönelik tedavi"] },
      { id: "onk_symp", label: "Şu anki şikâyetler", type: "multi", options: ["Yok", "Ağrı", "Kilo kaybı", "Kanama", "Halsizlik", "Nefes darlığı", "Yutma güçlüğü"] },
      { id: "onk_weight", label: "Son 1 ayda istemsiz kilo kaybı", type: "select", options: ["Yok", "1-3 kg", "3 kg üzeri"] },
      { id: "onk_reports", label: "Elinizdeki tıbbi belgeler", type: "multi", options: ["Patoloji", "Görüntüleme (BT/MR/PET)", "Kan tahlili", "Ameliyat raporu", "Yok"] },
      { id: "onk_goal", label: "Beklentiniz", type: "select", options: ["İkinci görüş", "Tedavi planı", "Tedaviye devam / nakil"], recommended: true },
    ],
  },

  kardiyoloji: {
    intro: "Kalp-damar değerlendirmesi için belirti ve geçmişinizi alalım.",
    questions: [
      { id: "kar_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Göğüs ağrısı", "Çarpıntı", "Nefes darlığı", "Bayılma / baş dönmesi", "Yüksek tansiyon", "Bacakta şişme"], recommended: true },
      { id: "kar_exertion", label: "Göğüs ağrısı/nefes darlığı eforla mı artıyor?", type: "select", options: ["Evet, eforla artıyor", "İstirahatte de oluyor", "Şikâyet yok"], help: "İstirahatte olması daha öncelikli değerlendirilir." },
      { id: "kar_known", label: "Bilinen kalp hastalığı", type: "multi", options: ["Yok", "Tansiyon", "Ritim bozukluğu", "Kalp yetmezliği", "Geçirilmiş kalp krizi", "Kapak hastalığı"] },
      { id: "kar_proc", label: "Daha önce kalp işlemi", type: "multi", options: ["Yok", "Stent", "Bypass", "Kalp pili", "Ablasyon", "Kapak ameliyatı"] },
      { id: "kar_tests", label: "Yapılmış tetkikler", type: "multi", options: ["EKG", "Eko", "Efor testi", "Anjiyografi", "Holter", "Yok"] },
      { id: "kar_smoke", label: "Sigara kullanımı", type: "select", options: ["Hayır", "Bıraktım", "Evet"] },
      { id: "kar_breath", label: "Merdiven/yürüyüşte nefes darlığı", type: "select", options: ["Yok", "Hafif", "Belirgin", "İstirahatte bile var"] },
    ],
  },

  ortopedi: {
    intro: "Ortopedik şikâyetinizi (bölge, süre, hareket) ayrıntılandıralım.",
    questions: [
      { id: "ort_region", label: "Etkilenen bölge", type: "multi", options: ["Diz", "Kalça", "Omuz", "Bel", "Boyun", "El / bilek", "Ayak / ayak bileği", "Dirsek"], recommended: true },
      { id: "ort_complaint", label: "Şikâyet türü", type: "multi", options: ["Ağrı", "Hareket kısıtlılığı", "Şişlik", "Kilitlenme", "Boşalma hissi", "Uyuşma / karıncalanma"] },
      { id: "ort_pain", label: "Ağrı şiddeti", type: "scale", help: "0 = ağrı yok, 10 = dayanılmaz" },
      { id: "ort_trauma", label: "Travma / kaza öyküsü var mı?", type: "bool" },
      { id: "ort_duration", label: "Şikâyet ne zamandır var?", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
      { id: "ort_walk", label: "Yürüme durumu", type: "select", options: ["Normal", "Aksayarak", "Destekle (baston/koltuk değneği)", "Yürüyemiyor"] },
      { id: "ort_img", label: "Yapılmış görüntüleme", type: "multi", options: ["Röntgen", "MR", "BT", "Yok"] },
      { id: "ort_prior", label: "Daha önce ortopedik ameliyat?", type: "bool" },
      { id: "ort_plan", label: "Önerilmiş/düşünülen tedavi", type: "select", options: ["Bilmiyorum", "Protez (kalça/diz)", "Artroskopi", "Fizik tedavi", "Belirsiz"] },
    ],
  },

  norosirurji: {
    intro: "Beyin/omurga şikâyetiniz için sinir sistemi belirtilerini değerlendirelim.",
    questions: [
      { id: "nor_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Bel/boyun ağrısı", "Kola/bacağa yayılan ağrı", "Uyuşma / güçsüzlük", "Baş ağrısı", "Denge kaybı", "Nöbet / havale"], recommended: true },
      { id: "nor_power", label: "Kol veya bacakta güç kaybı", type: "select", options: ["Yok", "Hafif", "Belirgin", "Felç (hareket yok)"], help: "Belirgin güç kaybı acil değerlendirme gerektirir." },
      { id: "nor_sphincter", label: "İdrar/dışkı kontrol kaybı var mı?", type: "bool", help: "Acil bulgu olabilir." },
      { id: "nor_headache", label: "Baş ağrısı sabaha karşı / kusmayla mı?", type: "select", options: ["Hayır", "Evet", "Baş ağrısı yok"] },
      { id: "nor_img", label: "Yapılmış görüntüleme", type: "multi", options: ["MR", "BT", "EMG", "Yok"] },
      { id: "nor_dx", label: "Bilinen tanı (varsa)", type: "text", placeholder: "Ör. bel fıtığı, beyin tümörü" },
      { id: "nor_duration", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
      { id: "nor_prior", label: "Daha önce omurga/beyin ameliyatı?", type: "bool" },
    ],
  },

  "sac-ekimi": {
    intro: "Saç ekimi planlaması için dökülme paterni ve donör alanı değerlendirelim.",
    questions: [
      { id: "sac_area", label: "Dökülme/seyrelme bölgesi", type: "multi", options: ["Ön saç çizgisi", "Tepe (vertex)", "Şakaklar", "Genel seyrelme", "Sakal", "Kaş"], recommended: true },
      { id: "sac_grade", label: "Dökülme derecesi (Norwood)", type: "select", options: ["Hafif", "Orta", "İleri", "Bilmiyorum"] },
      { id: "sac_duration", label: "Ne zamandır dökülüyor?", type: "select", options: ["1 yıldan az", "1-3 yıl", "3-5 yıl", "5 yıldan fazla"] },
      { id: "sac_prior", label: "Daha önce saç ekimi yaptırdınız mı?", type: "bool" },
      { id: "sac_donor", label: "Ense (donör) saç yoğunluğu", type: "select", options: ["İyi", "Orta", "Zayıf", "Bilmiyorum"] },
      { id: "sac_meds", label: "Kullanılan saç tedavisi", type: "multi", options: ["Hiçbiri", "Finasterid", "Minoksidil", "PRP", "Mezoterapi"] },
      { id: "sac_tech", label: "Tercih edilen teknik", type: "select", options: ["Fark etmez", "FUE", "DHT", "Safir FUE", "Bilmiyorum"] },
      { id: "sac_goal", label: "Beklentiniz", type: "text", placeholder: "Ör. ön çizgiyi öne almak, sıklaştırma" },
    ],
  },

  estetik: {
    intro: "Estetik işlem için hedefinizi ve genel sağlık durumunuzu alalım.",
    questions: [
      { id: "est_proc", label: "İlgilenilen işlem(ler)", type: "multi", options: ["Burun (rinoplasti)", "Meme (büyütme/küçültme/dikleştirme)", "Liposuction", "Karın germe", "Yüz germe", "BBL (kalça)", "Botoks / dolgu", "Diğer"], recommended: true },
      { id: "est_detail", label: "Hedef bölge / detay", type: "text", placeholder: "Ör. burun kemeri, göbek bölgesi yağ" },
      { id: "est_prior", label: "Daha önce estetik operasyon geçirdiniz mi?", type: "bool" },
      { id: "est_smoke", label: "Sigara kullanımı", type: "select", options: ["Hayır", "Evet"], help: "İyileşmeyi etkiler." },
      { id: "est_height", label: "Boy", type: "number", unit: "cm" },
      { id: "est_weight", label: "Kilo", type: "number", unit: "kg" },
      { id: "est_goal", label: "Beklentiniz", type: "text", placeholder: "Sonuçtan beklentinizi kısaca yazın" },
    ],
  },

  ivf: {
    intro: "Tüp bebek değerlendirmesi için üreme sağlığı geçmişinizi alalım.",
    questions: [
      { id: "ivf_agew", label: "Kadın yaşı", type: "number", unit: "yaş", recommended: true },
      { id: "ivf_trying", label: "Ne kadardır çocuk sahibi olmaya çalışıyorsunuz?", type: "select", options: ["1 yıldan az", "1-2 yıl", "2-4 yıl", "4 yıldan fazla"], recommended: true },
      { id: "ivf_attempts", label: "Daha önce tüp bebek denemesi", type: "select", options: ["Yok", "1 deneme", "2 deneme", "3 ve üzeri"] },
      { id: "ivf_history", label: "Gebelik / düşük öyküsü", type: "multi", options: ["Yok", "Doğum", "Düşük", "Dış gebelik"] },
      { id: "ivf_dx", label: "Bilinen tanı", type: "multi", options: ["Yok / bilinmiyor", "PCOS", "Endometriozis", "Tüp tıkanıklığı", "Düşük yumurta rezervi", "Erkek faktörü", "Açıklanamayan"] },
      { id: "ivf_cycle", label: "Adet düzeni", type: "select", options: ["Düzenli", "Düzensiz", "Yok (menopoz/diğer)"] },
      { id: "ivf_sperm", label: "Erkek partner sperm tahlili", type: "select", options: ["Normal", "Düşük/bozuk", "Yapılmadı", "Bilmiyorum"] },
      { id: "ivf_hormone", label: "Hormon testleri (AMH/FSH) yapıldı mı?", type: "bool" },
    ],
  },

  dis: {
    intro: "Diş tedavisi için ihtiyaç ve ağız sağlığı durumunuzu alalım.",
    questions: [
      { id: "dis_proc", label: "İlgilenilen tedavi", type: "multi", options: ["İmplant", "Kaplama / lamina", "Gülüş tasarımı", "Ortodonti (tel/şeffaf plak)", "Kanal tedavisi", "Çekim", "Beyazlatma", "Protez"], recommended: true },
      { id: "dis_missing", label: "Eksik diş sayısı", type: "select", options: ["Yok", "1-3", "4-6", "6'dan fazla"] },
      { id: "dis_pain", label: "Şu an diş ağrısı var mı?", type: "select", options: ["Yok", "Hafif", "Şiddetli"] },
      { id: "dis_gum", label: "Diş eti problemi (kanama/çekilme)?", type: "bool" },
      { id: "dis_img", label: "Panoramik röntgen / tomografi var mı?", type: "bool" },
      { id: "dis_diabetes", label: "Diyabet / kemik erimesi ilacı kullanımı?", type: "bool", help: "İmplant başarısını etkiler." },
      { id: "dis_goal", label: "Beklentiniz", type: "text", placeholder: "Ör. tüm ağız implant, gülüş estetiği" },
    ],
  },

  goz: {
    intro: "Göz değerlendirmesi için görme şikâyetlerinizi alalım.",
    questions: [
      { id: "goz_proc", label: "İlgilenilen işlem", type: "multi", options: ["Lazer (LASIK/SMILE)", "Katarakt", "Akıllı lens", "Retina", "Şaşılık", "Keratokonus", "Göz tansiyonu (glokom)"], recommended: true },
      { id: "goz_symp", label: "Şikâyet(ler)", type: "multi", options: ["Bulanık görme", "Uzağı görememe", "Yakını görememe", "Çift görme", "Ağrı / kızarıklık", "Işık çakması / uçuşma"] },
      { id: "goz_suddenloss", label: "Ani görme kaybı yaşandı mı?", type: "bool", help: "Acil değerlendirme gerektirebilir." },
      { id: "goz_number", label: "Gözlük numarası biliniyor mu?", type: "text", placeholder: "Ör. -3.5 miyop / bilmiyorum" },
      { id: "goz_wear", label: "Gözlük / lens kullanımı", type: "select", options: ["Gözlük", "Lens", "İkisi", "Hiçbiri"] },
      { id: "goz_prior", label: "Daha önce göz ameliyatı?", type: "bool" },
      { id: "goz_diabetes", label: "Şeker hastalığı var mı?", type: "bool", help: "Retina sağlığını etkiler." },
    ],
  },

  "genel-cerrahi": {
    intro: "Genel cerrahi değerlendirmesi için şikâyet ve geçmişinizi alalım.",
    questions: [
      { id: "gen_area", label: "İlgili alan", type: "multi", options: ["Fıtık (kasık/göbek)", "Safra kesesi", "Tiroid", "Bağırsak / kolon", "Hemoroid", "Reflü", "Obezite cerrahisi", "Diğer"], recommended: true },
      { id: "gen_complaint", label: "Ana şikâyet", type: "text", placeholder: "Şikâyetinizi kısaca yazın" },
      { id: "gen_acutepain", label: "Şu an şiddetli karın ağrısı var mı?", type: "bool", help: "Acil durum işareti olabilir." },
      { id: "gen_feverv", label: "Ateş / kusma", type: "multi", options: ["Yok", "Ateş", "Kusma"] },
      { id: "gen_img", label: "Yapılmış görüntüleme", type: "multi", options: ["Ultrason", "BT", "MR", "Endoskopi / kolonoskopi", "Yok"] },
      { id: "gen_prior", label: "Daha önce karın ameliyatı?", type: "bool" },
      { id: "gen_bmi", label: "Boy / kilo (obezite cerrahisi için)", type: "text", placeholder: "Ör. 170 cm / 110 kg" },
    ],
  },

  dahiliye: {
    intro: "Dahiliye değerlendirmesi için genel sağlık şikâyetlerinizi alalım.",
    questions: [
      { id: "dah_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Halsizlik", "Tahlil değer yüksekliği", "Mide / bağırsak", "Şeker (diyabet)", "Tansiyon", "Tiroid", "Karaciğer / böbrek", "Kilo değişimi"], recommended: true },
      { id: "dah_duration", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
      { id: "dah_fever", label: "Ateş var mı?", type: "select", options: ["Yok", "Hafif", "Yüksek (38.5°C+)"] },
      { id: "dah_weight", label: "İstemsiz kilo kaybı / iştahsızlık?", type: "bool" },
      { id: "dah_labs", label: "Son kan tahlili var mı?", type: "bool" },
      { id: "dah_family", label: "Ailede önemli hastalık öyküsü", type: "text", placeholder: "Ör. diyabet, kalp, kanser / yok" },
    ],
  },
};

// Branş anahtarına göre tam soru listesi (branşa özel + ortak). Bilinmeyen branşta yalnız ortak sorular.
export function questionsForBranch(branchKey: string): { intro: string; questions: TQuestion[] } {
  const set = BRANCH_QUESTIONS[branchKey];
  return {
    intro: set?.intro ?? "Doğru yönlendirme için birkaç ön-değerlendirme sorusu.",
    questions: [...(set?.questions ?? []), ...COMMON_QUESTIONS],
  };
}
