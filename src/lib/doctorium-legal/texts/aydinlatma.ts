// ÜRETİLMİŞ YAYIN KESİTİ — kaynak: output/doctorium-hukuki-belgeler/01-kvkk-aydinlatma-metni.md (Sürüm 1.2 · 05.09.2026 — revizyon turu 2 [deneme erişimi], 👤 nihai).
// Elle düzenleme: kaynak .md → vault; buradaki metin yayın kesitidir (iç notlar/karar bölümleri yok).
// Kimlik alanları (unvan/adres/MERSİS/KEP/VERBİS) tüzel kişilik kurulunca doldurulur (Kılavuz §8).
export const AYDINLATMA_MD = `## 1. Veri Sorumlusu

| | |
|---|---|
| Unvan | **Doctorium platform işleticisi** *(tüzel kişilik kuruluşu tamamlandığında ticaret unvanı, adres, MERSİS/vergi numarası, KEP adresi ve VERBİS bilgisi bu bölüme eklenecektir)* |
| İletişim | **bilgi@doctorium.tr** |

---

## 2. Doctorium nedir, hangi ilişki kapsamında veri işlenir

Doctorium, **doğrulanmış doktorlara ve tıp öğrencilerine** açık, mesleki bir çalışma alanıdır.
Sunulan işlevler:

- mesleki bilgi akışı (haber, akademik yayın, mevzuat, içtihat, doktrin özetleri)
- ilaç prospektüsü araması
- kongre veritabanı, takvim ve sürekli tıp eğitimi (STE) etkinlikleri
- kariyer bölümü
- günlük özet bülteni ("Post")
- içerik kaydetme ve kişisel akış tercihleri
- sponsorlu içerik ve anketler
- puan ve ödül programı

> **Doctorium'da hasta verisi, vaka dosyası, klinik kayıt veya sağlık hizmeti sunumu
> BULUNMAZ.**

---

## 3. İşlenen kişisel veriler

### 3.1 Doktor üyeliğinde

| Kategori | Veriler |
|---|---|
| **Kayıt sırasında istenen** | Ad-soyad, ünvan, uzmanlık branşı, şehir, e-posta adresi ve **isteğe bağlı** cep telefonu numarası. Deneme Erişimi kaydında yalnız ad-soyad, uzmanlık branşı, şehir ve e-posta adresi istenir |
| **Hesap güvenliği** | Parolanız — **açık hâliyle saklanmaz**, yalnız geri döndürülemez özeti tutulur. Parolasız girişte e-posta adresinize gönderilen tek kullanımlık bağlantının özeti tutulur; 20 dakika geçerlidir, kullanıldığında silinir |
| **Doğrulama** | **Doğrulama başarılıysa yüklediğiniz belge saklanmaz** — dosya hiç depolanmaz, yerine imha kaydı yazılır. Saklanan yalnız doğrulama kararı, zamanı ve şifreli barkod numarasıdır. **T.C. kimlik numaranız** yalnız sorgu anında kullanılır, hiçbir yerde tutulmaz. Belge yalnız otomatik doğrulama sonuç vermediğinde, **insan incelemesi için geçici olarak** saklanır → ayrıntı: doğrulama ekranındaki aydınlatma metni |
| **Kullanım tercihleri** | Takip edilen branşlar, açık akış modülleri, görünüm tercihleri, kongre bildirim tercihleri (etkinlik türü, kapsam, hatırlatma günleri) |
| **Etkileşim** | Kaydedilen içerikler, anket yanıtları, puan hareketleri, ödül talepleri ve talep notları |
| **Onay kayıtları** | Verilen/geri alınan açık rızalar; her biri zaman damgalı ve metin özeti (hash) ile birlikte |
| **İşlem güvenliği** | Giriş kayıtları, IP adresi, tarayıcı/cihaz bilgisi, erişim ve işlem logları |

### 3.2 Tıp öğrencisi üyeliğinde (ek/farklı)

Üniversite adı, bölüm, **üniversiteye ait (.edu.tr) e-posta adresi** ve bu adresin tıklama ile
doğrulanmasına ilişkin kayıt. → ayrıntı: Tıp Öğrencisi Üyeliği Ek Metni (öğrenci kayıt akışında gösterilir)

### 3.3 İşlenmeyen veriler

- **Özel nitelikli kişisel veri işlenmez.** Üyeliğiniz kapsamında sağlık verinizi, biyometrik
  veya genetik verinizi, ceza mahkûmiyeti bilginizi, dernek/sendika/parti üyeliğinizi veya
  felsefi/dinî inancınızı toplamayız.
- **Hastalarınıza ait hiçbir veri Doctorium'da işlenmez.**
- **Meslek örgütü üyeliğiniz sorulmaz ve işlenmez.**

---

## 4. Kişisel verilerin işlenme amaçları

1. Üyelik kaydının oluşturulması ve yönetilmesi
2. **Mesleki kimliğin doğrulanması** — Doctorium yalnız doktorlara ve tıp öğrencilerine açıktır;
   doğrulama, platformun kapalı yapısının ve içerik güvenilirliğinin ön koşuludur
3. Bilgi akışının, kongre/etkinlik bilgilerinin ve arama işlevlerinin sunulması
4. Akışın **tercihlerinize göre düzenlenmesi** (takip ettiğiniz branşlar, açık modüller)
5. Günlük özet bülteninin iletilmesi *(yalnız açıkça abone olduysanız)*
6. Kongre/etkinlik hatırlatmalarının gönderilmesi *(yalnız seçtiğiniz eşiklerde)*
7. Anketlerin sunulması, mükerrer katılımın engellenmesi ve hakedişin ispatı
8. Puan ve ödül programının yürütülmesi
9. Sponsorlu içeriğin yayımlanması ve **toplulaştırılmış** ölçümü
10. *(yalnız açık rızanızla)* sponsorlu içeriğin mesleki profilinize göre kişiselleştirilmesi
11. *(yalnız açık rızanızla)* kariyer/insan kaynakları iletişimi
12. Bilgi güvenliğinin sağlanması, kötüye kullanımın önlenmesi, hukuki taleplere cevap verilmesi
    ve mevzuattan doğan yükümlülüklerin yerine getirilmesi

---

## 5. Hukuki sebepler (KVKK m.5)

| Amaç | Hukuki sebep |
|---|---|
| Üyelik, kimlik doğrulama, içerik sunumu, tercih yönetimi (1-4) | **m.5/2-c** — sözleşmenin kurulması ve ifası |
| Bülten ve etkinlik hatırlatması (5-6) | **m.5/2-c** *(abonelik talebiniz üzerine)* — ayrıca ticari elektronik ileti niteliği doğarsa 6563 kapsamında ayrı onay: bkz. madde 11 |
| Anket, puan/ödül (7-8) | **m.5/2-c** — katılım talebiniz üzerine kurulan ilişki |
| Sponsorlu içerik yayını ve toplulaştırılmış ölçüm (9) | **m.5/2-f** — meşru menfaat *(kimliğe bağlı gösterim kaydı tutulmaz)* |
| Kişiselleştirilmiş sponsorlu içerik (10) | **m.5/1 — açık rıza** |
| Kariyer/İK iletişimi (11) | **m.5/1 — açık rıza** |
| Güvenlik, hukuki yükümlülük, hak tesisi (12) | **m.5/2-ç ve m.5/2-e** |

> **Açık rızaya dayanan iki işleme (10 ve 11) hizmet şartı değildir.** Rıza vermemeniz veya
> geri almanız hâlinde Doctorium'u aynı kapsamda kullanmaya devam edersiniz; yalnız ilgili
> işlem durur.

---

## 6. Toplama yöntemi

Veriler; kayıt formu, profil düzenleme ekranları, tercih panelleri, e-Devlet doğrulama akışı,
üniversite e-postası doğrulaması, platform içi etkileşimleriniz (kaydetme, anket yanıtı, ödül
talebi) ve otomatik sistem kayıtları (giriş/erişim logları) yoluyla **elektronik ortamda**
toplanır. Google veya Apple hesabınızla giriş yapmayı seçerseniz, ilgili sağlayıcıdan yalnız
kimlik doğrulama için gereken asgari bilgi (kimlik tanımlayıcısı ve e-posta) alınır. Deneme Erişimi'nde
parola belirlenmez; giriş, e-posta adresinize gönderilen tek kullanımlık bağlantıyla yapılır.

---

## 7. Aktarım

### 7.1 Yurt içi / üçüncü kişilere aktarım

- **Reklamverenlere hiçbir kişisel veriniz aktarılmaz.** Reklamverene yalnız kampanya bazında
  **toplulaştırılmış, kimliksiz** görüntülenme ve tıklama sayıları raporlanır. Kişi bazlı
  gösterim kaydı tutulmaz.
- **Anket sponsorlarına** yanıtlar yalnız toplulaştırılmış ve kimliksiz istatistik hâlinde
  iletilir; kimliğinizle eşleşmiş tekil yanıt hiçbir koşulda paylaşılmaz.
- Yetkili kamu kurum ve kuruluşlarına, yalnız mevzuatın öngördüğü hâllerde ve ölçüde.

### 7.2 Hizmet sağlayıcılar (veri işleyenler)

Platform; barındırma, veritabanı, e-posta gönderimi, dosya saklama ve güvenlik hizmetleri için
hizmet sağlayıcılardan yararlanır. Sunucu ve veritabanı altyapısı **Avrupa Birliği içinde**
(Frankfurt) konumlandırılmıştır. Barındırma, veritabanı, dosya saklama, e-posta gönderimi ve hız sınırlama
hizmetleri veri işleyen sıfatıyla; Google veya Apple hesabıyla giriş seçildiğinde ilgili sağlayıcı bağımsız veri
sorumlusu sıfatıyla veri işler. Haber başlıklarının çevirisinde kullanılan yapay zekâ hizmetine **kişisel veri
gönderilmez**. Yurt dışında yerleşik sağlayıcılara aktarım, KVKK m.9'daki güvencelere bağlı olarak yapılır.

---

## 8. Saklama süreleri

| Veri | Süre |
|---|---|
| Üyelik, profil, tercihler, kaydedilen içerikler, doğrulama kaydı | Üyelik süresince; hesabınızı kapattığınızda **derhâl silinir**. Üç yıl boyunca giriş yapılmayan hesap, 30 gün önce bildirim yapılarak silinir |
| Doğrulanmamış Deneme Erişimi hesabı | Deneme süresi **30 gün**; süre sonunda doğrulama yapılmamışsa erişim kapanır ve hesap, bitimden itibaren **90 gün** içinde (silmeden **30 gün önce** bildirim yapılarak) silinir |
| Parolasız giriş bağlantısı (tek kullanımlık, yalnız özet) | **20 dakika**; kullanıldığında derhâl silinir |
| İncelemeye düşen mesleki belge | Kabulde karar anında imha; rette yüklemeden itibaren en geç **90 gün**; başarılı otomatik doğrulamada belge hiç saklanmaz |
| Anket yanıtları | Hesap kapatmada **anonimleştirilir**; katılım bedeli ödenen ankette hakediş kaydı **10 yıl** |
| Puanlar / ifa edilmiş ödül talepleri | Puanlar hesap kapatmada silinir; ödül talepleri anonim olarak **10 yıl** (mali mevzuat) |
| Onay (rıza) kayıtları | **10 yıl**, zaman damgalı zincirde; hesap kapatmada IP ve cihaz bilgisi boşaltılır |
| İşlem güvenliği ve erişim kayıtları | **2 yıl**; süre sonunda IP ve cihaz alanları boşaltılır |
| Bülten abonelikten çıkma kaydı · KVKK başvuru kütüğü | **3 yıl** |

---

## 9. Haklarınız (KVKK m.11)

Kişisel verileriniz bakımından; işlenip işlenmediğini öğrenme, bilgi talep etme, işlenme amacını
ve amaca uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya
yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, düzeltme/silme
işleminin aktarıldığı kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz
sonucu aleyhinize bir sonuç doğmasına itiraz etme ve zarara uğramanız hâlinde giderim talep etme
haklarına sahipsiniz.

Başvuru kanalı ve usulü: → [İlgili Kişi Başvuru Usulü](/doctorium/kvkk-basvuru)

**Hesabınızı ve verilerinizi silme:** Platform üzerinden hesap silme talebinde bulunabilirsiniz;
kişisel verileriniz bu talep üzerine silinir. Mevzuat gereği saklanması zorunlu kayıtlar,
saklama süresi doluncaya kadar erişime kapatılarak tutulur ve süre sonunda imha edilir.

---

## 10. Otomatik sistemlerle işleme

Doctorium'da içerik akışı, **sizin belirlediğiniz tercihlere** (takip edilen branşlar, açık
modüller) göre düzenlenir. Açık rıza vermeniz hâlinde sponsorlu içerik de mesleki profilinize
göre seçilir. **Bu işlemler hakkınızda hukuki sonuç doğuran veya sizi önemli ölçüde etkileyen
bir karar üretmez;** yalnız gösterilen içeriğin sırasını ve seçimini belirler.

---

## 11. Ticari elektronik ileti

Günlük özet bülteni ve benzeri bildirimler yalnız **açık aboneliğiniz** üzerine gönderilir ve her
iletide tek tıkla abonelikten çıkma imkânı sunulur. Bu iletilerin 6563 sayılı Kanun anlamında
ticari elektronik ileti niteliği taşıması hâlinde, ayrıca onayınız alınır ve onay İleti Yönetim
Sistemi'ne (İYS) kaydedilir. → Ticari Elektronik İleti Onayı

---

## 12. Değişiklikler

Bu metin, işleme faaliyetlerinde esaslı değişiklik olması hâlinde güncellenir. Esaslı değişiklikte
sürüm numarası artırılır ve üyelerden **yeniden onay alınır**; önceki onaylar, verildikleri
metnin özeti (hash) ile birlikte kayıt zincirinde saklanmaya devam eder.
`;
