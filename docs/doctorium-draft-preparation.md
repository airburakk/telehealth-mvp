# Otomatik Etkinlik radarı ve Öğrenci köşesi taslakları

Bu değişiklik mevcut `rubrik-hatirlatma` cron'una hazırlık ekler. Yeni cron, n8n akışı,
credential, migration veya ücretli AI çağrısı yoktur. Mevcut `cronGate` (AURA deploy +
CRON_SECRET) korunur. Günlük Seçki, Karar masası ve açık PR #44'teki manuel seçici değişmez.

## Davranış

- Her gün mevcut 06:00 UTC / 09:00 Türkiye koşusunda **gelecekteki ilk Pazartesi** hazırlanır.
  Pazartesi koşusu ertesi haftayı hedefler. Geçmişe veya aynı güne kayıt üretilmez.
- Yalnız boş `PLANNED` yuva doldurulur; yuva yoksa benzersiz `(seriesKey, slotDay)` ile
  `DRAFT` oluşturulur. Editör taslağı, onaylı/atlanmış/yayınlanmış içerik ve dolu PLANNED korunur.
- Havuz: mevcut küratörlü, `confidence=dogrulandi`, başlangıcı yayın gününden sonraki
  60 günde olan ilk 100 etkinlik. Diğer yuvalarda kullanılan kaynak kimliği veya normalize
  resmî URL yeniden seçilmez (yayınlanıyor ve atlanmış kayıtlar dahil).
- Kayıttaki resmî HTTPS URL ayrıca `sourceUrls` kanıt listesinde bulunmalıdır.
  En fazla 5 resmî sayfa okunur; en fazla 3 etkinlik seçilir. Sonuç deterministik tarih/kimlik sırasındadır.
- Aynı adı taşıyan JSON-LD Event/MedicalEvent başlangıç ve bitiş tarihleri veya görünür
  tam ad + Türkçe tam tarih aralığı eşleşmelidir. Çelişen yapılandırılmış tarih ya da iptal/erteleme
  durumu engellenir. Desteklenmeyen HTML, JS ile gelen içerik, PDF, yönlendirme veya erişim
  hatası `blocked` sonucudur; tarih tahmini yapılmaz.
- Doğrulanmayan şehir, mekân, düzenleyen bilgisi çıkarılır. Başvuru/erken kayıt tarihleri ve
  TTB kodu otomatik taslağa aktarılmaz. Bu ilk kapsam yalnız başlangıç penceresini destekler.
- Her sayfanın SHA256 özeti, kaynağı ve kontrol zamanı taslak `meta.preparation` alanına yazılır.
  Bu bilgi amaçlı izdir; insan onayının veya sayfanın kalıcı arşivinin yerine geçmez.
- Mevcut `buildEtkinlikDraft` slayt, Instagram altyazısı, etiket ve kaynak üretir. Mevcut manuel
  dışa aktarma/kanal araçları korunur; yeni sosyal medya gönderimi yapılmaz.
- Kaynak sürümleri kayıt öncesi yeniden kontrol edilir. Boş yuvaya CAS ve benzersiz anahtar
  eşzamanlı editör işlemi veya ikinci cron koşusunun üzerine yazmayı önler.
- Sonuçlar `created`, `preserved`, `blocked`, `conflict`, `error` olarak cron yanıtında ve
  mevcut `CRON_MAINTENANCE / rubrik-taslak` audit yolunda görünür. Hatalar sabit neden kodlarıdır;
  ham ağ hataları/credential loglanmaz. Hazırlık istisnasında alarm gönderilir ve hatırlatma devam eder.

## Sınırlar ve etkinleştirme

Bu kod merge/deploy olmadan çalışmaz. Deploy onaylandığında mevcut günlük cron otomatik
taslak yazmaya başlar ve resmî kaynaklara koşu başına en fazla 7 salt okunur HTTPS isteği yapar
(5 etkinlik HTML + 1 öğrenci program HTML + 1 çağrı PDF).
Otomatik ONAY, claim, sosyal medya YAYIN veya geçmiş yuvalara geriye tarihli işlem içermez.
Onay kapıları ve mevcut onay hash sözleşmesi değişmez. Boş kaynak havuzunda/kanıt bulunamazsa
taslak oluşmaz; audit nedeni açıklar. Kaynak yapısı desteklenmiyorsa sonraki kapsamda o resmî
kaynağa özel ayrıştırıcı gerekir; bot engeli aşılmaz.

