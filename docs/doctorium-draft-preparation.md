# Otomatik Etkinlik radarı taslağı

Bu değişiklik mevcut `rubrik-hatirlatma` cron'una hazırlık ekler. Yeni cron, n8n akışı,
credential, migration veya ücretli AI çağrısı yoktur. Mevcut `cronGate` (AURA deploy +
CRON_SECRET) korunur. Günlük Seçki, Karar masası ve açık PR #44'teki Öğrenci köşesi seçicisi değişmez.

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
taslak yazmaya başlar ve resmî kaynaklara koşu başına en fazla 5 salt okunur HTTPS isteği yapar.
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

## Öğrenci köşesi için incelenen sonraki dilim

PR #44 teknik bir zorunluluk değildir: `EduOpportunity` tablosunda `approvedAt`, `sourceUrl`,
`deadline`, `deadlineNote`, `eligibility`, `verifiedAt` vardır; `normalizePayload` ve mevcut
Öğrenci köşesi şablonu, manuel seçici olmadan bağımsız bir hazırlayıcıyı destekler. `main` üzerinde
bu rubriğin üreticisi yalnız boş `skeletonPayload` olduğundan burada etkinleştirilmemiştir.
Güvenli devam adımı, resmî fırsat sayfasından dönem/yıl, son başvuru **saati**, danışman onayı ve
öğrenci uygunluğunu doğrulayan kaynak adaptörüdür. Gün hassasiyetli DB `deadline` alanı tek başına
11 Kasım 17:30 gibi bir şartı doğrulamaz. Genel program sayfasını açık çağrı sanmak veya eski
`verifiedAt` tarihini güncel resmî teyit saymak güvenli değildir. Bu ilk dilim o alanlarda tahmin yapmaz.
