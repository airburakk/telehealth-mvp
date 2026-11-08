# Aile hekimliği yayıncı kaynakları ve güncelleme döngüsü

Uygulama ve yerel HTTPS doğrulaması: 8–9 Kasım 2026. Bu belge teknik kapsamı anlatır; klinik veya hukuki onay değildir.

## Mevcut modellerle entegrasyon

- `family-medicine-watch-sources.ts`, mevcut `family-medicine-refresh` manifestine sekiz sabit kaynak ekler. Toplam kaynak sayısı HYP değişikliğiyle 18'dir, 20 kaynak sınırını aşmaz. Mevcut günlük `/api/cron/refresh-family-medicine` görevi 03:10 UTC'de, AURA dağıtımında çalışır; ortak veritabanını kullanan Doctorium dağıtımında no-op kapısı korunur.
- `FamilyMedicineSourceCheck` aynı modelle URL anahtarı, son başarılı kontrol, içerik imzası, kalıcı değişiklik işareti ve hata serisini tutar. Yeni migration gerekmez. İlk başarılı okuma yalnız teknik başlangıç değeridir. Değişiklik, tekrar aynı içerik gelse bile editör incelemesi bekleyen işaret olarak kalır. Kaynak erişim hatası önceki başarılı imzayı silmez.
- Yeni sekiz liste kaynağının `workflowIds` dizileri boştur. Yeni duyuru bulmak hiçbir rapor/ASM iş akışının klinik veya hukuki incelemesini otomatik onaylamaz; listeler doğrudan klinik kanıt yerine geçmez.
- `ASSOCIATIONS` kayıtlarına TAHUD ve AHEF eklendi. Mevcut `.github/workflows/association-watch.yml` Pazartesi 06:17 UTC kontrolü ve `scripts/congress-refresh-queue.ts` aynı kurum listesinden yararlanır. RSS uydurulmadı, bu iki kurum için otomatik etkinlik kaydı oluşturulmaz.
- Yeni cron veya GitHub workflow açılmadı. Mevcut alarmlar ve kontrol durumunu gösteren arayüz kullanılır. Dağıtım, üretim DB ilk çalıştırması ve canlı cron kanıtı ayrıca sürüm çıkarma adımlarıdır; yerel test bunların yerine geçmez.

## Eklenen teknik izleme kaynakları

| Kaynak | Doğrulanan adres | Gerçek okuma |
| --- | --- | --- |
| TAHUD haberler | https://tahud.org.tr/haberler | HTTP 200, gerçek haber bağlantıları |
| TAHUD etkinlikler | https://tahud.org.tr/etkinlikler | HTTP 200, etkinlik listesi |
| AHEF haberler | https://www.ahef.org.tr/Haberler/6/Tum_Haberler.aspx | HTTP 200, gerçek liste |
| AHEF kongreler | https://www.ahef.org.tr/Etkinlikler/46/Kongreler.aspx | HTTP 200, kongre listesi |
| TİTCK duyurular | https://www.titck.gov.tr/duyuru | HTTP 200, sunucuda üretilmiş duyuru listesi |
| TİTCK geri çekme/blokaj | https://www.titck.gov.tr/duyuru?aramaTipi=geriCekme | HTTP 200, filtreli liste |
| HSGM aile hekimliği mevzuat dizini | https://hsgm.saglik.gov.tr/tr/mevzuat.html | HTTP 200, gömülü JSON'dan 83 ilgili kayıt |
| SGK GSS duyuruları | https://www.sgk.gov.tr/duyuru/index/GENEL-SAGLIK-SIGORTASI-GENEL-MUDURLUGU-2026-01-28-02-00-42 | HTTP 200, adres güncel SGK ana listesinden bulundu |

Bu sekiz kaynak gerçek uygulama gözlemcisi üzerinden de HTTP 200 + içerik imzası + boş hata koduyla doğrulandı. Bu, sonraki erişimin veya kaynak içeriğinin hukuken/klinik olarak doğruluğunun garantisi değildir.

