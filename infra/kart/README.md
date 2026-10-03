# `infra/kart/` — Doctorium kart + sosyal video servisi

Hetzner `doctorium-n8n` VPS'inde (n8n ile **aynı compose**, `/opt/n8n/`) çalışan `kart` servisi. **Vercel'e / Next uygulamasına girmez**; n8n akışları HTTP ile çağırır.
Eskiden yalnız `server.mjs` sunucuda duruyordu (scp ile düzenleniyor, kurtarılması zordu); v6.320'de depoya alındı → sürümlü + testli.

İki iş yapar:

1. **`GET /bulten.png`** — her sabah 07:45 TR n8n'in çağırdığı TAM BÜLTEN kartı (1080×1350 PNG). Seçkiyi servis KENDİSİ çeker (jeton yalnız `.env.kart`'ta; n8n görmez). Boş gün → `204`. **v6.320'de değişmedi.**
2. **`/sosyal/*` (v6.320)** — aynı seçkiden Instagram **hikâye klipleri** (kart + her içerik için 1) ve **Reel A** (vuruşa oturan tipografik video) MP4'leri üretir.

## Uçlar

| Uç | Yanıt |
|---|---|
| `POST /sosyal/uret[?yenile=1]` | **202** üretim başladı · **200** o günün klipleri zaten HAZIR (idempotent) ya da boş gün (`bos_gun:true`) · **409** başka iş sürüyor · **502** seçki alınamadı/geçersiz (`summaryLong` yoksa dâhil) · **503** müzik dosyası yok |
| `GET /sosyal/durum` | `{durum: "bos"\|"calisiyor"\|"hazir"\|"hata", gun, …}` — `hazir`: `dosyalar[{ad,boyut,tur,sira}]`, `kapsam{ogeSayisi,yedekSayisi}`, `sure_sn`; `calisiyor`: `asama`, `gecen_sn`; `hata`: `hata`, `adim` |
| `GET\|HEAD /sosyal/dosya/<YYYY-AA-GG>/<ad>.mp4` | MP4 (`video/mp4`) — yalnız TAMAMLANMIŞ günün, `bitti.json`'da listeli dosyaları |
| `GET /saglik` · `GET /bulten.png` | eskisi gibi |

`dosyalar[].tur` = `hikaye` (`sira` = klip numarası, 1 = kart) ya da `reel`. n8n akışı: `POST /sosyal/uret` → `GET /sosyal/durum` ile `hazir` bekle (**`gun` alanını kendi beklediği günle karşılaştır**) → dosyaları indir → arşive yaz.

**Tasarım:** tek iş (ikinci POST kuyruğa girmez, 409) · kilit seçki çekilmeden ÖNCE alınır · kart + hikâyeler + Reel AYNI seçki anlık görüntüsünden üretilir · yarım iş görünmez (`bitti.json` EN SON, atomik) ·
hata → üretim başladıysa gün klasörü silinir; **başlamadan düşen** `yenile` (ör. müzik yok) önceki iyi klipleri korur · en yeni 2 gün klasörü saklanır (kalıcı arşivi n8n yazar).

## Üretim özellikleri

- Hikâye: kart 9 sn + içerik başına 12 sn; hareketsiz kare + kesintisiz müzik dilimi; açıklama = seçkideki `summaryLong` (yedek cümle dâhil). Reel A: yalnız başlık + kaynak, 107 BPM vuruş ızgarası (`assets/beatgrid.json`).
- Instagram şartları: H.264 + AAC · 1080×1920 · 30 fps · `moov` başta · hikâye ≤ 60 sn / ≤ 100 MB, Reel ≤ 90 sn / ≤ 300 MB · hikâye ≈ −18 LUFS, Reel ≈ −16 LUFS · tepe ≤ −1 dBTP. Sunucuda doğrula: `docker compose exec kart node tools/dogrula.mjs /tmp/sosyal/<gün>`.
- Güvenlik kapıları: **yazı tipi yüklenmediyse üretim DURUR** (yedek yazı tipiyle yayın yok) · **ses tepe koruması** (kodlanmış AAC'nin gerçek tepesi ölçülür, aşarsa kazanç düşürülüp yeniden kodlanır) · ffmpeg zaman aşımı (asılı iş kilidi tutmaz).
- Maliyet (yerel ölçüm, 2 çekirdek + 2 işçi): 4 öğeli gün ≈ 63–66 sn, bellek tepesi ≈ 0,9–1,1 GB.

## Ortam değişkenleri

| Değişken | Varsayılan | Not |
|---|---|---|
| `SOCIAL_DIGEST_TOKEN` | — | `.env.kart`'ta; n8n'e girmez, günlüğe yazılmaz |
| `SOCIAL_DIGEST_URL` | `https://doctorium.tr/api/social-digest` | |
| `SOSYAL_DIR` | `/tmp/sosyal` | çıktı kökü (konteyner içi geçici) |
| `SOSYAL_MUZIK` | `/varlik/muzik.mp3` | **repoda YOK** (boyut/lisans); sunucuda volume |
| `SOSYAL_ISCI` | `2` | Reel için paralel Chromium sayfası (2 vCPU ölçümü) |
| `X264_PRESET` | `slow` | `medium` yalnız ~3 sn kazandırır → `slow` kalır |
| `FFMPEG_ZAMAN_ASIMI_SN` | `600` | tek ffmpeg adımı için |
| `FFMPEG` · `PLAYWRIGHT_FROM` | — | yalnız yerel deneme (`tools/uret.mjs`) |

## Dosyalar

```
server.mjs              # HTTP + kart şablonu + paylaşılan Chromium (çökerse yeniden açılır); /sosyal/* → lib/sosyal-isleri
lib/sosyal-isleri.mjs   # tek-iş durum makinesi, seçki doğrulaması, dosya ucu
lib/social-video.mjs    # hikâye klipleri + Reel A üreticisi (Playwright + ffmpeg)
assets/                 # küre görseli (public/brand ile aynı hash — test kilitli) + vuruş ızgarası
tools/uret.mjs          # yerel: digest.json + kart.png + müzik → MP4'ler
tools/dogrula.mjs       # MP4'leri Instagram şartlarına karşı doğrular (çıkış kodu 0/1)
Dockerfile              # playwright:v1.55.0-noble + ffmpeg (npm playwright sürümü imaj etiketiyle AYNI olmalı — test kilitli)
```

## Sunucuya dağıtım (👤 onaylı iş; sabah akışını kesmemek için 07:40–07:55 TR DIŞINDA)

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

## Tuzaklar (bedeli ödenmiş)

- `lang="tr"` kart şablonunda ŞART: akış etiketleri CSS ile büyütülür, dil bildirilmezse "AKADEMIK/CIHAZ" çıkar.
- `document.fonts.check()` CSS hiç yüklenmediyse de `true` döner → yazı tipi kapısı YÜKLENMİŞ `FontFace`'leri sayar.
- Hareketsiz 2× PNG her karede yeniden ölçeklenirse hikâye klibi 18 → 52 sn'ye şişer → bir kez ölçeklenir.
- Yerel AAC kodlayıcısı kaynak WAV güvenli olsa da tepe aşabilir (+0,3 dBTP görüldü) → kodlanmış dosya ölçülür.
- Kaynakta `\uXXXX` YAZMA (araçlar gerçek karaktere çevirebilir): NBSP `String.fromCharCode` ile.
- Node: `pipe`/`pipeline` ile akıtılan yanıtın keep-alive soketi "boşta" sayılmaz → test sunucusu `closeAllConnections()` ile kapatılır.
