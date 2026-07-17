// TourismInbox (sağlık turizmi bekleme/gelen kutusu) statik metinleri — AYRI modülde çünkü hem
// istemci bileşen (TourismInbox) hem SUNUCU sayfası (vaka/[caseId] — getTranslations toplu
// çevirisi) kullanır. "use client" modülünden veri export'u server component'te client-reference
// olur ([[rsc-client-module-data-export]]) → sabitler burada, lib'de yaşar.
//
// NEDEN sunucu çevirisi (2026-07-17, Ray sonrası tur): hasta-yüzü metinler v6.20'ye kadar TR-sabit
// kalıyordu (MVP notu, TourismInbox.tsx başlığı). Aynı sayfadaki ConsultGate deseniyle hizalandı:
// TEXTS listesi + tmap prop → ilk boyama hasta dilinde, useT'nin asenkron gecikmesi yok.
//
// Şablon değişkenleri: {branch} (branş etiketi, sayfada zaten t(branchLabel) ile çevrili geliyor),
// {country} (ülke etiketi, page.tsx'ten geldiği haliyle). AI çevirisinde placeholder aynen korunur;
// istemcide .replace ile doldurulur.
export const TOURISM_INBOX_TEXTS = [
  "Talebiniz {branch} doktorlarına iletildi",
  "{country} için {branch} branşındaki doktorlar talebinizi inceliyor. Size tanıtım mesajı gönderip video görüşme randevusu önerecekler. Gelen tekliflerden birini kabul ettiğinizde görüşme planlanır.",
  "Video görüşme teklifini kabul ettiniz. Randevu saatinde bu sayfadan görüşmeye katılabilirsiniz.",
  "Henüz doktor mesajı yok — talebiniz doktorlar tarafından inceleniyor.",
  "Kabul edildi",
  "Reddedildi",
  "Video görüşme önerisi",
  "Kabul et",
  "Reddet",
  "Bir hata oluştu.",
  "İşlem başarısız.",
];
