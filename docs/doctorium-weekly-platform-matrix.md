# Haftalık ikinci katman: doğrulama matrisi

Kullanıcının kesin sınırı: mevcut Günlük Seçki ve n8n yayınlarına dokunulmaz.
Haftalık hazırlık ayrı workflow/katman, medya adları ve idempotency alanındadır.
Mevcut render kodu ve medya hostu yeniden kullanılabilir; günlük dosya, guard,
tetikleyici, hesap bağlantısı veya yayın modu değiştirilemez. LinkedIn video
KAPALI kalır. Günlük akışın haftalık akışa çevrilmesi plan dışıdır.

## Platform durumu

| Platform | Doğrulanmış | Bilinmeyen / bekleyen | Şu an gerekli kullanıcı işlemi |
|---|---|---|---|
| Instagram | Canlı site doctoriumtr; kullanıcı sahipliği; parent n8n run596: token valid, 7 story + 1 reel günlük media_publish 8/8 | Ayrı haftalık katmanın mevcut credential binding'i, haftalık tekrar/uzak durum teyidi | Yok; hesap/parola yeniden istenmeyecek |
| Facebook | Canlı site doctoriumtr; kullanıcı sahipliği; parent run599 Doctorium video1144825737890424, yayinlandi=true | Haftalık işin mevcut sayfa/credential eşlemesi ve durum teyidi | Yok; mevcut bağlantı salt okunur incelenecek |
| X | Canlı site x.com/doctoriumtr; kullanıcı sahipliği; parent run609 tweet2111872473905938894 | Haftalık credential bağlama ve gönderi durum teyidi | Yok; metrik retry veya auth değişikliği yapılmayacak |
| LinkedIn video | Canlı site company/doctoriumtr; kullanıcı sahipliği; run597 video4.056.330 bayt hazır; yayinModu KAPALI; Buffer create yok | Haftalık ayrı Buffer kanal yetkisi ve public video teyidi | Yok; mevcut video hattı kapalı kalacak |
| YouTube | Canlı site @doctoriumtr; kullanıcı sahipliği; run601 Buffer6ad4595a6d56c60a73f8a13e kuyruğa kabul, 20:30 TR | Gerçek public video ID/URL/zaman; ayrı haftalık binding | Yok; kuyruk kabulü yayın sayılmayacak |

Bu günlük sağlayıcı yanıtları parent'ın mevcut oturumla yaptığı salt okunur
incelemeden gelir; haftalık yetki veya haftalık E2E PASS değildir. Kullanıcı
sahipliği teknik scope kanıtı yerine geçmez. Sıfırdan credential oluşturulmaz,
erişim genişletilmez ve yeni sosyal çağrı yapılmaz.

## Medya ve yerel kanıt

Mevcut `otomasyon.doctorium.tr` günlük MP4 adresine bu worker'ın salt okunur HEAD
isteği: HTTP200, Content-Type video/mp4, Cache-Control public,max-age=86400;
Content-Length ve ETag yok. Parent tarayıcıda 1080x1920 / 42,233333s / medya hatası
yok olarak çözmüştür. Bu mevcut host kullanılacak; yeni depolama seçilmeyecek.

Yerelde checksum doğrulanmış taşınabilir FFmpeg9.0.2 ile gerçek encode/probe
testi 2/2 geçti. Mevcut Edge ile üç sentetik karttan beş MP4, kanal post.json'ları
ve SRT üretildi; YouTube/LinkedIn kareleri incelendi. Bunlar TEST dosyalarıdır;
container, provider veya gerçek haftalık E2E doğrulaması değildir. Runtime kod
checkpoint'i298dd8e idi; medya çıktıları kullanıcı haftalık klasörünün TEST
alanında korunur. Kalıcı haftalık medya URL bağlantısı kullanıcı tarafından
onaylandı; sosyal yayın veya production deploy izni verilmedi.

## İzolasyonun kod karşılığı

- Ayrı haftalık worker/API/DB ledger ve `weekly-draft/<week>` çalışma alanı.
- Yeni pasif `doctorium-weekly-draft-check.json`: yalnız elle GET durum kontrolü;
  günlük endpoint, schedule, staticData, gönderme veya credential içermez.
  Mevcut credential referansı tespit edilmeden çalıştırılamaz; import edilmedi.
- Yayın medyası adları `weekly-<SHA256>.<uzantı>`; exclusive yazma/hash geri okuma
  ve doğru MP4/JSON/SRT Content-Type kontrolü. Günlük dosya adları kullanılmaz.
- Günlük salt okunur hash indeksi sağlanırsa eşleşme yalnız haftalık işi engeller.
  İndeks yoksa haftalık durum açıkça UNKNOWN/review-required bildirir. Günlük
  marker/iş kayıtları değiştirilmez. İndeks varsayılan kapalıdır; yeni günlük
  workflow veya indeksi günlük akışa yazan adım kurulmadı.
- Mevcut rubric/daily handler'larına haftalık busy engeli eklenmez. Haftalık iş
  mevcut günlük render sürüyorsa başlamaz; günlük akışın davranışını değiştirmez.

## Güvenli uygulanabilir sonraki adım ve gerçek bağımlılık

Mevcut n8n salt okunur incelemesinden dosyaservisinin bağlı arşiv dizini,
doğrulanmış yazma/yükleme yolu, kabul edilen dosya adı deseni, MIME eşlemesi ve
saklama süresi alınmalı. Tamamı mevcut bağlantının metadata/sözleşme bilgisidir;
parola, token içeriği veya genel kurulum onayı istenmiyor. Bu worker ortamında
SSH hedefi/oturumu veya desteklenen n8n upload bağlantısı bulunmadığı için gerçek
haftalık dosya yazma/HTTPS geri okuma/DRAFT bağlama henüz çalıştırılamadı.

Mevcut desteklenen yol doğrulanırsa yalnız weekly-* adlı TEST medyayı aynı hosta
yazıp Content-Type + SHA256 + değişmezlik geri okuması doğrulanabilir. Günlük
workflow çalıştırmak, yeni endpoint uydurmak veya erişim genişletmek çözüm değildir.
İhtiyaç yeni weekly servis kodunun production deploy'unu gerektirirse bunun somut
diff'i ayrıca onaya sunulur; mevcut izin bu deploy'u kapsamıyor. Şu anda
production migration/deploy/aktivasyon veya sosyal publish/queue/cancel yoktur.

Yerel kök: `C:\Users\A.Burak KARADERİ\Desktop\Air\Doctorium Haftalık Paylaşımlar`.
Hiyerarşi ay → hafta; ayı aşan hafta pazartesinin ayında tek klasörde tutulur.
Yerel klasör bir HTTPS yayın adresi değildir.
