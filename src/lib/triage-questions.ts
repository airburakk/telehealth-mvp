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

  noroloji: {
    intro: "Nörolojik değerlendirme için sinir sistemi belirtilerinizi alalım.",
    questions: [
      { id: "nrl_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Baş ağrısı / migren", "Baş dönmesi", "Uyuşma / karıncalanma", "Güçsüzlük", "Nöbet / havale", "Unutkanlık", "Titreme", "Denge bozukluğu"], recommended: true },
      { id: "nrl_onset", label: "Şikâyet nasıl başladı?", type: "select", options: ["Ani (saatler içinde)", "Günler içinde", "Haftalar içinde", "Aylar / yıllar"], help: "Ani başlangıç acil değerlendirme gerektirir." },
      { id: "nrl_stroke", label: "Konuşmada bozulma / yüzde kayma / ani güç kaybı oldu mu?", type: "bool", help: "İnme belirtisi olabilir." },
      { id: "nrl_seizure", label: "Bilinç kaybı veya nöbet geçirdiniz mi?", type: "bool" },
      { id: "nrl_dx", label: "Bilinen nörolojik tanı", type: "text", placeholder: "Ör. migren, MS, epilepsi / yok" },
      { id: "nrl_img", label: "Yapılmış tetkik", type: "multi", options: ["Beyin MR", "BT", "EEG", "EMG", "Yok"] },
      { id: "nrl_dur", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
    ],
  },

  gastroenteroloji: {
    intro: "Sindirim sistemi değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "gas_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Karın ağrısı", "Reflü / mide yanması", "Şişkinlik / gaz", "İshal", "Kabızlık", "Bulantı / kusma", "Yutma güçlüğü", "Dışkıda kan"], recommended: true },
      { id: "gas_blood", label: "Dışkıda veya kusmukta kan gördünüz mü?", type: "bool", help: "Öncelikli değerlendirme gerektirir." },
      { id: "gas_weight", label: "İstemsiz kilo kaybı var mı?", type: "bool" },
      { id: "gas_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Reflü", "Gastrit / ülser", "Kolit", "Karaciğer hastalığı", "Safra kesesi"] },
      { id: "gas_scope", label: "Endoskopi / kolonoskopi yapıldı mı?", type: "multi", options: ["Endoskopi", "Kolonoskopi", "Yok"] },
      { id: "gas_dur", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
    ],
  },

  endokrinoloji: {
    intro: "Hormon ve metabolizma değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "end_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Tiroid / guatr", "Diyabet / şeker", "Kilo değişimi", "Hormonal bozukluk", "Kemik erimesi", "Aşırı tüylenme / akne", "Boy / gelişme"], recommended: true },
      { id: "end_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Hipotiroidi", "Hipertiroidi", "Diyabet", "PCOS", "Osteoporoz"] },
      { id: "end_labs", label: "Tiroid / şeker değerleri biliniyor mu?", type: "bool" },
      { id: "end_weight", label: "Son dönemde kilo değişimi", type: "select", options: ["Yok", "Kilo aldım", "Kilo verdim"] },
      { id: "end_dur", label: "Şikâyet süresi", type: "select", options: ["1 aydan az", "1-6 ay", "6 ay - 1 yıl", "1 yıldan fazla"] },
    ],
  },

  nefroloji: {
    intro: "Böbrek sağlığı değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "nef_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Böbrek değer yüksekliği", "İdrarda protein / kan", "Yüksek tansiyon", "Ödem / şişlik", "Böbrek taşı", "Diyaliz"], recommended: true },
      { id: "nef_dx", label: "Bilinen böbrek hastalığı", type: "select", options: ["Yok", "Kronik böbrek yetmezliği", "Tek böbrek", "Polikistik böbrek", "Bilmiyorum"] },
      { id: "nef_dialysis", label: "Diyalize giriyor musunuz?", type: "bool" },
      { id: "nef_gfr", label: "Kreatinin / GFR değeri biliniyor mu?", type: "bool" },
      { id: "nef_bp", label: "Tansiyon kontrol altında mı?", type: "select", options: ["Evet", "Hayır", "Bilmiyorum"] },
      { id: "nef_tx", label: "Böbrek nakli düşünülüyor mu?", type: "bool" },
    ],
  },

  "gogus-hastaliklari": {
    intro: "Solunum sistemi değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "ghs_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Nefes darlığı", "Öksürük", "Balgam", "Hırıltılı solunum", "Kanlı balgam", "Horlama / uyku apnesi", "Göğüste sıkışma"], recommended: true },
      { id: "ghs_blood", label: "Kanlı balgam (hemoptizi) var mı?", type: "bool", help: "Öncelikli değerlendirme gerektirir." },
      { id: "ghs_smoke", label: "Sigara kullanımı", type: "select", options: ["Hayır", "Bıraktım", "Evet"] },
      { id: "ghs_breath", label: "Nefes darlığı düzeyi", type: "select", options: ["Yok", "Eforla", "Az eforla", "İstirahatte"] },
      { id: "ghs_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Astım", "KOAH", "Uyku apnesi", "Akciğer nodülü"] },
      { id: "ghs_tests", label: "Yapılmış tetkik", type: "multi", options: ["Akciğer röntgeni", "Akciğer BT", "Solunum fonksiyon testi", "Yok"] },
    ],
  },

  hematoloji: {
    intro: "Kan hastalıkları değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "hem_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Kansızlık / anemi", "Halsizlik", "Kolay morarma / kanama", "Lenf bezi şişmesi", "Pıhtılaşma sorunu", "Kan değeri bozukluğu"], recommended: true },
      { id: "hem_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Anemi", "Lösemi", "Lenfoma", "Pıhtılaşma bozukluğu", "Kemik iliği hastalığı"] },
      { id: "hem_labs", label: "Kan değerlerinde bozukluk biliniyor mu?", type: "bool" },
      { id: "hem_bleed", label: "Kolay morarma / kanama oluyor mu?", type: "bool" },
      { id: "hem_node", label: "Lenf bezi şişliği var mı?", type: "bool" },
    ],
  },

  romatoloji: {
    intro: "Romatolojik değerlendirme için eklem/kas şikâyetlerinizi alalım.",
    questions: [
      { id: "rom_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Eklem ağrısı / şişme", "Sabah tutukluğu", "Kas ağrısı", "Cilt döküntüsü", "Ağız / göz kuruluğu", "Bel tutulması"], recommended: true },
      { id: "rom_joints", label: "Etkilenen eklemler", type: "text", placeholder: "Ör. el bilekleri, dizler" },
      { id: "rom_stiff", label: "Sabah tutukluğu süresi", type: "select", options: ["Yok", "30 dakikadan az", "30 dakikadan fazla"] },
      { id: "rom_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Romatoid artrit", "Lupus", "Behçet", "Ankilozan spondilit", "Gut"] },
      { id: "rom_labs", label: "Romatolojik kan testi yapıldı mı?", type: "bool" },
    ],
  },

  enfeksiyon: {
    intro: "Enfeksiyon değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "enf_symp", label: "Ana şikâyet / başvuru", type: "multi", options: ["Uzun süren ateş", "Tekrarlayan enfeksiyon", "Hepatit", "HIV danışmanlığı", "Seyahat sonrası şikâyet", "Antibiyotik direnci"], recommended: true },
      { id: "enf_fever", label: "Ateş süresi", type: "select", options: ["Yok", "1 haftadan az", "1-4 hafta", "1 aydan fazla"] },
      { id: "enf_dx", label: "Bilinen enfeksiyon tanısı", type: "text", placeholder: "Ör. Hepatit B / yok" },
      { id: "enf_travel", label: "Son seyahat / temas öyküsü", type: "text", placeholder: "Ör. yurtdışı, hayvan teması / yok" },
      { id: "enf_tests", label: "İlgili test sonuçlarınız var mı?", type: "bool" },
    ],
  },

  dermatoloji: {
    intro: "Cilt değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "der_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Sivilce / akne", "Egzama / kaşıntı", "Sedef", "Ben / leke kontrolü", "Saç / tırnak", "Mantar", "Döküntü", "İyileşmeyen yara"], recommended: true },
      { id: "der_area", label: "Etkilenen bölge", type: "text", placeholder: "Ör. yüz, eller, sırt" },
      { id: "der_change", label: "Büyüyen / değişen ben veya yara var mı?", type: "bool", help: "Cilt kanseri taraması açısından önemli." },
      { id: "der_dur", label: "Ne zamandır var?", type: "select", options: ["1 aydan az", "1-6 ay", "6 ay - 1 yıl", "1 yıldan fazla"] },
      { id: "der_prior", label: "Daha önce kullanılan cilt tedavisi / ilacı", type: "text", placeholder: "Yok / krem-ilaç adı" },
      { id: "der_aesthetic", label: "İlgilenilen estetik dermatoloji", type: "multi", options: ["Yok", "Leke tedavisi", "Lazer", "Dolgu / botoks", "Akne izi", "Cilt gençleştirme"] },
    ],
  },

  psikiyatri: {
    intro: "Ruh sağlığı değerlendirmesi için durumunuzu alalım. Verdiğiniz bilgiler gizlidir.",
    questions: [
      { id: "psi_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Depresif duygudurum", "Kaygı / panik", "Uyku sorunu", "Dikkat / odaklanma", "Takıntı (obsesif)", "Duygudurum dalgalanması", "Bağımlılık"], recommended: true },
      { id: "psi_dur", label: "Şikâyet süresi", type: "select", options: ["1 aydan az", "1-6 ay", "6 ay - 1 yıl", "1 yıldan fazla"] },
      { id: "psi_impact", label: "Günlük yaşamınızı ne kadar etkiliyor?", type: "select", options: ["Hafif", "Orta", "Belirgin"] },
      { id: "psi_prior", label: "Daha önce psikiyatrik tedavi / ilaç aldınız mı?", type: "bool" },
      { id: "psi_risk", label: "Kendinize veya başkasına zarar verme düşünceniz var mı?", type: "select", options: ["Hayır", "Bazen aklıma geliyor", "Evet"], help: "Acil destek için önemlidir; gizli tutulur." },
      { id: "psi_goal", label: "Tıbbi tedavi mi, danışmanlık mı arıyorsunuz?", type: "select", options: ["Tıbbi tedavi", "Danışmanlık / terapi", "Belirsiz"] },
    ],
  },

  "fizik-tedavi": {
    intro: "Fizik tedavi değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "fzt_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Bel / boyun ağrısı", "Kas-eklem ağrısı", "Felç sonrası rehabilitasyon", "Spor yaralanması", "Hareket kısıtlılığı", "Ameliyatsız fıtık tedavisi"], recommended: true },
      { id: "fzt_area", label: "Etkilenen bölge", type: "text", placeholder: "Ör. bel, omuz, diz" },
      { id: "fzt_pain", label: "Ağrı şiddeti", type: "scale", help: "0 = ağrı yok, 10 = dayanılmaz" },
      { id: "fzt_dur", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
      { id: "fzt_prior", label: "Daha önce fizik tedavi aldınız mı?", type: "bool" },
      { id: "fzt_img", label: "Yapılmış görüntüleme", type: "multi", options: ["MR", "Röntgen", "BT", "Yok"] },
    ],
  },

  "cocuk-sagligi": {
    intro: "Çocuk sağlığı değerlendirmesi için bilgileri alalım. (Yaş alanına çocuğun yaşını yazın.)",
    questions: [
      { id: "coc_symp", label: "Ana şikâyet / başvuru", type: "multi", options: ["Ateş / enfeksiyon", "Büyüme-gelişme", "Beslenme", "Aşı", "Alerji", "Solunum (öksürük vb.)", "Sindirim", "Cilt"], recommended: true },
      { id: "coc_dur", label: "Şikâyet süresi", type: "select", options: ["1-2 gün", "Bir hafta", "Birkaç hafta", "Daha uzun"] },
      { id: "coc_vaccine", label: "Aşıları tam mı?", type: "select", options: ["Evet", "Hayır / eksik", "Bilmiyorum"] },
      { id: "coc_chronic", label: "Çocukta bilinen kronik hastalık", type: "text", placeholder: "Yok / hastalık adı" },
      { id: "coc_birth", label: "Doğum öyküsü (zamanında / erken)", type: "select", options: ["Zamanında", "Erken (prematüre)", "Belirtmek istemiyorum"] },
    ],
  },

  uroloji: {
    intro: "Üroloji değerlendirmesi için idrar/üreme sistemi şikâyetlerinizi alalım.",
    questions: [
      { id: "uro_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["İdrar yaparken zorluk / yanma", "Sık idrara çıkma", "İdrarda kan", "Böbrek / yan ağrısı", "Prostat", "Cinsel işlev", "İdrar kaçırma", "Kısırlık"], recommended: true },
      { id: "uro_blood", label: "İdrarda kan gördünüz mü?", type: "bool", help: "Öncelikli değerlendirme gerektirir." },
      { id: "uro_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Prostat büyümesi", "Böbrek taşı", "Mesane sorunu", "Prostat kanseri şüphesi"] },
      { id: "uro_psa", label: "PSA değeri biliniyor mu? (erkek)", type: "select", options: ["Evet, normal", "Evet, yüksek", "Bilmiyorum / kadın"] },
      { id: "uro_tests", label: "Yapılmış tetkik", type: "multi", options: ["Ultrason", "BT", "İdrar tahlili", "PSA", "Yok"] },
      { id: "uro_prior", label: "Daha önce ürolojik ameliyat?", type: "bool" },
    ],
  },

  kbb: {
    intro: "Kulak burun boğaz değerlendirmesi için şikâyetlerinizi alalım.",
    questions: [
      { id: "kbb_symp", label: "Ana şikâyet(ler)", type: "multi", options: ["Burun tıkanıklığı", "Geniz akıntısı", "İşitme kaybı", "Kulak ağrısı / çınlama", "Boğaz / bademcik", "Ses kısıklığı", "Baş dönmesi", "Horlama"], recommended: true },
      { id: "kbb_hearing", label: "İşitmede azalma var mı?", type: "select", options: ["Yok", "Tek kulakta", "Çift kulakta"] },
      { id: "kbb_proc", label: "İlgilenilen işlem", type: "multi", options: ["Burun estetiği / septum", "Geniz eti / bademcik", "Kulak tüpü / zar", "Sinüs", "Horlama / uyku", "Belirsiz"] },
      { id: "kbb_dur", label: "Şikâyet süresi", type: "select", options: ["1 haftadan az", "1-4 hafta", "1-6 ay", "6 aydan fazla"] },
      { id: "kbb_tests", label: "Yapılmış tetkik", type: "multi", options: ["Odyometri (işitme testi)", "Sinüs BT", "Endoskopi", "Yok"] },
      { id: "kbb_prior", label: "Geçirilmiş KBB ameliyatı?", type: "bool" },
    ],
  },

  "kadin-dogum": {
    intro: "Kadın hastalıkları ve doğum değerlendirmesi için bilgileri alalım.",
    questions: [
      { id: "kad_reason", label: "Başvuru nedeni", type: "multi", options: ["Gebelik takibi", "Adet düzensizliği", "Ağrı / kanama", "Miyom / kist", "Menopoz", "Kontrol / smear", "Kısırlık", "Jinekolojik ameliyat"], recommended: true },
      { id: "kad_preg", label: "Gebelik durumu / son adet", type: "text", placeholder: "Ör. gebe 12 hafta / son adet tarihi" },
      { id: "kad_history", label: "Doğum / düşük öyküsü", type: "text", placeholder: "Ör. 2 doğum, 1 düşük / yok" },
      { id: "kad_bleed", label: "Anormal kanama var mı?", type: "bool" },
      { id: "kad_dx", label: "Bilinen tanı", type: "multi", options: ["Yok", "Miyom", "Yumurtalık kisti", "Endometriozis", "PCOS", "Servikal sorun"] },
      { id: "kad_smear", label: "Son jinekolojik muayene / smear", type: "select", options: ["1 yıldan az", "1-3 yıl", "3 yıldan fazla", "Hiç"] },
    ],
  },

  kvc: {
    intro: "Kalp ve damar cerrahisi değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "kvc_cond", label: "İlgili durum", type: "multi", options: ["Koroner bypass", "Kalp kapağı", "Aort anevrizması", "Bacak damar tıkanıklığı", "Varis", "Doğumsal kalp"], recommended: true },
      { id: "kvc_dx", label: "Tanı kondu mu?", type: "select", options: ["Kesin tanı var", "Şüphe, tetkik sürüyor", "Hayır"] },
      { id: "kvc_angio", label: "Anjiyografi yapıldı mı?", type: "bool" },
      { id: "kvc_symp", label: "Şu anki şikâyet", type: "multi", options: ["Göğüs ağrısı", "Nefes darlığı", "Bacakta ağrı / yürüme zorluğu", "Çarpıntı", "Yok"] },
      { id: "kvc_prior", label: "Daha önce kalp / damar ameliyatı?", type: "bool" },
      { id: "kvc_tests", label: "Mevcut tetkikler", type: "multi", options: ["Eko", "Anjiyo", "BT anjiyo", "Yok"] },
    ],
  },

  "gogus-cerrahisi": {
    intro: "Göğüs cerrahisi değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "gcr_cond", label: "İlgili durum", type: "multi", options: ["Akciğer nodülü / kitle", "Akciğer kanseri", "Plevra sıvısı", "Pnömotoraks", "Göğüs duvarı", "Mediasten"], recommended: true },
      { id: "gcr_dx", label: "Tanı durumu", type: "select", options: ["Kesin tanı var", "Şüphe, tetkik sürüyor", "Hayır"] },
      { id: "gcr_biopsy", label: "Biyopsi yapıldı mı?", type: "bool" },
      { id: "gcr_symp", label: "Şikâyet", type: "multi", options: ["Öksürük", "Nefes darlığı", "Göğüs ağrısı", "Kanlı balgam", "Yok"] },
      { id: "gcr_img", label: "Görüntüleme", type: "multi", options: ["Akciğer BT", "PET", "Röntgen", "Yok"] },
    ],
  },

  "organ-nakli": {
    intro: "Organ nakli değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "onk_organ", label: "Hangi organ?", type: "select", options: ["Böbrek", "Karaciğer", "Kalp", "Akciğer", "Kornea", "Kemik iliği", "Diğer"], recommended: true },
      { id: "onk_stage", label: "Hangi aşamadasınız?", type: "select", options: ["Nakil değerlendirmesi", "Bekleme listesinde", "Vericisi hazır", "Nakil sonrası takip"], recommended: true },
      { id: "onk_donor", label: "Verici durumu", type: "select", options: ["Canlı verici (akraba) var", "Kadavra bekliyor", "Belirsiz"] },
      { id: "onk_func", label: "Mevcut organ fonksiyon durumu", type: "text", placeholder: "Ör. diyalizdeyim / kreatinin değeri / karaciğer değerleri" },
      { id: "onk_blood", label: "Kan grubu biliniyor mu?", type: "text", placeholder: "Ör. A Rh+ / bilmiyorum" },
      { id: "onk_reports", label: "Mevcut tıbbi belgeler", type: "multi", options: ["Organ fonksiyon testleri", "Görüntüleme", "Doku tiplemesi", "Yok"] },
    ],
  },

  "radyasyon-onkolojisi": {
    intro: "Radyoterapi (ışın tedavisi) değerlendirmesi için durumunuzu alalım.",
    questions: [
      { id: "rad_site", label: "Kanser tanısı / bölgesi", type: "text", placeholder: "Ör. meme, akciğer, prostat", recommended: true },
      { id: "rad_stage", label: "Patoloji / evre biliniyor mu?", type: "select", options: ["Evet, raporu var", "Hayır", "Bilmiyorum"] },
      { id: "rad_prior", label: "Daha önce radyoterapi aldınız mı?", type: "bool" },
      { id: "rad_concurrent", label: "Eşzamanlı / önceki tedaviler", type: "multi", options: ["Cerrahi", "Kemoterapi", "İmmünoterapi", "Yok"] },
      { id: "rad_reports", label: "Mevcut belgeler", type: "multi", options: ["Patoloji", "Görüntüleme (BT/MR/PET)", "Önceki RT planı", "Yok"] },
      { id: "rad_goal", label: "Beklentiniz", type: "select", options: ["İkinci görüş", "Tedavi planı", "Tedaviye devam"] },
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

// Bir branşın çevrilecek tüm arayüz metinleri (intro + etiket/yardım/placeholder/birim/seçenekler).
// Hasta arayüzü çok dilli: bu liste /api/i18n'e gönderilir; yanıtlar TR kanonik saklandığı için
// çeviri yalnız GÖRÜNTÜYÜ etkiler.
export function questionTexts(branchKey: string): string[] {
  const { intro, questions } = questionsForBranch(branchKey);
  const out: string[] = [intro, "Evet", "Hayır", "önerilen"];
  for (const q of questions) {
    out.push(q.label);
    if (q.help) out.push(q.help);
    if (q.placeholder) out.push(q.placeholder);
    if (q.unit) out.push(q.unit);
    for (const o of q.options ?? []) out.push(o);
  }
  return out;
}
