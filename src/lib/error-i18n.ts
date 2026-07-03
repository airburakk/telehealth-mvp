// Hata sınırı (error boundary / 404) sözlüğü — statik gömülü çok-dilli metinler.
// ÖNEMLİ: Bu metinler bilinçli olarak dosyaya gömülüdür; çeviri zinciri / DB / API
// KULLANILMAZ (hata anında ağ ve veritabanı güvenilmezdir). Hasta dillerinin tamamını
// kapsar: TR · EN · RU · AR · FA · DE · FR · AZ · KK · KY (bkz. lib/constants LANGUAGES).
// Bu modül düz-veri modülüdür ("use client" YOK) — hem client boundary'ler import eder
// hem de server tarafında güvenle kullanılabilir (RSC client-reference tuzağına düşmez).

export interface ErrorTexts {
  notFoundTitle: string;
  notFoundDesc: string;
  errorTitle: string;
  errorDesc: string;
  retry: string;
  home: string;
  reference: string;
}

export const ERROR_I18N: Record<string, ErrorTexts> = {
  tr: {
    notFoundTitle: "Sayfa bulunamadı",
    notFoundDesc: "Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.",
    errorTitle: "Bir şeyler ters gitti",
    errorDesc: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
    retry: "Tekrar dene",
    home: "Ana sayfaya dön",
    reference: "Referans",
  },
  en: {
    notFoundTitle: "Page not found",
    notFoundDesc: "The page you are looking for may have been moved or never existed.",
    errorTitle: "Something went wrong",
    errorDesc: "An unexpected error occurred. Please try again.",
    retry: "Try again",
    home: "Back to home",
    reference: "Reference",
  },
  ru: {
    notFoundTitle: "Страница не найдена",
    notFoundDesc: "Возможно, страница была перемещена или никогда не существовала.",
    errorTitle: "Что-то пошло не так",
    errorDesc: "Произошла непредвиденная ошибка. Пожалуйста, попробуйте ещё раз.",
    retry: "Повторить",
    home: "На главную",
    reference: "Код ошибки",
  },
  ar: {
    notFoundTitle: "الصفحة غير موجودة",
    notFoundDesc: "ربما تم نقل الصفحة التي تبحث عنها أو أنها لم تكن موجودة أصلاً.",
    errorTitle: "حدث خطأ ما",
    errorDesc: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
    home: "العودة إلى الصفحة الرئيسية",
    reference: "الرمز المرجعي",
  },
  fa: {
    notFoundTitle: "صفحه پیدا نشد",
    notFoundDesc: "صفحه‌ای که به دنبال آن هستید شاید جابه‌جا شده یا هرگز وجود نداشته است.",
    errorTitle: "مشکلی پیش آمد",
    errorDesc: "خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.",
    retry: "تلاش دوباره",
    home: "بازگشت به صفحه اصلی",
    reference: "کد پیگیری",
  },
  de: {
    notFoundTitle: "Seite nicht gefunden",
    notFoundDesc: "Die gesuchte Seite wurde möglicherweise verschoben oder existiert nicht.",
    errorTitle: "Etwas ist schiefgelaufen",
    errorDesc: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
    home: "Zur Startseite",
    reference: "Referenz",
  },
  fr: {
    notFoundTitle: "Page introuvable",
    notFoundDesc: "La page que vous recherchez a peut-être été déplacée ou n'existe pas.",
    errorTitle: "Une erreur est survenue",
    errorDesc: "Une erreur inattendue s'est produite. Veuillez réessayer.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
    reference: "Référence",
  },
  az: {
    notFoundTitle: "Səhifə tapılmadı",
    notFoundDesc: "Axtardığınız səhifə köçürülmüş və ya heç mövcud olmamış ola bilər.",
    errorTitle: "Nəsə səhv getdi",
    errorDesc: "Gözlənilməz xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.",
    retry: "Yenidən cəhd et",
    home: "Ana səhifəyə qayıt",
    reference: "Xəta kodu",
  },
  kk: {
    notFoundTitle: "Бет табылмады",
    notFoundDesc: "Іздеген бетіңіз жылжытылған немесе мүлдем болмаған болуы мүмкін.",
    errorTitle: "Бірдеңе дұрыс болмады",
    errorDesc: "Күтпеген қате орын алды. Қайталап көріңіз.",
    retry: "Қайталап көру",
    home: "Басты бетке оралу",
    reference: "Қате коды",
  },
  ky: {
    notFoundTitle: "Барак табылган жок",
    notFoundDesc: "Сиз издеген барак жылдырылган же такыр болгон эмес болушу мүмкүн.",
    errorTitle: "Бир нерсе туура эмес болду",
    errorDesc: "Күтүлбөгөн ката кетти. Кайра аракет кылып көрүңүз.",
    retry: "Кайра аракет кылуу",
    home: "Башкы бетке кайтуу",
    reference: "Ката коду",
  },
};

// Sağdan-sola diller — lib/constants langDir ile aynı küme (Arapça, Farsça),
// yalnız burada dil adı yerine ISO primary-subtag kullanılır.
const RTL_CODES = new Set(["ar", "fa"]);

/** Sözlük dil kodu → yazı yönü. */
export function errDir(code: string): "rtl" | "ltr" {
  return RTL_CODES.has(code) ? "rtl" : "ltr";
}

/**
 * Tarayıcı dil tercihlerinden sözlük dilini seçer: navigator.languages sırasıyla
 * gezilir, her girdinin primary subtag'i ("en-GB" → "en") sözlükte aranır;
 * hiçbiri eşleşmezse TR'ye düşülür. SSR'da (navigator yok) çağırma — client'ta
 * useEffect içinde kullan (hydration uyuşmazlığını önlemek için).
 */
export function pickLang(nav?: { languages?: readonly string[]; language?: string }): string {
  const prefs = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  for (const pref of prefs) {
    const primary = pref.toLowerCase().split("-")[0];
    if (primary in ERROR_I18N) return primary;
  }
  return "tr";
}
