// ConsultGate (3-seçenek kapısı) statik metinleri — AYRI modülde çünkü hem istemci bileşen
// (ConsultGate) hem SUNUCU sayfası (vaka/[caseId] — getTranslations toplu çevirisi) kullanır.
// "use client" modülünden veri export'u server component'te client-reference olur
// ([[rsc-client-module-data-export]]) → sabitler burada, lib'de yaşar.
//
// NEDEN sunucu çevirisi (2026-07-17, kullanıcı bulgusu): kapı ekranı yalnız istemci useT ile
// çevriliyordu → ilk boyama TR kaynak metinde kalıyor, çeviri önbellekte yoksa saniyelerce
// (veya çağrı düşerse kalıcı) Türkçe görünüyordu. Sayfa artık bu listeyi sunucuda çevirip
// hazır haritayı prop geçirir → kapı İLK ANDAN hasta dilinde.
export const CONSULT_GATE_TEXTS = [
  "Şu an çevrimiçi branş doktoru yok",
  "Size en uygun yolu seçin — başvurunuz kaydedildi, hiçbir bilgi kaybolmaz.",
  "Nöbetçi doktorla şimdi görüşün",
  "7/24 görevli Dahiliye/Acil doktoru sizinle hemen bir video görüşmesi yapar.",
  "Şimdi görüş",
  "Şu an çevrimiçi nöbetçi doktor yok",
  "Branş doktorunuzle randevu alın",
  "İcap görevli branş uzmanlarına iletilir; en erken uygun doktor size bir görüşme zamanı önerir.",
  "Randevu iste",
  "Şu an icap görevli branş doktoru yok",
  "Süreci sonlandır",
  "Tüm verileriniz kalıcı olarak silinir ve ödemeniz iade edilir.",
  "Sonlandır ve sil",
  "Tüm vaka verileriniz kalıcı olarak silinecek ve ödemeniz iade edilecek. Emin misiniz?",
  "Vazgeç",
  "Randevu talebiniz iletildi",
  "İcap görevli branş doktorları bilgilendirildi. En erken uygun doktor bir görüşme zamanı önerecek — bu sayfayı açık tutabilirsiniz.",
  "Değişiklik talebiniz iletildi",
  "Doktor yeni bir görüşme zamanı önerecek.",
  "Video randevu teklifi",
  "Önerilen zaman",
  "Onayla",
  "Farklı zaman iste",
  "Randevunuz onaylandı",
  "Görüşmeye katıl",
  "Süreciniz sonlandırıldı",
  "Tüm verileriniz silindi ve ödemeniz iade edildi.",
  "Bakım Yolculuğuma dön",
  "Bir hata oluştu, lütfen tekrar deneyin.",
  "Bağlanıyor…",
  "İletiliyor…",
];
