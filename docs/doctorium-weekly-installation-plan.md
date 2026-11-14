# Ayrı haftalık medya: gerçek SSH bulgularına göre kurulum planı

Durum: PLAN; hiçbir sunucu, workflow, dosya izni veya credential değiştirilmedi.
Testleri geçmiş runtime checkpoint: `2ec39980b557fb6f955ce8e75982f877cf5a4f0d`.
Bu çalışma yalnız dokümantasyondur; geçmiş testler gereksiz tekrarlanmadı.

## Doğrulanmış canlı durum

Kaynak: mevcut yetkili SSH salt okunur incelemesi; görev
`01a154ad-6a79-7472-97f5-500cf9c170f4`, turn
`01a15593-a333-75fc-82ed-b5a2ff95e3a0`. Gizli env veya credential değeri alınmadı.

| Alan | Gerçek bulgu | Haftalık katman için anlamı |
|---|---|---|
| Sunucu | doctorium-n8n | Erişim engeli çözüldü; yeni anahtar/hesap gerekmez |
| Mevcut kart | n8n-kart-1, UID/GID 0:0 | Mevcut kartın UID'si değiştirilmez |
| Kart varlık mount'u | /opt/n8n/kart-varlik → /varlik, readonly | Marka/müzik arşivi değişmez; haftalık yazma alanı değildir |
| Günlük geçici medya | /tmp/sosyal, kalıcı mount yok; son 2 tarih klasörü; aynı gün yeniden üretimde gün silinir | Haftalık dosya burada tutulmaz; mevcut kartı recreate etmek bu geçici alanı kaybettirir |
| Rubrik geçici medya | /tmp/sosyal/rubrik, son 3 tarih klasörü | Haftalık kalıcı arşiv değildir |
| Günlük n8n arşivi | /opt/n8n/bulten-arsiv → /data/bulten, writable 1000:1000; yaklaşık 220 MB | Günlük writer/allowlist değişmez; içine haftalık paket konmaz |
| Disk | 38 GB toplam, 26 GB kullanım, 9,8 GB boş, %73 | Büyük image/download ve sınırsız medya/yedek büyümesi uygun değil |
| Mevcut yedek | /opt/backups yaklaşık 4,5 GB; 03:30 cron yalnız n8n veri volume'unu yedekliyor; mtime+14 yedek siliyor | Ayrı haftalık medya bu yedekte yok; mevcut cron/14 gün kuralı değiştirilmez |

Önerilen ayrı host dizini `/opt/n8n/haftalik-medya`, yeni haftalık container
içinde `/data/haftalik`. İncelemeye göre mevcut cleanup bu ayrı alanı kapsamıyor;
bu bulgu otomatik yedeğe girdiği veya sonsuz disk kapasitesi olduğu anlamına gelmez.

## En az kesintili somut değişiklik

1. **Mevcut kart/n8n restart yok.** Ayrı `kart-weekly-media` servisi önerilir.
   Mevcut sabit kart imajı temel alınır; yalnız haftalık reader/entrypoint eklenen
   küçük bir katman hazırlanır. apt/npm/Chromium yeniden indirilmez. Mevcut kart
   image etiketi, process'i ve geçici günlük dosyaları korunur. İmaj içeriği ve
   digest'i kurulumdan önce somut diff olarak kaydedilir.
2. Yeni servis bu aşamada **yalnız medya** sunar: yeni entrypoint sadece weekly
   handler + sağlık kontrolünü yükler; mevcut server.mjs'nin tamamı başlatılmaz.
   Chromium/render, günlük digest, sosyal gönderici ve otomatik içerik işi yoktur.
   Bu ayrı entrypoint/image/compose overlay henüz uygulanmış veya deploy edilmiş
   değildir; uygulama ve hedefli testler activation ön koşuludur.
3. Yalnız yeni host dizini için owner 1000:1000, dizin 0755, yeni medya/receipt 0644
   önerilir. Yeni servis 1000:1000 çalışabilir; root kart ve n8n 1000 dosyaları
   okuyabilir. Mevcut klasörlerin owner/mode/ACL'si ve mevcut kart root kullanıcısı
   değiştirilmez. Yeni n8n workflow HTTP proxy kullanacağından n8n servisine mount
   ekleyip onu yeniden başlatmak gerekmez.
4. Yeni bind yalnız `/opt/n8n/haftalik-medya:/data/haftalik` olur; günlük arşiv,
   /opt/backups veya host kökü yeni servise verilmez. Host public port açılmaz;
   mevcut compose ağı üzerinden n8n yalnız yeni servise erişir.
5. Yalnız yeni servis için öneri: CPU 0,25 ve RAM 256 MiB üst sınırı. Canlı RAM ve
   mevcut servis boşta durumunun salt okunur kontrolü yapılmadan başlatılmaz.
   Kaynak yetmiyorsa DURULUR; günlük limitler değiştirilmez, ücretli yükseltme
   yapılmaz. Yeni serviste render açmak bu düşük kaynak planının kapsamında değil.
6. İki yeni n8n serving/writer taslağı günlük workflowlardan ayrıdır. Mevcut
   credential referansı yeniden kullanılır; içerik çıkarılmaz, yeni credential
   veya scope oluşturulmaz. Yeni serving proxy için GET/HEAD/Range/status/MIME/
   ETag aktarımı test edilir. Aday node'lar doğrulanana kadar BLOCKED/503 kalır.