### Yanlış güncellik ve yanlış alarm önlemleri

HSGM listesi `const publications = [...]` içinde JSON olarak taşınıyor. Genel HTML görünür-metin karması script içeriğini kaldırırsa yeni mevzuatı kaçırır. Kaynağa özel ayrıştırıcı JSON'u çalıştırmadan okur, sözleşmesini doğrular, aile hekimliği başlığı/daire etiketi taşıyan kayıtların kimlik, başlık, adres, kategori, katalog tarihi ve etiketlerini kararlı sırayla imzaya dahil eder. Boş, bozuk, tekrarlı veya beklenmeyen bağlantılı veri başarılı sayılmaz. Katalog tarihi yürürlük tarihi değildir. Linklenen belgeler otomatik indirilmez, mevzuat metinleri bu döngüyle onaylanmaz.

AHEF sayfalarındaki yalnız açıkça gözlemlenmiş görüntülenme ve toplam ziyaret sayaçları çıkarılır. Tarihler, diğer sayılar, başlıklar ve bağlantılar korunur. Diğer liste değişiklikleri editör sinyalidir; otomatik hukuki değişiklik sınıflandırması değildir.

## TİTCK için gerçek RSS metadata toplama

Resmî duyuru sayfasının bağlantı verdiği https://www.titck.gov.tr/recallAnnouncementFeeds adresi doğrudan HTTP 200 ve `application/xml` döndürdü. RSS 2.0 ayrıştırıcısı gerçek ilk 20 kaydı okudu. Örnekler: `5394` (3 Kasım 2026) ve pencerenin sonundaki `5277` (13 Nisan 2026). `https://www.titck.gov.tr/duyuru/5394` gerçek detay sayfası olarak HTTP 200 döndürdü. Önceki eski endpoint'lere ait “TİTCK RSS yok” gözlemi bu yeni adres için geçerli değildir.

- Mevcut günlük `ingest-doctorium` (02:00 UTC) collector listesine `titck-recalls` eklenir. Aynı `NewsArticle` modeli, benzersiz kaynak/numara kimliği ve sektörel `ilac-cihaz` kategorisi kullanılır.
- Sadece kaynağın başlık, kısa açıklama, resmî link ve yayın tarihi metadata'sı alınır. “Kamuoyunun Dikkatine” gibi genel resmî başlıklar haber anahtar kelime filtresi nedeniyle atılmaz.
- Başlık/açıklama/adres/tarih aynı kimlikte düzelirse mevcut satır güncellenir, `createdAt` değiştirilmez, AI özeti ve eski çeviri önbellekleri temizlenir. Kaydetmeler için satır kimliği korunur.
- TİTCK geri çekme kaynağı genel AI özet üretiminden ve detay metni zenginleştirmesinden dışlanır. Detay görünümü önceden oluşmuş bir AI önbelleği olsa bile onu göstermez; ayrı `source-only` durumu resmî duyuruya yönlendirir. Böylece genel zenginleştirme RSS açıklamasını ezmez ve değişmeyen kaydı her gün düzeltilmiş gibi göstermez.
- Girdi sabit HTTPS origin, yönlendirmesiz ve kimlik bilgisi/çerezsizdir. Gövde dahil 12 saniye, 2 MiB ve 20 kayıt tavanı vardır. Beklenmeyen RSS yayıncısı/kategorisi, yanlış tarih/link, HTML hata sayfası ve XML haricî entity tanımı reddedilir. Eksik tarih bugünle doldurulmaz.
- RSS yalnız geri çekme/blokaj duyurularını kapsar. Tüm TİTCK duyurularının içerik beslemesi değildir. Genel duyurular teknik izleme kuyruğundadır. Ürün/seri/parti ve kapsam için resmî detay metni esas alınır; sistem burada tedavi veya stok işlem kararı üretmez.
- Günlük RSS penceresi ilk 20 kayıtla sınırlıdır. Uzun kesintide pencere dışına çıkan kayıtların eksiksiz geri doldurulduğu iddia edilmez. RG/SGK'nın mevcut ingestion hatları tekrar oluşturulmadı.

