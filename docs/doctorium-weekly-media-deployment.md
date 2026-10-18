# Ayrı haftalık medya: doğrulanmış sınır ve pasif deployment taslağı

## Yanlış varsayımın düzeltilmesi

Parent salt okunur n8n audit'i doğruladı:

- Writer mevcut ReadWriteFile `operation=write`, `/data/bulten/{{ $json.ad }}`.
  HTTP upload API'si yoktur.
- Günlük serving workflow `IjTiPqpVbOktWXBb`, GET/HEAD `bulten/:dosya`.
- Allowlist yalnız `bulten-YYYY-MM-DD.png`, `reels-a-YYYY-MM-DD.mp4`,
  `linkedin-a-YYYY-MM-DD.mp4` ve
  `rubrik-{lowercase-alnum-hyphenseries}-YYYY-MM-DD-{NN.png|short.mp4|belge.pdf}`.
- `weekly-<SHA256>.mp4` bu route'ta kesin olarak 404 olur.
- Cache public,max-age=86400; saklama garantisi yok; MIME binary metadata'dan.

Dolayısıyla mevcut günlük URL'nin sonuna weekly dosyası eklemek geçerli bir
entegrasyon değildir. Günlük workflowun allowlist'i değiştirilmez. Mevcut host ve
depolama altyapısı kullanılacak; ayrı haftalık write path + serving route gerekir.
Bu PR'da hiçbir upload API'si varmış gibi kullanılmaz ve gerçek dosya yüklenmez.

## Hazırlanan kod ve JSON

`infra/kart/lib/weekly-media.mjs` ayrı haftalık sözleşmeyi uygular:

- Yalnız `weekly-<64 küçük hex SHA256>.(mp4|json|srt)`; traversal/glob/günlük ad yok.
- Writer `wx` exclusive yazar; aynı dosya ancak aynı byte/hash ile tekrar kabul
  edilir. Farklı mevcut dosya veya symlink üzerine yazılmaz. SHA256, MIME ve boyut
  içeren ayrı immutable receipt oluşmadan dosya sunulmaz.
- Yeni **kod taslağı** internal `/weekly-media/:dosya`: GET/HEAD, Range206/416,
  doğru Content-Type/Length, hash ETag ve nosniff. Her okumada byte/hash/receipt
  kontrolü; değiştirilmiş veya yarım dosya404; diğer yöntemler405.
- Servis ve DRAFT staging varsayılan kapalı; aktive edilmeden503. Silme/HTTP
  upload/publication endpoint'i yoktur. Günlük endpoint'ler bu handler'a girmez.
- DRAFT archive adapter bu exclusive writer'ı kullanır; ayrı HTTPS route'tan
  byte+MIME geri okuması doğrulanmadan `prepare` çağırmaz.

İki ayrı `active:false` n8n JSON taslağı depodadır:

1. `doctorium-weekly-media-serving-draft.json`: ÖNERİLEN yeni route adı
   `doctorium-weekly-media/:dosya`; var olan canlı endpoint değildir. Tetikleyici
   sadece503 yanıtına bağlıdır. Aday kart proxy node'u disabled ve bağlantısızdır.
2. `doctorium-weekly-media-writer-draft.json`: manual trigger yalnız açık BLOCKED
   hatasına bağlıdır. Aday yeni DRAFT worker isteği disabled/bağlantısız; hiçbir
   günlük writer veya üzerine yazabilen dosya node'u yoktur.

Bunlar üretime hazır/import edilmiş workflow iddiası değildir. N8n sürümü ve yeni
proxy'nin HEAD/Range/status/MIME/ETag aktarımı mevcut ortamda doğrulanınca somut
bağlantı diff'i çıkarılacaktır. JSON taslakları yanlışlıkla elle çalıştırılsa da
writer'a/sağlayıcıya ilerlemez. Ham export, credential veya erişim tokenı içermez.

## Gerekli mevcut erişim ve ayrı deployment kararı

Bu adımlar henüz yapılmadı; mevcut izin production deployment/activation içermez.
Yeni credential, SSH anahtarı veya dosya izin genişletmesi istenmiyor.

1. Mevcut deployment/SSH oturumuyla yalnız Docker mount metadata'sı incelenmeli:
   n8n içindeki `/data/bulten` hangi host volume'undan geliyor; kart bu volume'un
   hangi kısmını zaten görebiliyor; mevcut process UID'si hangi dizine zaten
   okuyup yazabiliyor? Ham `docker inspect` env/secret çıktısı alınmamalı; yalnız
   Mounts alanı ve ilgili dizinlerin stat/read/write sonuçları gerekir.
2. Mevcut volume üzerinde günlük cleanup/glob kapsamından **ayrı** bir weekly
   kök belirlenmeli. `/data/bulten/weekly` recursive günlük cleanup içine girebilir;
   güvenli olduğu varsayılmaz. Host yolu ve retention görevi audit edilmeden
   bu PR hiçbir kesin mount path'i veya kalıcı saklama sözü vermez.
3. Mevcut kart process'i bu ayrı köke zaten erişiyorsa exclusive writer kullanılabilir.
   Erişmiyorsa yalnız weekly alt dizini için mount ekleyen somut compose/kart image
   deployment diff'i gerekir; daha geniş volume/izin açılmaz. Bu deployment ayrı
   karar bekler; mevcut kullanıcı onayı URL entegrasyonunu kapsar, deploy'u değil.
4. Yeni kart kodu mevcut imajda yoktur: image rebuild/restart gerekir. Günlük
   workflow, cron, guard ve LinkedIn video KAPALI durumu değiştirilmez. Yalnız
   weekly archive root + doğrulanmış yeni HTTPS base ayarlanır. Servis/staging
   flag'leri bu çalışmada açılmadı. Yeni n8n serving ve writer workflowlarının
   ayrı import/binding/activation diff'i hazırlanır; günlük workflow edit edilmez.
5. Mevcut SOCIAL_DIGEST_TOKEN bağlantısı yeni weekly worker'a yalnız mevcut
   credential referansıyla bağlanır. CONTENT_PLAN_TOKEN kartta kalır. Mevcut
   referans bulunamazsa durulur; yeni credential veya scope oluşturulmaz.

Sadece yukarıdaki erişim/saklama ve deployment koşulları karşılandıktan sonra
önce TEST dosyası → exclusive write → yeni HTTPS GET/HEAD/Range → SHA256/MIME →
değişmez yeniden yazma kontrolü yapılabilir. Ardından gerçek haftalık DRAFT
manifestine binding doğrulanır. Son insan onayı verilmez; sosyal send/queue/cancel
çağrıları yoktur. Uzaktaki test tamamlanmadan E2E PASS yazılmaz.

## Yerel doğrulamanın sınırı

Yeni birim/yerel HTTP testleri writer/reader üzerinden gerçek disk ve localhost
GET/HEAD/Range geri okumasını sınar. Bu n8n/cloud/storage E2E testi değildir.
FFmpeg/Edge ile gerçek sentetik medya üretimi daha önce geçti; kullanıcı haftalık
klasöründe TEST olarak korunur. Günlük medya hostunun MP4 yanıtı haftalık route
çalışıyor anlamına gelmez.

Node sözleşmeleri için resmî referanslar:
[Read/Write Files from Disk](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.readwritefile/)
ve [Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).
