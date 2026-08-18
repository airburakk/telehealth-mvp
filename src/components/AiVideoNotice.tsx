import type { Lang } from "@/lib/aura-landing/copy";

// "YZ kullanılarak üretilmiştir" — YAPAY ZEKA İLE ÜRETİLMİŞ videoların şeffaflık
// ibaresi (kullanıcı kararı 2026-08-18). Görünür olmak ZORUNDA; dekoratif değil, beyandır.
// Kısaltma kararı (2026-08-18): TR "Yapay zeka"→"YZ", EN "artificial intelligence"→"AI"
// (kullanıcı isteği — ibare kadraj köşesinde kısa dursun). Diğer 7 dil açık yazımda kaldı;
// onları da kısaltmak ayrı kullanıcı kararı.
//
// 🔴 NEREYE KONMAZ (yanlış beyan olur — geri ekleme):
//   • Canlı WebRTC akışları: ConsultVideoRoom · SoVideoRoom · ConsultationRoom ·
//     PreConsultLobby kamera önizlemesi. Bunlar hastanın/doktorun GERÇEK kamerasıdır.
//   • DoctorPreferences'taki tanıtım videosu — doktorun KENDİ yüklediği çekim.
//
// ✅ Nereye konur: AI ile üretilmiş tanıtım/vitrin videoları (hero, giriş kapısı arka planı,
// how-it-works anlatımları, entry-paths kartları) ve DoctorVideoCard "kartvizit" avatarı.
// Sonuncusu en kritik yer: video doktorun adından cinsiyet tahmin edilerek seçiliyor ve o
// doktorun adıyla altyazılanıyor — hasta gerçek doktoru sandığı bir avatar izliyor.
//
// ⚠️ Uygulamanın başka yerlerinde açık yazım ("yapay zekâ", şapkalı) geçiyor
// (doktor/doctorium/[id] AI özet uyarısı, onam metni) — onlara DOKUNULMADI; bu ibarenin
// yazımı (önce şapkasız "zeka", 2026-08-18'den beri "YZ") ayrıca kararlaştırıldı.
const NOTICE: Record<Lang, string> = {
  tr: "YZ kullanılarak üretilmiştir",
  en: "Created using AI",
  de: "Mit künstlicher Intelligenz erstellt",
  fr: "Créé à l'aide de l'intelligence artificielle",
  ru: "Создано с использованием искусственного интеллекта",
  ar: "أُنشئ باستخدام الذكاء الاصطناعي",
  fa: "با استفاده از هوش مصنوعی ساخته شده است",
  az: "Süni intellektdən istifadə edilərək hazırlanmışdır",
  bg: "Създадено с помощта на изкуствен интелект",
};

// Uygulama yüzeyinin dil ADI ("Türkçe", "Arapça" …) → vitrin dil kodu. Uygulama tarafı
// (DoctorVideoCard, /doktorlar/[id]) çeviriyi lib/i18n.ts hattından alır ama bu ibare sabit
// bir beyan — çeviri kuyruğuna bırakılmaz, burada hazır durur.
const LANG_NAME_TO_CODE: Record<string, Lang> = {
  "Türkçe": "tr",
  "İngilizce": "en",
  "Almanca": "de",
  "Fransızca": "fr",
  "Rusça": "ru",
  "Arapça": "ar",
  "Farsça": "fa",
  "Azerice": "az",
  "Bulgarca": "bg",
};

export function aiNoticeText(lang?: Lang | string | null): string {
  if (!lang) return NOTICE.tr;
  if (lang in NOTICE) return NOTICE[lang as Lang];
  const code = LANG_NAME_TO_CODE[lang];
  return code ? NOTICE[code] : NOTICE.tr; // Kazakça/Kırgızca gibi karşılığı olmayan dillerde TR
}

// Alt satır varyantı — videonun HEMEN ALTINDA. Gömülü/kart videolarında kullanılır
// (kartvizit, how-it-works): orada videonun bir "altı" vardır.
//
// tone: iki yüzeyin token setleri AYRI — uygulama `--c-*`, vitrin `--aura-*`. Tek bir
// varsayılan renk verip className ile ezmek Tailwind'de iki text-color sınıfının sırasına
// bağlı kalırdı (kırılgan); ton açıkça seçilir.
export function AiVideoNotice({
  lang,
  tone = "app",
  className = "",
}: {
  lang?: Lang | string | null;
  tone?: "app" | "aura";
  className?: string;
}) {
  const color = tone === "aura" ? "text-[var(--aura-micro)]" : "text-[var(--c-ink-3)]";
  return (
    <p className={`mt-1.5 text-[11px] leading-snug ${color} ${className}`}>
      {aiNoticeText(lang)}
    </p>
  );
}

// Köşe etiketi varyantı — tam ekran ARKA PLAN videolarında (hero, giriş kapısı). Orada
// videonun "altı" diye bir yer yok; görünür kalan tek konum kadrajın sağ-alt köşesi.
// Konumlandırma çağırana ait değil: bileşen absolute'tur, video kabı `relative` olmalı.
// pointer-events-none — altındaki CTA/tıklama alanlarını yutmaz.
//
// max-w-[70%] + leading-tight: Rusça/Bulgarca karşılıklar TR'nin ~1.5 katı ("Создано с
// использованием искусственного интеллекта") — dar ekranda kadrajı yarmasın diye
// sarmalanmaya izin verilir ama genişlik sınırlanır; sarmaladığında satırlar binmesin.
export function AiVideoNoticeBadge({
  lang,
  className = "",
}: {
  lang?: Lang | string | null;
  className?: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute bottom-3 right-3 z-10 max-w-[70%] rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium leading-tight text-white/90 backdrop-blur-sm sm:text-[11px] ${className}`}
    >
      {aiNoticeText(lang)}
    </span>
  );
}
