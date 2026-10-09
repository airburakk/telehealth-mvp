# `infra/kart/` — Doctorium kart + sosyal video servisi

Hetzner `doctorium-n8n` VPS'inde (n8n ile **aynı compose**, `/opt/n8n/`) çalışan `kart` servisi. **Vercel'e / Next uygulamasına girmez**; n8n akışları HTTP ile çağırır.
Eskiden yalnız `server.mjs` sunucuda duruyordu (scp ile düzenleniyor, kurtarılması zordu); v6.320'de depoya alındı → sürümlü + testli.

Altı iş yapar:

1. **`GET /bulten.png`** — her sabah 07:45 TR n8n'in çağırdığı TAM BÜLTEN kartı (1080×1350 PNG). Seçkiyi servis KENDİSİ çeker (jeton yalnız `.env.kart`'ta; n8n görmez). Boş gün → `204`. **v6.320'de değişmedi.**
2. **`/sosyal/*` (v6.320)** — aynı seçkiden Instagram **hikâye klipleri** (kart + her içerik için 1) ve **Reel A** (vuruşa oturan tipografik video) MP4'leri üretir.
3. **Carousel (v6.323)** — aynı iş, aynı seçki anlık görüntüsünden Instagram **kaydırmalı post** slaytları (1080×1350 PNG, 4:5): 01 günlük kart (paylaşımla AYNI PNG) · 02…N+1 her içerik için bir slayt (akış · başlık · kaynak · `summaryLong`) · N+2 kapanış ("Seçkinin tamamı biyografideki bağlantıda").
4. **LinkedIn videosu (v6.327 kesit → v6.331 YATAY)** — aynı iş: Reel A'nın **16:9 yatay (1920×1080) tam render'ı** `linkedin-a-<gün>.mp4` (aynı DOM, zaman çizelgesi ve müzik; yalnız yerleşim yatay; 1,7 sn'den başlar → ilk kare dolu, LinkedIn küçük resmi = ilk kare). Kapanış satırı iki platformda ortak `REEL_CTA`. n8n "LinkedIn video (Buffer)" akışı (08:20 → 12:30) tüketir; yoksa `reels-a-<gün>.mp4` (9:16).
5. **`POST /rubrik/render` (v6.328)** — içerik takvimi rubrik slaytlarının (Karar masası vb.) PNG önizlemesi; aşağıdaki "İçerik takvimi önizlemesi" bölümü.
6. **`/rubrik/bugun` · `/rubrik/sonuc` · `/rubrik/dosya` (v6.335)** — içerik takvimi YAYIN uçları: bugünün ONAYLI içeriğini Vercel'den alır, çizer, sunar, yayın sonucunu iletir (Faz 3 n8n'in tek yüzü; DORMANT); "İçerik takvimi YAYIN uçları" bölümü.

## Uçlar

