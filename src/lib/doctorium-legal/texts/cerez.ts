// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/doctorium-hukuki-belgeler/03-cerez-politikasi.md (Sürüm 1.0 · 03.09.2026, 👤 nihai).
// Elle düzenleme: kaynak .md → vault; buradaki metin yayın kesitidir (iç notlar/karar bölümleri yok).
// Kimlik alanları (unvan/adres/MERSİS/KEP/VERBİS) tüzel kişilik kurulunca doldurulur (Kılavuz §8).
export const CEREZ_MD = `## 1. Çerez nedir

Çerez, bir web sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük metin dosyasıdır.
Oturumunuzun sürdürülmesi veya tercihlerinizin hatırlanması gibi işlevleri sağlar.

---

## 2. Doctorium'da kullanılan çerezler

| Çerez adı | Türü | Amacı | Süre | Nitelik |
|---|---|---|---|---|
| \`session\` | Zorunlu / oturum | Giriş yapmış üyenin oturumunu sürdürmek; her istekte kimliğin doğrulanması | 7 gün | \`HttpOnly\` (JavaScript erişemez), üretimde \`Secure\` (yalnız HTTPS), \`SameSite=Lax\` |
| \`theme\` | İşlevsel | Açık/koyu görünüm tercihinizi hatırlamak | Tarayıcıda tercih değiştirilene kadar | Yalnız "light"/"dark" değeri taşır; kişisel veri içermez |

**Bu ikisi dışında çerez kullanılmamaktadır.** Reklam, profilleme, yeniden hedefleme veya
üçüncü taraf ölçümleme çerezi bulunmamaktadır.

---

## 3. Hukuki dayanak ve rıza

**3.1.** \`session\` çerezi, talep ettiğiniz hizmetin (üyelik girişi) sunulabilmesi için
**kesinlikle gereklidir**; bu nitelikteki çerezler için önceden rıza aranmaz.

**3.2.** \`theme\` çerezi yalnız görünüm tercihinizi saklar, kişisel veri içermez ve
tarafınızca doğrudan tetiklenir.

**3.3.** Bu nedenle Doctorium'da **çerez rıza penceresi (banner) sunulmamaktadır.** Bu, bir
eksiklik değil, kullanılan çerez kümesinin niteliğinin sonucudur.

---

## 4. Çerez kullanmayan ölçümümüz

Doctorium'un tanıtım sayfasında hangi bölümlerin ilgi gördüğünü anlamak için basit bir sayaç
tutulmaktadır. Bu ölçüm:

- **çerez kullanmaz,**
- ziyaretçiye kimlik veya tanımlayıcı **atamaz,**
- IP adresi, gezinme geçmişi, sayfa adresi veya arama sorgusu **kaydetmez.**

Kaydedilen tek şey, olayın **adı**, **konumu** ve **günü** ile o gün için toplam sayıdır
(örnek: *"kayıt düğmesi — üst bant — 02.09.2026 — 14 tıklama"*). Bu kayıtlar **kişisel veri
niteliği taşımaz**; bir kişiye ulaşmak teknik olarak mümkün değildir.

---

## 5. Tarayıcı ayarları

Çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz. \`session\` çerezini
engellemeniz hâlinde **platforma giriş yapamazsınız**; bu, çerezin işlevinin doğal sonucudur.

---

## 6. Benzer teknolojiler (yerel depolama)

Doctorium yüzeyleri tarayıcınızın yerel depolama alanına (localStorage/sessionStorage) **veri
yazmaz.** Platformun ortak üst çubuğu, aynı altyapıyı paylaşan telesağlık vitrininde daha önce
seçilmiş bir arayüz dili tercihi varsa (\`air_lang\` anahtarı) bunu **okuyabilir**; bu değer yalnız
arayüz dilini belirler, kişisel veri içermez ve Doctorium tarafından oluşturulmaz.

---

## 7. Değişiklikler

Yeni bir çerez veya benzeri teknoloji eklendiğinde bu politika güncellenir; **rıza gerektiren
bir çerez eklenmesi hâlinde**, çerez yerleştirilmeden önce rızanız alınır.

---

## 8. İletişim

Çerez kullanımına ilişkin sorularınız için: **bilgi@doctorium.tr**
→ [İlgili Kişi Başvuru Usulü](/doctorium/kvkk-basvuru)
`;