## Testler ve açık doğrulama sınırı

- Kaynak dizini, AHEF sayaç ayrımı, HSGM script içindeki gerçek veri değişimi, hatalı/boş JSON, güvensiz link ve JavaScript çalıştırmama testleri.
- TİTCK RSS sözleşmesi, 20 kayıt tavanı, geçmiş gerçek tarih, hatalı/gelecek tarih, sabit origin, redirect reddi, body boyutu ve timeout testleri.
- DB mock ile ilk ekleme, idempotent yeniden okuma, metadata düzeltmesinde AI önbelleği temizleme, dry-run yazmama ve bozuk feed'de sıfır yazma testleri.
- Yerel canlı fetch+parse gerçek kaynaklarla yapıldı. Bu değişiklik için üretim veritabanına yazılmadı, commit veya deploy yapılmadı. Üretim ilk ingestion ve scheduler sonuçları parent sürüm doğrulamasına aittir.

## Entegrasyon doğrulaması (2026-11-08 UTC)

- Son tüm birim paketi: 237 dosya / 2802 test başarılı.
- Gerçek DEV PostgreSQL editoryal güvenlik paketi: 8 test başarılı. Fixture'lar geri alındı; kalıcı uzman grant'i verilmedi.
- Gerçek DEV kaynak döngüsü: 18/18 erişim başarılı, erişilemeyen kaynak yok. Eski teknik değişiklik geçmişi korunuyor; normalizasyon biçimi güncellemesi bir kez teknik değişiklik işareti üretebilir.
- Gerçek DEV TİTCK aktarımı: ilk koşu 20 taranan / 20 yeni, ikinci koşu 20 taranan / 0 yeni; toplam 20 kayıt. Bu kayıtlar public resmî duyuru metadata'sıdır.
- Tam ESLint ve TypeScript kontrolü geçti. Son kodla `next build` başarılı. `npm run build` içindeki Prisma yeniden üretimi, aynı bilgisayarda çalışan mevcut Yargıtay toplama sürecinin Windows DLL kilidi nedeniyle çalışamadı; süreç durdurulmadı. Şema değişmedi, mevcut Prisma istemcisi kullanıldı. CI'de normal tam build ayrıca zorunlu.
- Üretim migration denetimi salt okunur: 66/66, checksum farkı 0, failed 0, bekleyen yok. Bu sürüm yeni migration gerektirmez.
- Mevcut ingest-doctorium audit kaydına TİTCK kaynak sonucu (yeni/taranan, failed veya not-run) eklendi; genel cron başarısı tek kaynağın başarısı gibi yorumlanmaz.
- TAHUD rehberindeki geçici imzalı indirme sorguları yalnız doğrulanmış host/yol için imza dışında tutulur. Aynı belge sürümü, diğer query parametreleri ve gerçek içerik değişiklikleri korunur. İmzalı URL değerleri rapora veya veritabanına kaydedilmez.
- Son tarayıcı regresyonu: 4/4 masaüstü/mobil senaryosu geçti. Tercih kaydetme, yenileme, hızlı seçim ve geri/ileri ile TİTCK source-only ekranı, resmî kaynak linki ve taşma kontrol edildi. Ekran görüntüleri görsel olarak incelendi; DEV tercihi eski değerine döndürüldü.
- Son Next üretim derlemesi tamamlandı. Önceden var olan dicom-pixels.ts dinamik import uyarısı dışında yeni build uyarısı yok.
- Yayın henüz yapılmadı. Mevcut canlı Doctorium hedefi GitHub airburakk/telehealth-mvp main, Vercel doctorium projesi olarak doğrulandı. Yerel kod ve teknik raporların herkese açık depoya gönderilmesi için açık onay bekleniyor; üretim bu devam değişiklikleriyle güncellenmedi.
