// Anket katılım koşulları — kısa yayın metni (v6.210 · 2026-09-03; kaynak: vault
// output/doctorium-hukuki-belgeler/12-anket-katilim-kosullari.md §1 + §3, 👤 nihai).
//
// Nerede: doktor akışındaki anket kartının "Katılım koşulları" açılır bölümü (SurveyCard). Katılım
// bedeli (honorarium) ödenen anket bugün YAYINA ALINAMAZ (lib/survey canActivateSurvey kilidi —
// madde 4 mali müşavir görüşünü bekler); o yüzden buradaki metin bedel/vergi kurgusu anlatmaz, yalnız
// kilidin dürüst karşılığını söyler. Kilit açılırken 12 §1 madde 4 buraya eklenir.
//
// ⚠️ Saf sabit modül (client bileşen import eder) — db/auth yok.
export const SURVEY_TERMS_ITEMS: readonly string[] = [
  "Anketlere katılım tamamen gönüllüdür; katılmamak Doctorium kullanımınızı etkilemez.",
  "Her ankette türü belirtilir: topluluk anketi (ücretsiz; yanıt sonrası toplu sonucu görürsünüz) veya sponsorlu araştırma anketi (sponsorun kimliği davette açıkça yazılır).",
  "Yanıtınız, aynı ankete tekrar katılımın engellenmesi ve — katılım bedeli ödenen anketlerde — hakedişinizin ispatı için üyeliğinizle ilişkili olarak kaydedilir; bu nedenle yanıtlarınız platform nezdinde anonim değildir. Sponsora ve üçüncü kişilere yalnız toplulaştırılmış, kimliksiz istatistik iletilir.",
  "Gönderdiğiniz yanıt geri alınamaz; anket kapandığında toplu sonuca dâhil edilmiş olur.",
  "Topluluk anketleri puan kazandırabilir. Katılım bedeli ödenen sponsorlu anketlerde ayrıca puan verilmez; aynı katılım için iki menfaat birden doğmaz.",
  "Kamu kurumunda görevliyseniz, katılım ve ödeme kabulünün tabi olduğunuz mevzuata uygunluğunu değerlendirmek sizin sorumluluğunuzdadır.",
  "Sponsorun ruhsat/başvuru sahibi olması hâlinde, sağlık meslek mensubuna yapılan ödemeler mevzuat gereği değer aktarımı olarak bildirilebilir; bu bildirime esas yazılı onayınız katılımdan önce ayrıca alınır.",
  "Anket veya katılımınıza ilişkin itirazlarınızı bilgi@doctorium.tr adresine iletebilirsiniz; başvurunuz 15 iş günü içinde sonuçlandırılır.",
];