Ağ okuyucusu DNS sonucunu kontrol edip TLS bağlantısında aynı adresi kullanır; özel/rezerve
IP'ler, gömülü kimlik bilgisi, HTTP, alternatif port ve yönlendirme reddedilir. DNS + yanıt
için 4 saniye ve gövde için 512 KB sınırı vardır. Audit mevcut fail-safe mekanizmasını kullanır;
audit yazım arızaları mevcut alarm davranışına tabidir. Bu değişiklik yeni bir görev izleme tablosu eklemez.

Canlı veriyle smoke testi için yetkili test DB gerekir. Üretim cron'unu deneme amacıyla
tetiklemek gerçek DRAFT kaydı yaratır; bu çalışmada yapılmaz. 19/23 Ekim için hazır Library
içeriklerinin canlı kaydı ayrı çalışmanın sorumluluğundadır; burada eklenmemiştir.

## Öğrenci köşesi: desteklenen TÜBİTAK 2209-A adaptörü

PR #44 teknik bağımlılık değildir. Mevcut `EduOpportunity`, payload ve Öğrenci köşesi şablonu
kullanılır. Yalnız önceden onaylı (`approvedAt` dolu), kimliği ve resmî program URL'si desteklenen
2209-A kaydı işlenir. İngilizce eski DB program URL'si tanınır; doğrulama sabit resmî Türkçe URL'ye
yapılır. Kaynak kaydı değiştirilmez veya otomatik onaylanmaz.

- Gelecekteki ilk **Cuma** yuvasına yalnız boş PLANNED/no-row durumunda DRAFT kaydedilir.
- Program sayfasında açık çağrı duyurusu, aynı yıl, gerçek gün ve saat birlikte bulunmalıdır.
  Eski dönem, geçersiz/eksik/çelişkili saat, birden fazla duyuru veya iptal/erteleme engellenir.
  Saat Türkiye +03:00 olarak korunur. Son tarih hem gerçek şimdi anından hem hedef gün 12:00 TR'den sonra olmalıdır.
- Aynı yılın resmî `tubitak.gov.tr/sites/default/files/.../2209-A_<yıl>_Yili_Cagri_Duyurusu.pdf`
  bağlantısı program sayfasında bulunmalıdır. PDF aynı HTTPS/DNS korumalarıyla en fazla 1,5 MB,
  25 sayfa ve 150 bin karakter olarak mevcut `unpdf` bağımlılığıyla okunur.
- PDF'te lisans/ön lisans uygunluğu, Açık Öğretim/Hazırlık sınıfı istisnası, ARBİS, akademik danışman,
  güncel YÖK kaydı, danışman onayı ve kuruluş e-imzası aşamaları doğrulanır. PDF'teki son başvuru
  saati program sayfasındaki saatle uyuşmalıdır. Kayıttaki bayat deadline/eligibility metni kopyalanmaz.
- Taslak 4 slayt + altyazı + etiket + iki resmî kaynak içerir. Şartlar kısa özetlenir; ücret/bütçe vaadi,
  öğrenciye özgü kesin uygunluk veya bütün koşulların sağlandığı iddiası üretilmez.
- İki kaynağın SHA256'sı ve `callKey` (ör. `tubitak-2209a:2026`) ile `deadlineAt` metadata'da saklanır.
  Aynı çağrı sonraki hafta tekrar hazırlanmaz; resmen doğrulanmış yeni yıllık çağrı kullanılabilir.
  Döngüsü belirsiz eski manuel kayıtta aynı kaynak varsa tekrar riski nedeniyle engellenir.
- Öğrenci kaydı sürümü/onayı kayıt öncesi tekrar kontrol edilir. Eşzamanlı yuvaya yazma/editör
  değişikliği CAS + unique anahtarla korunur. Mevcut onay kapıları ve insan onayı değişmez.
- `ogrenci-taslak` audit kaydı ve cron `studentPreparation` sonucu durum/neden taşır. Öğrenci
  hazırlık istisnası etkinlik hazırlığını veya mevcut hatırlatmayı engellemez.

Diğer burs/staj/değişim programları otomatik taranmaz. Desteklenen onaylı kaynak yoksa
`no-approved-supported-student-source`; açık/güncel çağrı veya koşul kanıtı yoksa somut
`blocked` nedeni döner ve hiçbir taslak yazılmaz. Yalnız dönemsel genel sayfadan açık çağrı,
gün sonu varsayımından saat veya eski verifiedAt'ten güncel teyit üretilmez.