| Uç | Yanıt |
|---|---|
| `POST /sosyal/uret[?yenile=1]` | **202** üretim başladı · **200** o günün klipleri zaten HAZIR (idempotent) ya da boş gün (`bos_gun:true`) · **409** başka iş sürüyor · **502** seçki alınamadı/geçersiz (`summaryLong` yoksa dâhil) · **503** müzik dosyası yok |
| `GET /sosyal/durum` | `{durum: "bos"\|"calisiyor"\|"hazir"\|"hata", gun, …}` — `hazir`: `dosyalar[{ad,boyut,tur,sira}]` (MP4), `gorseller[{ad,boyut,tur:"carousel",sira}]` (PNG, v6.323), `linkedin[{ad,boyut,tur:"linkedin",sira}]` (MP4, v6.327; 0–1 öğe), `kapsam{ogeSayisi,yedekSayisi,akislar[]}`, `sure_sn`; `calisiyor`: `asama` (`hazirlik`→`kart`→`carousel`→`hikaye`→`reel`→`kapanis`), `gecen_sn`; `hata`: `hata`, `adim` |
| `GET\|HEAD /sosyal/dosya/<YYYY-AA-GG>/<ad>` | MP4 (`video/mp4`, `dosyalar`'dan ya da `linkedin-a-*` için `linkedin`'den) ya da PNG (`image/png`, `gorseller`'den) — yalnız TAMAMLANMIŞ günün, `bitti.json`'da listeli dosyaları; tür başına KENDİ listesi (PNG adı `dosyalar`da, MP4 adı `gorseller`de, LinkedIn adı `dosyalar`da aranmaz) |
| `GET /saglik` · `GET /bulten.png` | eskisi gibi |

`dosyalar[].tur` = `hikaye` (`sira` = klip numarası, 1 = kart) ya da `reel`. `gorseller[].sira` = slayt numarası (01-kart → 1, sonuncusu kapanış). `kapsam.akislar` = günün akış etiketleri (`streamLabel`), seçki sırasıyla, tekrarsız
(Reel/carousel altyazısının akış satırı için; n8n büyük harfe çevirip " · " ile birleştirir). n8n akışı: `POST /sosyal/uret` → `GET /sosyal/durum` ile `hazir` bekle (**`gun` alanını kendi beklediği günle karşılaştır**) → dosyaları indir → arşive yaz.

🪤 **Geriye uyum (v6.323):** carousel slaytları `dosyalar`a DEĞİL ayrı `gorseller` dizisine yazılır. Çalışan n8n akışı `dosyalar`daki HER öğeyi indirip MP4 imzası (`ftyp`) arar → PNG'yi `dosyalar`a koymak, sunucu güncellendiği anda 07:55 koşusunu düşürürdü.
`gorseller` olmayan (v6.320'de yazılmış) `bitti.json` hâlâ geçerlidir (`gorseller: []` döner). Aynı kural `linkedin` için (v6.327): ayrı dizi, eski kayıtta `[]`; `linkedin-a-*.mp4` adı `AD_RE`'ye uysa da `dosyalar`dan DIŞLANIR (07:55 akışı onu indirip Instagram'a vermez). **Sıra:** sunucu dağıtımı n8n güncellemesinden ÖNCE güvenle yapılabilir; n8n tarafı (`gorseller`'i indirip arşive yazma + herkese açık adres + yayın) AYRI bir adımdır.

**Tasarım:** tek iş (ikinci POST kuyruğa girmez, 409) · kilit seçki çekilmeden ÖNCE alınır · kart + carousel + hikâyeler + Reel AYNI seçki anlık görüntüsünden üretilir · yarım iş görünmez (`bitti.json` EN SON, atomik; carousel PNG'leri videolardan ÖNCE diske düşer ama `bitti.json` yokken sunulmaz — test kilitli) ·
hata → üretim başladıysa gün klasörü silinir; **başlamadan düşen** `yenile` (ör. müzik yok) önceki iyi klipleri korur · en yeni 2 gün klasörü saklanır (kalıcı arşivi n8n yazar).

## İçerik takvimi önizlemesi — `POST /rubrik/render` (v6.328, 2026-10-06)

Next uygulamasındaki `/admin/icerik-takvimi` (Karar masası vb. rubrik içerikleri) **önizlemesini yayınlanacak PNG'nin kendisi** yapar: aynı Chromium, aynı çerçeve (kartla/karuselle AYNI sayılar). Servis internete AÇIK DEĞİL; Vercel → n8n webhook köprüsü
(`output/n8n-akislari/n8n_rubrik_kopru.py`, sırsız, yürütme kaydı KAPALI) → bu uç. **Bearer `SOCIAL_DIGEST_TOKEN` doğrulaması BURADA yapılır** (köprü başlığı olduğu gibi iletir).

| İstek | Yanıt |
|---|---|
| `POST /rubrik/render` gövde `{templateKey, seriesName, slotDay, slides:[{role,title,body,bullets,quote}]}` | **200** `{slides:[{index, role, png (base64), tasma}]}` · **400** geçersiz gövde (neden metinde) · **401** Bearer yok/yanlış · **405** · **413** gövde > 256 KB · **429** başka önizleme sürüyor (tek iş) · **503** sosyal üretim (07:55 işi) sürüyor ya da `SOCIAL_DIGEST_TOKEN` tanımsız · **500** render hatası (iç mesaj SIZMAZ) |

- `tasma:true` → metin asgari puntoda bile sığmadı (editör kısaltır). Roller: kapak · uyusmazlik · mahkeme · gerekce · sonuc · cikarim · kaynak · genel; `quote:true` alıntı bloğu çizer, `[…]` atlama işareti vurgulanır.
- **Tek belge, çok slayt:** 7 slayt tek HTML'de alt alta (yazı tipleri BİR kez yüklenir) → her slayt kendi `.slide` öğesinden çekilir; yerel ≈6 sn (karuselin slayt başına sayfa açma yolundan ≈7× hızlı). Sığdırma slayt başına, role göre asgari punto.
- Güvenlik: girdi HER ZAMAN `esc()`/`tipo()`'dan geçer (HTML'e ham girmez) · alan uzunlukları/slayt sayısı sınırlı · kart sosyal üretim sürerken (Chromium + 1,5 GB sınırı) bu ucu REDDEDER → sabah akışı bu uç yüzünden aksamaz.
- Yerel deneme: `node tools/rubrik.mjs --model model.json --out cikti` (`model.json` = istek gövdesi; `PLAYWRIGHT_FROM=…/package.json`). Sunucu dağıtımı yukarıdaki adımlarla AYNI (yeni dosya `lib/social-rubrik.mjs`; compose değişmez).
- Testler: `npx vitest run tests/unit/kart-rubrik.test.ts` — doğrulama · şablon kaçışı · çerçeve eşliği (kart/karusel sayılarıyla) · `renderRubrik` (sahte tarayıcı) · HTTP kapıları (Bearer · meşgul · eşzamanlı · gövde sınırı · 500'de iç mesaj sızmaması).
- 🪤 Slaytta emoji YOK (imajda emoji yazı tipi yok → kutu çıkar); kaynakta `\uXXXX` YAZMA (testle kilitli).

## İçerik takvimi YAYIN uçları — `/rubrik/bugun` · `/rubrik/sonuc` · `/rubrik/dosya` (v6.335, 2026-10-07; Faz 2-B2)

Faz 3 otomasyonunun (n8n) içerikle konuşacağı **tek yüz**: kart bugünün ONAYLI rubrik içeriğini Vercel'den (`POST /api/social-calendar/yayin`, v6.334) alır, slaytları çizer, dosyaları sunar ve yayın sonucunu Vercel'e iletir.
**`CONTENT_PLAN_TOKEN` YALNIZ burada (`.env.kart`) ve Vercel `doctorium` env'inde yaşar; n8n'e GİRMEZ** (SOCIAL_DIGEST_TOKEN deseni). Jeton tanımlı değilse `bugun`/`sonuc` **503** (DORMANT — kodu sunucuya koymak güvenlidir). Kart iç ağdadır:
`/sosyal/*` ile AYNI güven modeli (n8n köprüsü yalnız `/rubrik/render`'a gider; yeni uçlar internetten erişilemez).

| İstek | Yanıt |
|---|---|
| `POST /rubrik/bugun?kuru=1[&gun=YYYY-AA-GG]` | **KURU** = Vercel `bak` (SALT OKUMA; durum DEĞİŞMEZ) → çiz + arşivle. Her gün için serbest (`gun` yoksa bugün, Türkiye günü). **200** `{ok, gun, kuru:true, items[], hatalar[], atlanan[], sure_sn}` |
| `POST /rubrik/bugun` | **CANLI** = Vercel `al` (ONAYLI → YAYINLANIYOR; en fazla BİR KEZ) → çiz → dosyalar. YALNIZ bugün (gün kartta hesaplanır; `gun` verilirse **400**). Aynı gövde, `kuru:false` |
| `POST /rubrik/sonuc` gövde `{id, version, durum:"ok"\|"hata", kanallar?, basarisiz?, hata?}` | Vercel `sonuc`'a İLETİR (beyaz liste; Vercel'in durum kodu + gövdesi aynen: 200 · 400 · 404 yuva yok · 409 geçiş yasak/çakışma). `version` = `bugun` yanıtındaki öğe sürümü. İdempotensi Vercel'de (aynı sonuç ikinci kez 200 `tekrar:true`) |
| `GET\|HEAD /rubrik/dosya/<YYYY-AA-GG>/<ad>.png` | `image/png` — yalnız `bitti.json`'da listeli adlar (yarım iş GÖRÜNMEZ) |
| `GET\|HEAD /rubrik/dosya/<YYYY-AA-GG>/rubrik-<seri>-<gün>-short.mp4` | (v6.340) `video/mp4` — YouTube Short (aynı listeleme kuralı) |
| `GET\|HEAD /rubrik/dosya/<YYYY-AA-GG>/rubrik-<seri>-<gün>-belge.pdf` | (v6.342) `application/pdf` — LinkedIn belge carousel'i (aynı listeleme kuralı) |

- Öğe: `{id, version, seriesKey, slotDay, approvedHash, altyazi, caption, hashtags, gorseller:[{ad,boyut,sira}]}` — `altyazi` = ZIP'teki `altyazi.txt` ile AYNI biçim (altyazı + boş satır + etiketler); resim baytı yanıtta YOK (dosya ucundan indirilir).
- Hatalar: **502** `{hata, belirsiz}` (Vercel'e ulaşılamadı / yanıt geçersiz / kimlik reddedildi; `belirsiz:true` → `al` içerik aldıysa durum BİLİNMİYOR: İNSAN bakar) · **503** kapalı (jeton yok) ya da sosyal üretim sürüyor (07:55 işi) · **429** başka `bugun` sürüyor · **400** geçersiz parametre/gövde · **413** gövde > 64 KB.
- **En fazla bir kez:** içeriği `al` ile ALAN çağıran yayınlar; aynı gün ikinci `bugun` boş döner (Vercel). Çökme/zaman aşımında içerik YAYINLANIYOR'da takılır → çift paylaşım yerine İNSAN karar verir (Vercel panelinde "elle yayınlandı" / "yayınlanmadı — yeniden dene"). `bugun` ölü yanıt alırsa (502 `belirsiz`, ağ koptu, kart çöktü) n8n AYNI içeriği yeniden almaya ÇALIŞMAZ.
- **Render hatası → YAYIN HATASI:** yayınlanmadığı kesin olduğundan kart `sonuc hata` bildirir (`hatalar[].bildirildi:true`); bildirilemezse içerik YAYINLANIYOR'da kalır (`bildirildi:false`, insan çözer). KURU'da bildirim YOK (durum değişmez).
- **Taşma FAIL-CLOSED:** asgari puntoda bile sığmayan slayt (`tasma:true`) yayına çıkmaz ("slayt N metni asgari puntoda sığmadı — kısaltın"); kırpılmış görsel paylaşılmaz.
- **Görsel = onaylanan önizleme:** kart gövdesi Vercel'in `render` alanından gelir (önizlemeyle AYNI işlev, `renderRequestBody`); kart rubrik adını/şablonunu KENDİ bilmez. Bozuk `render` modeli o öğeyi YAYIN HATASI'na çeker (parti düşmez).
- **Dosyalar:** `<SOSYAL_DIR>/rubrik/<gün>/rubrik-<seri>-<gün>-NN.png` + `bitti.json` (atomik; kimliğe göre BİRİKİR; öğe BAŞINA yazılır — sonraki öğe düşse de önceki öğenin dosyaları listeli kalır) — sosyal işinin `<SOSYAL_DIR>/<gün>/` klasöründen AYRI (07:55 işi kendi klasörünü siler); en yeni 3 gün saklanır. NN iki haneli slayt sırası (01 = kapak).
- **Sızıntı yok:** jeton yalnız Authorization başlığında; yanıtta/günlükte yok (davranışsal testle kilitli); beklenmeyen hata gövdesi genel; render istisnasının ve disk (izin/doluluk) hatasının ayrıntısı yalnız kart GÜNLÜĞÜNDE (yanıta/Vercel'e genel mesaj; disk hatası da YAYIN HATASI'dır).
- Ortam: `CONTENT_PLAN_TOKEN` (boş = DORMANT), `CONTENT_PLAN_URL` (vars. `https://doctorium.tr/api/social-calendar/yayin`).
- **Beş mecra (v6.339–340, 👤 07–08.10):** Instagram · LinkedIn · Facebook · X · YouTube; yayın saati **12:00 TR**. Her öğe ayrıca `video` (`{ad, boyut, sure_sn, sesli}` ya da `null`), `videoHata` ve `xGruplari` taşır. **YouTube** = onaylı PNG'lerden 1080×1920 Short (`lib/rubrik-video.mjs`; slayt yeniden çizilmez, bulanık arka plan üzerinde ortalanır, kare 0 DOLU, ≤ 58 sn, müzik `SOSYAL_MUZIK` yoksa sessiz). Video hatası öğeyi DÜŞÜRMEZ → n8n yalnız `youtube`'u `basarisiz`'a yazar. **X** = `xGruplari` sırasıyla ZİNCİR (ilk gönderi ≤ 4 görsel + altyazı, kalanlar yanıt). `bugun` öğe başına Short için sunucuda ≈ 90 sn uzar (2 vCPU; 6 slayt ölçümü 08.10) → n8n zaman aşımı **10 dk** (rubrik akışında öyle). **LinkedIn** (v6.342, 👤 09.10) = PDF **belge carousel'i** (`lib/rubrik-belge.mjs`: sayfa başına bir onaylı slayt, 1080×1350, kayıpsız; metin YENİDEN ÇİZİLMEZ; başlık `<rubrik adı> · <gün>` yalnız meta/Buffer alanı) → öğede `belge` (`{ad, boyut, sayfa, baslik}` ya da `null`) + `belgeHata`; hata öğeyi DÜŞÜRMEZ (yalnız `linkedin` başarısız).
- **Faz 3 yerleşimi:** n8n KURU akışı `POST /rubrik/bugun?kuru=1` → `gorseller`'i `GET /rubrik/dosya/...` ile indirip arşivler; canlı akış `POST /rubrik/bugun` → kanallara yayın → `POST /rubrik/sonuc`. 07:55 sosyal işi sürerken uç 503 verir → rubrik akışını o pencereden SONRA planla (≥ ~08:10; sosyal iş sunucuda ≈ 4 dk).
- Dağıtım: yeni dosya `lib/rubrik-yayin.mjs` + `server.mjs` (compose değişmez). **Jeton girilmeden dağıtım davranışı DEĞİŞTİRMEZ** (uçlar 503). Aktivasyon (👤 onaylı, ayrı adım): `.env.kart`'a `CONTENT_PLAN_TOKEN` + aynı değer Vercel `doctorium` env'ine + yeniden yayın.
- Testler: `npx vitest run tests/unit/kart-rubrik-yayin.test.ts` — saf yardımcılar · KURU (`bak` ASLA `al`) · canlı (`al`, Türkiye günü, en fazla bir kez) · render hatası/taşma/bozuk model → YAYIN HATASI · Vercel hata eşlemesi · `sonuc` beyaz liste + aktarım · dosya ucu (yalnız listeli) · saklama + sosyal izolasyonu · jeton sızıntısı.

## Üretim özellikleri

- Hikâye: kart 9 sn + içerik başına 12 sn; hareketsiz kare + kesintisiz müzik dilimi; açıklama = seçkideki `summaryLong` (yedek cümle dâhil). Reel A: yalnız başlık + kaynak, 107 BPM vuruş ızgarası (`assets/beatgrid.json`).
- **Reel A kare 0 DOLU (2026-10-07, 👤 "Reel'in ilk karesini doldur"):** giriş (masthead çizgisi + masthead yazısı + "Bugünün N başlığı" + akış satırı) `reelPlan().GIRIS_BITIS` (= 3. vuruş + 0,5 sn ≈ 1,77 sn) ÖNCESİNDE TAMAMLANMIŞ çizilir (`seek` içinde `ti = max(t, GIRIS_BITIS)`; çıkış ve sonrası gerçek `t`).
  Neden: platform küçük resimleri ilk karelerden seçer — X ≈0,17 sn'yi aldı (ölçüldü: poster karesindeki çizgi uzunluğu) ve eskiden kare 0 boş zemin, 0,17 sn yarı çizilmiş çizgi + harf parçalarıydı. Sonuç: video ≈1,8 sn "başlık kartı" ile açılır (yalnız vuruşta nabız atan nokta hareketli); `t ≥ GIRIS_BITIS` kareleri eskisiyle **piksel-aynıdır** (13 örnek ölçüldü) — süre, ses, vuruş eşliği, Instagram `thumb_offset` 1700 ms kapağı ve LinkedIn kesiti (1,7 sn) DEĞİŞMEDİ.
- Instagram şartları: H.264 + AAC · 1080×1920 · 30 fps · `moov` başta · hikâye ≤ 60 sn / ≤ 100 MB, Reel ≤ 90 sn / ≤ 300 MB · hikâye ≈ −18 LUFS, Reel ≈ −16 LUFS · tepe ≤ −1 dBTP. Sunucuda doğrula: `docker compose exec kart node tools/dogrula.mjs /tmp/sosyal/<gün>`.
- Güvenlik kapıları: **yazı tipi yüklenmediyse üretim DURUR** (yedek yazı tipiyle yayın yok) · **ses tepe koruması** (kodlanmış AAC'nin gerçek tepesi ölçülür, aşarsa kazanç düşürülüp yeniden kodlanır) · ffmpeg zaman aşımı (asılı iş kilidi tutmaz).
- Carousel (v6.323): kartla AYNI çizim hattı (Playwright, DPR 1; ffmpeg/Python gerekmez), punto sığdırma hikâye karesiyle aynı döngü (önce başlık, sonra açıklama; asgari 40/32; sığmazsa günlüğe yalnız slayt numarası düşer). Carousel videolardan ÖNCE üretilir (≈8 sn yerel) →
  yazı tipi/tarayıcı sorunu dakikalarca süren videolardan önce ve yüksek sesle (iş `hata`, `adim: carousel`) düşer; slayt sayısı `N+2` değilse iş `hata` verir (eksik carousel yayına gitmez). Instagram: carousel çocukları için herkese açık `image_url` şart (resumable yok) — n8n tarafında ayrı adım.
  Sunucuda doğrula: `docker compose exec kart node tools/dogrula.mjs /tmp/sosyal/<gün>` (PNG imzası · 1080×1350 · ≤ 8 MB). Yerel: `node tools/uret.mjs --only carousel --digest digest.json --card kart.png --out cikti` (müzik/ffmpeg gerekmez).
- LinkedIn videosu (v6.331, 👤 "LinkedIn'in tam video boyutu"): 16:9 YATAY şablon (`reelHtml(…, "yatay")`, 1920×1080; dikeyle AYNI DOM + zaman çizelgesi, yalnız CSS geometrisi ve punto tabanı 120/100/84) ikinci Playwright geçişiyle basılır (`kareleriBas`, kare 51'den = 1,7 sn, Instagram kapağıyla aynı an) + aynı normalize WAV'dan aynı ofsetle ses (mikro fade-in + tepe koruması); x264 medium/CRF 18 (Buffer 1280×720'ye kodlar). Üretilemezse iş YİNE `hazir` (`linkedin: []`, günlükte not) — Instagram yayını engellenmez.
  Doğrulama `tools/dogrula.mjs` LinkedIn satırı: 3 sn–10 dk · ≤500 MB · **1920×1080** · H.264+AAC · moov başta · tepe ≤ −1 dBTP. Maliyet: yatay geçiş ≈ Reel karelerinin %75'i (kare 51'den) → sunucuda tahminen +100–120 sn; gerçek ölçüm dağıtımda `bitti.json` `olcum.reel.linkedin`.
- Maliyet: yerel ölçüm (2 çekirdek + 2 işçi) 4 öğeli gün ≈ 63–66 sn, bellek tepesi ≈ 0,9–1,1 GB. **Sunucu ölçümü (03.10, Hetzner paylaşımlı vCPU):** `POST /sosyal/uret` ≈ 242 sn (hikâye 85 + Reel 156; yerelden ≈3,7× yavaş) → n8n bekleme süresi ≥ 8–10 dk kurulur; bellek tepesi ≈ 719 MiB (`mem_limit: 1536m` içinde).

## Ortam değişkenleri

| Değişken | Varsayılan | Not |
|---|---|---|
| `SOCIAL_DIGEST_TOKEN` | — | `.env.kart`'ta; n8n'e girmez, günlüğe yazılmaz |
| `SOCIAL_DIGEST_URL` | `https://doctorium.tr/api/social-digest` | |
| `CONTENT_PLAN_TOKEN` | — | (v6.335) `.env.kart`'ta; Vercel `doctorium` env'indeki ile AYNI değer; n8n'e girmez, günlüğe yazılmaz. **Boşsa `/rubrik/bugun` + `/rubrik/sonuc` 503 (DORMANT)** |
| `CONTENT_PLAN_URL` | `https://doctorium.tr/api/social-calendar/yayin` | (v6.335) yayın planı ucu |
| `SOSYAL_DIR` | `/tmp/sosyal` | çıktı kökü (konteyner içi geçici) |
| `SOSYAL_MUZIK` | `/varlik/muzik.mp3` | **repoda YOK** (boyut/lisans); sunucuda volume |
| `SOSYAL_ISCI` | `2` | Reel için paralel Chromium sayfası (2 vCPU ölçümü) |
| `X264_PRESET` | `slow` | `medium` yalnız ~3 sn kazandırır → `slow` kalır |
| `FFMPEG_ZAMAN_ASIMI_SN` | `600` | tek ffmpeg adımı için |
| `FFMPEG` · `PLAYWRIGHT_FROM` | — | yalnız yerel deneme (`tools/uret.mjs`) |

## Dosyalar

```
server.mjs              # HTTP + kart şablonu + paylaşılan Chromium (çökerse yeniden açılır); /sosyal/* → lib/sosyal-isleri
lib/sosyal-isleri.mjs   # tek-iş durum makinesi, seçki doğrulaması, dosya ucu (MP4 + PNG + LinkedIn kesiti)
lib/social-video.mjs    # hikâye klipleri + Reel A (+ LinkedIn kesiti) üreticisi (Playwright + ffmpeg)
lib/social-carousel.mjs # kaydırmalı post slaytları: kart + içerikler + kapanış (Playwright, ffmpeg gerekmez)
lib/social-rubrik.mjs   # içerik takvimi rubrik slaytları + POST /rubrik/render (v6.328; Playwright, ffmpeg gerekmez)
lib/rubrik-yayin.mjs    # içerik takvimi YAYIN uçları: /rubrik/bugun · /rubrik/sonuc · /rubrik/dosya (v6.335; Vercel `bak|al|sonuc` istemcisi + çizim + dosya ucu)
lib/rubrik-video.mjs    # rubrik YouTube Short (onaylı PNG → 9:16 MP4, ffmpeg) + X zincir gruplaması (v6.340)
lib/rubrik-belge.mjs    # rubrik LinkedIn PDF belge carousel'i (onaylı PNG → sayfa başına slayt, Chromium page.pdf) (v6.342)
assets/                 # küre görseli (public/brand ile aynı hash — test kilitli) + vuruş ızgarası
tools/uret.mjs          # yerel: digest.json + kart.png + müzik → MP4'ler (+ LinkedIn kesiti) + carousel PNG'leri (--only stories|reel|carousel)
tools/rubrik.mjs        # yerel: model.json (rubrik slaytları) → PNG'ler (v6.328)
tools/dogrula.mjs       # MP4'leri (Instagram + LinkedIn şartları) + carousel PNG'lerini doğrular (çıkış kodu 0/1)
Dockerfile              # playwright:v1.55.0-noble + ffmpeg (npm playwright sürümü imaj etiketiyle AYNI olmalı — test kilitli)
```

## Sunucuya dağıtım (👤 onaylı iş; güvenli pencere 08:10 → ertesi 07:40 TR, 11:30–12:15 HARİÇ)

> 🪤 07:55 sosyal işi 6 öğeli seçkide ≈ 539 sn sürer (07:55 → ≈ 08:05): o sırada konteyner yeniden yaratılırsa render ölür ve günün Reel + hikâye akışı düşer. Rubrik yayını (`/rubrik/bugun`) 12:00'de koşar; yeniden derleme sırasında kart hiç yanıt vermez → 11:30–12:15 arası da takas YAPILMAZ.

Compose'taki `kart:` bloğu (`/opt/n8n/docker-compose.yml`) şu hâle gelir — **yalnız bu blok** değişir, diğer servislere dokunulmaz:

```yaml
  kart:
    build: ./kart
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    env_file:
      - .env.kart
    volumes:
      - ./kart-varlik:/varlik:ro   # müzik: /varlik/muzik.mp3 (dağıtımda kaybolmaz, imaja girmez)
    mem_limit: 1536m               # ≈1,1 GB tepe ölçüldü; paylaşımlı VPS'te n8n'i OOM'dan korur
    shm_size: 1gb                  # Chromium paylaşımlı belleği (çok sayfalı Reel render'ı)
```

1. **Bir kez:** `mkdir -p /opt/n8n/kart-varlik` + `muzik.mp3`'ü oraya koy; `docker-compose.yml` yedeği al, bloğu güncelle, `docker compose config -q` ile doğrula.
2. **Kaynağı gönder** (Git Bash — PowerShell ikili boruyu bozar): `git archive --format=tar HEAD infra/kart | ssh deploy@<sunucu> 'mkdir -p /opt/n8n/kart.yeni && tar -x --strip-components=2 -C /opt/n8n/kart.yeni'`
   — **YOL SINIRLI biçim şart** (`HEAD infra/kart`, `HEAD:infra/kart` DEĞİL): alt ağaç arşivlenince kökteki `.gitattributes` görülmez ve Windows'ta `core.autocrlf=true` çıktıyı CRLF yapar (03.10 ölçüldü: Dockerfile'ın 17 satırının hepsi CR'li; `\` satır devamı Linux'ta bozulur).
   **Satır sonu denetimi ZORUNLU:** `ssh deploy@<sunucu> "tr -cd '\r' < /opt/n8n/kart.yeni/Dockerfile | wc -c"` → `0` olmalı; sıfır değilse DURUN. Küre görseli (webp) ikili olarak bozulmadan gider (bayt eşliği doğrulandı).
3. **Takas:** `mv kart kart.onceki && mv kart.yeni kart`.
4. **Derle + başlat:** `cd /opt/n8n && docker compose up -d --build kart` (🪤 salt `restart` YETMEZ — kod imaja gömülü, volume yok).
5. **Doğrula:** `curl -s 127.0.0.1:3001/saglik` · `curl -s -o /dev/null -w '%{http_code} %{size_download}\n' 127.0.0.1:3001/bulten.png` (kart ucu eskisi gibi; sınama kartı arşive YAZILMAZ) ·
   `curl -s -X POST 127.0.0.1:3001/sosyal/uret` → `/sosyal/durum` ile `hazir` bekle → `tools/dogrula.mjs` → `docker stats --no-stream kart` (bellek).
6. **Geri alma:** `rm -rf kart && mv kart.onceki kart` + compose yedeğini geri koy + `docker compose up -d --build kart` (eski `server.mjs` ve Dockerfile `kart.onceki`'nde durur).

## Yerel deneme

```bash
node tools/uret.mjs --digest digest.json --card kart.png --music muzik.mp3 --out cikti   # FFMPEG=…  PLAYWRIGHT_FROM=…/package.json
node tools/dogrula.mjs cikti
```

`digest.json` jetonlu `/api/social-digest` yanıtıdır (elle kaydedilir; **depoya girmez**), `kart.png` `GET /bulten.png` çıktısıdır.

## Testler

`npx vitest run tests/unit/kart-sosyal-video.test.ts` — ffmpeg/Chromium GEREKMEZ (üretici sahte, HTTP gerçek): tipografi · Reel planı · şablon kaçışı (seçki HTML'e ham girmez) · seçki doğrulaması · tek-iş kilidi (eşzamanlı iki POST) · idempotency ·
yarım işin görünmezliği · dosya ucunda gezinti (`..`, `%2F`) engeli · başarısız `yenile`'de önceki kliplerin korunması · Dockerfile sürüm eşitliği · küre hash'i · `lang="tr"` · kaynakta görünmez karakter yok.
v6.323: carousel şablon kaçışı + kapanış slaydında iddia yok · `renderCarousel` (gerçek modül + sahte tarayıcı: N+2 ad/sıra, kart baytları, sayfa kapanışı) · `gorseller` geriye uyumu (PNG `dosyalar`a GİRMEZ; eski `bitti.json` geçerli) · PNG ucu (listeli-yalnız, gezinti, `bitti.json` yokken 404) · carousel hatasında videoların hiç başlamaması ·
`kapsam.akislar` (sıralı, tekrarsız) · çerçevenin kartla aynı ölçüde kalması.
v6.327: Reel kapanış satırı = `REEL_CTA` ("bio" geçmez) · `LINKEDIN_BASLANGIC_SN` tam kare (51) · `linkedin` sözleşmesi (ayrı dizi, `dosyalar`a GİRMEZ, eski `bitti.json` → `[]`, dosya ucu listeli-yalnız) · kesit üretilemezse iş yine `hazir` + günlük notu · boş günde `linkedin: []`.
v6.331: yatay şablon (1920×1080 CSS, punto tabanı 120/100/84, CSS dışında dikeyle AYNI belge, CTA, "bio" yok, kaçış, bilinmeyen düzen fırlatır) · `LINKEDIN_DUZEN` · `kareleriBas` ([ilk, son) aralığı, mutlak kare adı, işçi düşerse abort + sayfa kapanışı). Yeni bir davranışı sınarken **mutasyonla doğrula** (kodu bilinçli boz → ilgili test düşmeli; betiğin `finally`'de dosyayı geri yüklediğinden emin ol).
2026-10-07: "Reel A — ilk kare DOLU" (4 test): `window.seek` GERÇEK tarayıcı olmadan, yalnız `style` kaydeden minimal DOM ile `vm` içinde çalıştırılır — kare 0'da giriş tamamlanmış (çizgi `scaleX(1)`, masthead opaklığı 1, satırlar `translateY(0%)`, akış satırı 1) ve bu hâl `GIRIS_BITIS`'e dek SABİT · çıkış değişmedi · yatay düzen aynı · `GIRIS_BITIS ≈ LINKEDIN_BASLANGIC_SN`. 9 mutasyonun 9'u yakalandı.

v6.335: `kart-rubrik-yayin.test.ts` — yayın uçları (yukarıdaki "İçerik takvimi YAYIN uçları" bölümünün Testler maddesi); mutasyon provasında 32 mutasyonun hepsi yakalandı (savunma-derinliği ad regex'i için "kurcalanmış marker" testi eklendi).

## Tuzaklar (bedeli ödenmiş)

- `lang="tr"` kart şablonunda ŞART: akış etiketleri CSS ile büyütülür, dil bildirilmezse "AKADEMIK/CIHAZ" çıkar.
- `document.fonts.check()` CSS hiç yüklenmediyse de `true` döner → yazı tipi kapısı YÜKLENMİŞ `FontFace`'leri sayar.
- Hareketsiz 2× PNG her karede yeniden ölçeklenirse hikâye klibi 18 → 52 sn'ye şişer → bir kez ölçeklenir.
- Yerel AAC kodlayıcısı kaynak WAV güvenli olsa da tepe aşabilir (+0,3 dBTP görüldü) → kodlanmış dosya ölçülür.
- Kaynakta `\uXXXX` YAZMA (araçlar gerçek karaktere çevirebilir): NBSP `String.fromCharCode` ile.
- Node: `pipe`/`pipeline` ile akıtılan yanıtın keep-alive soketi "boşta" sayılmaz → test sunucusu `closeAllConnections()` ile kapatılır.
- (v6.323) Yeni bir çıktı türünü `dosyalar`a EKLEME: çalışan istemci (n8n) o listedeki her öğeyi MP4 sayar. Yeni tür = ayrı dizi (`gorseller`) + ayrı ad kalıbı + dosya ucunda tür başına kendi listesi.
- (v6.327) MP4 olsa bile `dosyalar`a EKLEME: 07:55 akışı oradaki her MP4'ü indirip arşivler, `Yayın listesi` yalnız hikâye+reel'i süzer — yine de ayrı dizi (`linkedin`) daha güvenli; `AD_RE`'ye uyan yeni ad kalıbı `dosyalariListele`de açıkça DIŞLANMALI.
- (v6.327) Reel kapanış satırına "bio" YAZMA: aynı MP4 LinkedIn'e de gider (Buffer); adres metni (`doctorium.tr/secki`) iki platformda da doğrudur.
- (v6.331) Yatay şablon dikeyden KIRPILMAZ/ÖLÇEKLENMEZ (9:16 LinkedIn masaüstünde yan boşluklu kalıyordu): aynı DOM, ayrı CSS (`REEL_CSS.yatay`) + punto tabanı (`REEL_FS`). Yeni düzen = ikisine de giriş + şablon testi; `data-fs` ölçek değil yerleşimle sığdırılır.
- (2026-10-07) Giriş animasyonunu yeniden "sıfırdan çizen" bir değişiklik (ör. `seek`te `ti`'yi kaldırmak) kare 0'ı yine boş bırakır ve X küçük resmini yarım kareye çevirir (X poster'ı API'den AYARLANAMAZ, ≈0,17 sn'yi kendisi seçer) — test kilitli. Kare 0'ı doldurmak ses/zaman çizelgesini KAYDIRMAZ (video 1,7 sn'den başlatmak ya da `thumb_offset` oynamak n8n akışlarını da etkilerdi); `GIRIS_BITIS`'i uzatırsan Instagram kapağı/LinkedIn kesiti (1,7 sn) ile kare 0'ın aynı görüntü olduğu varsayımını yeniden düşün (test: fark ≤ 0,1 sn).
- (v6.323) Sığdırma ölçümü `getBoundingClientRect` ile yapılır: flex `justify-content:center` içinde taşma iki uca dağılır, `scrollHeight` taşmayı SAYMAZ.
- (v6.323) Karttaki çerçeve (`padding:72px 84px 64px`, 3px üst çizgi, 22px künye) `server.mjs` ve `social-carousel.mjs`'te AYNI tutulur — slayt 1 kartın kendisi; test ikisini birlikte denetler.
- (v6.335) Rubrik yayın dosyalarını sosyal işinin gün klasörüne (`<SOSYAL_DIR>/<gün>/`) KOYMA: 07:55 işi `hazirlik`ta o klasörü siler. Ayrı ağaç `<SOSYAL_DIR>/rubrik/<gün>/` (sosyal modülü `GUN_RE` ile yalnız gün klasörlerini sayar → `rubrik` dizini görünmez; testle kilitli).
- (v6.335) `gunGecerli` yalnız regex + `toISOString` karşılaştırmasıyla YAZILMAZ: `2026-13-01` gibi taşan ay `Invalid Date` üretir ve `toISOString()` fırlatır (`?gun=` 400 yerine 500 verirdi). Önce `getTime()` NaN denetimi (testle kilitli).
- (v6.335) `al` ağ zaman aşımı = DURUM BİLİNMİYOR: Vercel içerik almış olabilir. Kart bunu `502 belirsiz:true` ile işaretler; n8n yeniden `bugun` ile "düzeltmeye" çalışmaz (en fazla bir kez kuralı) — insan Vercel panelinden çözer.
