// Mesleki kimlik (diploma) doğrulama beyanı — 6 madde (v6.211 · 2026-09-03; kaynak vault
// output/doctorium-hukuki-belgeler/11-kimlik-diploma-dogrulama-aydinlatmasi.md §B, 👤 03.09.2026 kabul).
//
// Nerede: diploma yükleme kartı (DoctorDocuments, yalnız DIPLOMA) — kutu işaretlenmeden dosya seçilemez;
// sunucu (api/doctor/documents) beyansız yüklemeyi 400 ile reddeder ve kabul edilen beyanı belge
// işlenmeden ÖNCE ConsentRecord'a yazar (scope DOCTORIUM_DIPLOMA_BEYAN, her yükleme ayrı satır).
// Ekranda gösterilen metin = hash'lenen metin (DIPLOMA_BEYAN_TEXT tek kaynak).
//
// ⚠️ Saf sabit modül (client bileşen import eder) — db/auth yok.
export const DIPLOMA_BEYAN_ITEMS: readonly string[] = [
  "Yüklediğim belgenin bana ait, gerçek ve geçerli olduğunu beyan ederim.",
  "Bu belgeyi üyeliğimin açılabilmesi için Doctorium'a ibraz ettiğimi; belgemin, ilgili kamu kurumunun kamuya açık doğrulama hizmeti üzerinden yalnız benim belgem için sorgulanmasına muvafakat ettiğimi kabul ederim.",
  "T.C. kimlik numaramın doğrulama sırasında yalnız sorgu amacıyla kullanılacağını ve kaydedilmeyeceğini biliyorum.",
  "Doğrulama geçerse yüklediğim dosyanın saklanmayacağını; yalnız doğrulama kararının ve şifreli barkod numarasının kaydedileceğini biliyorum.",
  "Doğrulama geçmezse dosyamın insan incelemesi için geçici olarak saklanacağını ve karar sonrasında imha edileceğini biliyorum.",
  "Gerçeğe aykırı beyan veya sahte belge sunmanın üyeliğimin sona erdirilmesi sebebi olduğunu ve hukuki sorumluluk doğurabileceğini biliyorum.",
];

/** ConsentRecord'a hash'lenen kanonik metin — ekrandaki maddelerle birebir aynı kaynak. */
export const DIPLOMA_BEYAN_TEXT =
  "Mesleki kimlik doğrulama beyanı (Doctorium, Sürüm 1.0 · 03.09.2026)\n" +
  DIPLOMA_BEYAN_ITEMS.map((t, i) => `${i + 1}. ${t}`).join("\n");
