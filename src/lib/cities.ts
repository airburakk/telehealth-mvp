// Kayıt formlarındaki ŞEHİR alanının kapalı listesi (2026-08-30).
//
// Neden kapalı liste: şehir üç kayıt yolunda da serbest metindi ve kaynak kirleniyordu —
// dev verisinde "İstanbul"/"Istanbul", "İzmir"/"Izmir"/"izmir" ayrı satırlardı. /admin/uyeler
// panosu sayarken harf katlamasıyla birleştiriyor (oradaki FOLD notu) ama panonun kendi
// yorumunun dediği gibi "veriyi düzeltmek kayıt formunun işi, panonun değil". Bu liste o
// düzeltmedir: formlar <select> ile yalnız buradaki kanonik yazımları gönderir, sunucu uçları
// da isAllowedCity ile doğrular (curl ile serbest metin yazılamasın). Mevcut ESKİ kayıtlara
// dokunulmaz — yalnız yeni yazımlar daralır; pano katlaması eski veri için gerekli kalır.
//
// Kapsam neden 81 il'den geniş: öğrenci formundaki alan ÜNİVERSİTE ŞEHRİdir ve
// lib/universities.ts rosterinde KKTC + yurt dışı (AZ/KG/MK) kampüsler vardır; doktor da
// KKTC'de veya yurt dışında çalışıyor olabilir. Salt-81 liste bu kayıtları bloke ederdi →
// KKTC ilçeleri ayrı grup + tek "Yurt dışı" seçeneği (ülke kırılımı gerekirse o ayrı bir
// alan işidir — şehir alanına ülke/serbest metin yazdırılmaz).
//
// Yazım kuralları: resmî il adları, Türk alfabesi sırasında STATİK dizi (çalışma zamanında
// sıralanmaz — localeCompare ortamın ICU verisine bağlıdır); "Hakkari" bilinçli şapkasız
// (TÜİK/NVİ yüzeylerindeki ve klavyeden girilen yaygın yazım).

export const TR_PROVINCES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya",
  "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik",
  "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
  "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep",
  "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir",
  "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale",
  "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa",
  "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize",
  "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
] as const;

// KKTC ilçe merkezleri — kapalı küme (6 ilçe), rosterdeki KKTC üniversite şehirlerini
// tamamen kapsar (üniversite-başına şehir verisi tutulmaz; beyan burada da geçerli).
export const KKTC_CITIES = ["Gazimağusa", "Girne", "Güzelyurt", "İskele", "Lefke", "Lefkoşa"] as const;

// Tek kaçış seçeneği: yurt dışında çalışan doktor / yurt dışı kampüs öğrencisi (AZ/KG/MK).
export const CITY_ABROAD = "Yurt dışı";

const ALLOWED = new Set<string>([...TR_PROVINCES, ...KKTC_CITIES, CITY_ABROAD]);

/**
 * Sunucu doğrulaması: değer kapalı listedeki KANONİK yazımlardan biri mi?
 * Bilinçli olarak harf katlaması YAPMAZ — "istanbul"/"Istanbul" kabul edilseydi
 * kaynak kirliliği (bu listenin var olma sebebi) aynen sürerdi.
 */
export function isAllowedCity(v: string): boolean {
  return ALLOWED.has(v);
}