Bu ilk pakette TEST dosyasının writer'ı yeni serviste dosya-staging helper'ıdır;
HTTP upload API'si eklenmez. Yeni n8n serving adayı yalnız yeni servise yönelir.
Eski kartı hedefleyen pasif DRAFT/render POST adayı bağlanmaz. Otomatik render
ve gerçek uygulama DRAFT binding'i bu medya-only kurulum paketine dahil değildir.

Bu yaklaşım mevcut kartın rebuild/restart riskini önler. Yeni process ve image
işlemleri yine disk/CPU kullanır; sıfır kaynak etkisi iddia edilmez. Önce limit ve
boş alan kontrolü, ardından yalnız yeni serviste düşük hacimli TEST uygulanır.

## Silmesiz disk koruması — önerilen başlangıç sınırları

Bu sınırlar PLAN'dır; aggregate quota/free-space guard runtime'da henüz yoktur.
Uygulanıp eşzamanlı yazma testleri geçmeden writer aktive edilmez.

- Mevcut tek dosya sınırı 100 MiB korunur.
- Ayrı haftalık medya + receipt + geçici yazma dosyaları toplamı en çok 1 GiB.
- Haftalık medya yedek alanı en çok 1 GiB; aynı dolu diskte kontrolsüz kopya yok.
- Her yeni yazma/snapshot/image katmanından sonra en az 5 GiB boş alan kalmalı
  **ve** filesystem kullanımı %85'i geçmemeli; daha sıkı koşul uygulanır.
- Kota kontrolü tek weekly filesystem lock altında mevcut byte + bekleyen
  rezervasyon + yeni byte üzerinden yapılır. Aynı-hash aynı-byte tekrar mevcut
  alanı iki kez rezerve etmez. Ölçüm/lock belirsizse yazma durur; üzerine yazılmaz.
- Image/build bütçesi de boş alan kontrolüne dahil edilir. Büyük base image
  download/rebuild gerektirirse bu plan kapsamında yapılmaz.
- Eşik aşımında yalnız weekly yeni yazma durur ve açık durum kaydı oluşur.
  Günlük akış etkilenmez. Hiçbir dosya, eski sürüm, test kanıtı veya yedek otomatik
  silinmez. Saklama süresi varsayılmaz; yaşa göre silme/mtime cron'u kurulmaz.

Bugünkü 9,8 GB boş alan bu öneriyi matematiksel olarak mümkün kılar; kurulum
anındaki disk/RAM tekrar ölçülmeden kapasite garantisi verilmez.

## Ayrı yedek ihtiyacı

Mevcut 03:30 cron haftalık medyayı korumaz. İlk TEST kabulünde ve her yeni
mühürlü haftalık paketten sonra yalnız weekly dizini + hash manifesti + receipt
için ayrı snapshot önerilir. SHA256 ile geri okuma ve boş bir test dizinine geri
yükleme kontrolü gerekir. Mevcut cron veya 14 gün yedek silme kuralına ek yapılmaz.

Yeni snapshot önce 1 GiB yedek kotası ve 5 GiB boş alan koşulundan geçer. Yer yoksa
yeni snapshot/yeni paket kabulü durur; mevcut yedek silinmez. Aynı disk snapshot'ı
sunucu/disk kaybına karşı bağımsız yedek değildir. Kullanıcı masaüstü haftalık
klasörüne doğrulanmış kopya ikinci ortam olabilir; bu aktarımın otomatik/auth
yolu henüz doğrulanmış değildir. Yeni ücretli depo veya erişim oluşturulmaz.

## Tek operasyon onayına sunulabilecek paket ve kabul kapısı

**Tek anlaşılır kapsam:** “Mevcut günlük n8n ve kart servisine dokunmadan ayrı
haftalık medya dizinini, sınırlı medya servisini ve ayrı n8n route'unu kur;
silmesiz disk sınırları ve ayrı yedek kontrolüyle yalnız TEST dosyasını
yaz/oku/doğrula. Sosyal yayın, kuyruklama veya içerik onayı yapma.”

Bu onay henüz verilmiş veya uygulanmış sayılmaz. Entry point/image/overlay,
aggregate kota guard'ı ve bağlı proxy diff'i önce incelenebilir hale getirilir ve
hedefli test edilir. Kurulumda sıralama: snapshot/config/image kimlikleri →
yalnız yeni servis → yalnız weekly route → TEST exclusive write → HTTPS
GET/HEAD/Range + MIME/hash + aynı dosyaya farklı-byte reddi → yedek/restore.

Gerçek app DRAFT binding için PR48 uygulama kodu/şema deployment durumu ayrıca
kontrol edilir. Bu medya kurulum paketi PR merge, production DB migration veya
uygulama deployment izni değildir. Gerçek haftalık insan içerik onayı da ayrıdır.

## Geri alma

Yalnız yeni weekly writer/route durdurulur ve yeni servis kapatılır; mevcut
kart/n8n, günlük workflowlar, guard'lar ve LinkedIn KAPALI durumu değişmez.
Yalnız eklenen compose overlay kaydı geri alınır; eski image etiketi korunur.
Yeni weekly medya, receipt, manifest, snapshot ve hata kanıtları **silinmez**.
Route kapatmanın daha önce kabul edilmiş sosyal kuyruğu iptal ettiği varsayılmaz;
bu kurulumda zaten sosyal enqueue/upload/cancel yapılmaz.
