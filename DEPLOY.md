# Vercel'e Deploy Kılavuzu

Bu uygulama **Vercel** (Next.js) + **Neon Postgres** üzerinde **canlıda** çalışır:
**https://telehealth-mvp-roan.vercel.app** · GitHub `airburakk/telehealth-mvp` (`main`) →
Vercel otomatik deploy.

> **Durum:** kurulum tamamlandı. Şema zaten `postgresql` (`prisma/schema.prisma`); yerel ve
> üretim **aynı** Neon DB'sini kullanır (SQLite kullanılmaz). Bu belge, sıfırdan benzer bir
> kurulum yapmak veya ortam değişkenlerini yönetmek için referanstır.

## Akış (özet)

1. **Neon** Postgres veritabanı (pooled + direct connection string).
2. **`.env`** doldur (aşağıdaki tablo) → `npx prisma migrate deploy` → `npm run db:seed`.
3. **GitHub**'a push → **Vercel**'de import → env değişkenleri → Deploy (otomatik).
4. Sonraki her `git push origin main` → Vercel otomatik yeniden deploy.

---

## Adım 1 — Neon Postgres (ücretsiz)

1. https://neon.tech → ücretsiz hesap → yeni proje
2. İki connection string al:
   - **Pooled** (`-pooler` içerir) → `DATABASE_URL` (uygulama çalışma zamanı)
   - **Direct** (havuzsuz) → `DIRECT_URL` (migration / `db push`; yalnız CLI)
3. ⚠️ **`DATABASE_URL`'in sonuna `&connect_timeout=15` ekle** (v6.15, 2026-07-16 — atlanırsa
   üretimde aralıklı 500'ler üretir):

   ```
   ...neondb?sslmode=require&channel_binding=require&connect_timeout=15
   ```

   **Neden:** Neon boşta compute'u sıfıra indirir (scale-to-zero). Uyanması Prisma'nın **varsayılan
   5 sn**'lik connect timeout'unu aşınca `PrismaClientInitializationError: Can't reach database
   server` fırlar. **Belirti aralıklıdır** — haftada birkaç kez, sonra kendiliğinden düzelir ⇒ kalıcı
   kesinti gibi görünmez, gözden kaçar (2026-07-16'da canlıda böyle yakalandı: digest `2661872092`).
   ⚠️ Env değişikliği **yalnız yeni deployment'ta** etkin → değiştirdikten sonra **redeploy** şart.

   **🪤 Teşhis tuzağı:** host'un 5432 portunun açık olması DB'yi ayakta **kanıtlamaz** — ayakta olan
   Neon'un **paylaşılan pooler**'ıdır; arkadaki compute askıda olabilir. Gerçek kanıt: salt-okunur
   `SELECT 1`.

## Adım 2 — Şema + demo veri

Şema zaten Postgres olduğu için sağlayıcı değiştirmeye gerek yok:

```bash
npx prisma migrate deploy   # migration geçmişini Neon'a uygula (taze DB'de tüm şemayı kurar)
npm run db:seed             # demo veri: kullanıcılar + 30 hekim + 20 vaka + takip + şikayet
```

> **Şema yönetimi migration-tabanlıdır** (2026-07-03'ten beri; `prisma/migrations/` —
> `20260703000000_baseline` mevcut üretim şemasını temsil eder, üretime `migrate resolve
> --applied` ile işaretlenmiştir). **Üretime şema değişikliği akışı:**
> 1. `schema.prisma`'yı düzenle → `npx prisma migrate diff --from-schema-datamodel <eski>
>    --to-schema-datamodel prisma/schema.prisma --script` ile migration SQL üret (veya Neon
>    dev branch'e karşı `migrate dev`), `prisma/migrations/<timestamp>_<ad>/migration.sql`e koy.
> 2. Önce **Neon dev branch'te prova**: `DATABASE_URL` + `DIRECT_URL` **birlikte**
>    `TEST_DATABASE_URL` değerine override edilerek `npx prisma migrate deploy`.
> 3. Üretim: `npx prisma migrate status` ile bekleyen migration'ı doğrula → `npm run
>    db:migrate`. Kestirme (2026-07-24): **`node scripts/apply-prod-migration.mjs`** — .env'deki
>    `PROD_DATABASE_URL`/`PROD_DIRECT_URL` ile status+deploy'u tek komutta, kabuk-bağımsız koşar
>    (cmd/PowerShell/bash aynı; env override elle kurulmaz). Migration SQL'ini idempotent yaz
>    (`IF EXISTS`/`IF NOT EXISTS`) — yarıda düşen migration `_prisma_migrations`'a failed kayıt
>    bırakır ve sonraki deploy'ları kilitler (kurtarma: `migrate resolve --rolled-back`).
>
> ⚠️ `prisma db push` üretimde **artık kullanılmaz** (DB'yi şemaya eşitlerken migration
> geçmişini atlar; eski şemalı bir çalışma kopyasından koşulursa yeni index'leri düşürür).
> `db push` yalnız Neon dev/test branch'lerinde hızlı deneme için kabul edilebilir.
>
> **Sıralama kuralı değişiklik TİPİNE bağlı:** yeni nullable kolon = **migration-önce**
> (eski kod etkilenmez) · kolonu nullable'a çevirme = **kod-önce** (eski kod null yazamasın).
> **RENAME COLUMN = KOORDİNELİ** (iki yön de kırılgan): iki aşama uygula — (A) Prisma alanını
> `@map("eskiAd")` ile yeniden adlandır (kod tam yeni adla, DB'siz, güvenli deploy); (B) ayrı
> commit'te RENAME migration + `@map` temizliği: push → yeni deployment'ın canlıya geçtiği ANI
> yakala (örn. silinen bir shim ucunun 404'e dönmesini poll'la) → `migrate deploy`'u ANINDA koş
> (kırık pencere saniyelere iner; düşük trafik saati seç; ters-RENAME SQL'i hazır tut).
> Örnek: v4.21 `20260704120000_free_care_rename` (8× RENAME + index + veri UPDATE, idempotent DO-bloklu).

### Cron — HealthTürkiye günlük senkronu (2026-07-10)

`vercel.json` günde bir (03:00 UTC) `/api/cron/registry-sync`'i tetikler (doktor + tesis dizini
diff + günlük rapor). Çalışması için Vercel ortam değişkenlerine **`CRON_SECRET`** eklenmeli
(yerel `.env`'deki değerle AYNI olmalı; Vercel bu değişken tanımlıysa cron isteğine otomatik
`Authorization: Bearer` başlığı ekler — yoksa uç 503 döner, site etkilenmez). İlk tam çekim
`npx tsx scripts/registry-sync.ts` ile elle koşulabilir (2026-07-10'da koşuldu). Fonksiyon
`maxDuration=300` ister (Fluid compute — bu projede varsayılan açık).

Senkron sonrası aynı cron, tesis **detay zenginleştirmesi** de yapar (languages/accreditations/
facilities adları + `authorizationNumber` [sağlık turizmi yetki belge no] — sitenin `_next/data`
SSR JSON'undan; buildId koşu başında anasayfadan çözülür): günde 40 tesislik bütçe, yalnız
`languages IS NULL` satırlar. İlk toplu doldurma `npx tsx scripts/registry-enrich.ts` ile elle
koşulur (2026-07-10'da ~4.600 tesis dolduruldu); `authorizationNumber` kolon backfill'i için
`npx tsx scripts/registry-enrich.ts auth` (v5.2'de koşuldu).

### Cron — saklama süresi dolan kayıtların imhası (v6.11, 2026-07-15)

`vercel.json` günde bir (03:30 UTC) `/api/cron/purge-deleted`'i tetikler. Aynı `CRON_SECRET` Bearer
deseni (registry-sync ile ortak; yoksa uç 503, site etkilenmez). Batch: 50 kayıt/gün — kalanı ertesi
gün alınır (idempotent; yalnız `purgeAfter <= now`).

**Bu cron silme akışının SÖZÜNÜ TUTAN parçasıdır.** Hasta hesabını sildiğinde klinik kayıt yasal
yükümlülük gereği saklanır ama erişime kapanır (`deletionLockedAt`); `RETENTION_YEARS` (**20**,
`lib/account-deletion.ts` — tek sabit) dolunca kaydı **fiziken** siler. **Cron devre dışı kalırsa
"süre sonunda imha edilir" beyanı boş vaade döner** → `CRON_SECRET`'ın üretimde tanımlı olduğunu
doğrula. Elle: `curl -H "Authorization: Bearer $CRON_SECRET" <site>/api/cron/purge-deleted`.

### İşlem bölgesi — `fra1` (v6.10, 2026-07-15) ⚠️ VERİ İKAMETGÂHI

`vercel.json` `"regions": ["fra1"]` (Frankfurt). **Neon veritabanı `eu-central-1` = Frankfurt** →
işlem ve veri **aynı yerde**: PHI uçtan uca AB'de kalır + DB gecikmesi düşer. Öncesinde Vercel
varsayılanı `iad1` (Washington DC) idi → veri AB'de saklanıp **ABD'de işleniyordu**.

⚠️ **Bölgeyi değiştirmeden ÖNCE Neon bölgesini kontrol et** — ikisi ayrı düşerse hem gecikme hem
uluslararası aktarım yükü geri gelir. AB dışına taşımak KVKK/GDPR aktarım analizi gerektirir.
Doğrulama: deploy metadata `regions:["fra1"]` **veya** yanıt başlığı `X-Vercel-Id: fra1::fra1`.

Senkron ayrıca **alan-güncellemesi** yapar (v5.4): liste-API alanlarının hash'i (`fingerprint`)
satırda tutulur, yalnız hash'i değişen kayıtlar güncellenir (tavan 1000/koşu; aşım = rapor notu,
o koşuda atlanır). İlk fingerprint doldurması `npx tsx scripts/registry-fingerprint-backfill.ts`
(v5.4'te koşuldu; kaynağa istek atmaz, DB değerlerinden hesaplar). null-fingerprint satırlar
karşılaştırılmaz — backfill koşulmadan alan-güncelleme fiilen kapalıdır.

## Adım 3 — GitHub'a gönder

```bash
git add <degisen-dosyalar>     # .env gitignore'da; git add -A yerine seçici stage önerilir
git commit -m "..."
git push origin main
```

## Adım 4 — Vercel'e import et

1. https://vercel.com → **Add New → Project** → GitHub repo'yu seç
2. Framework otomatik **Next.js** algılanır (ayar gerekmez)
3. **Environment Variables** ekle (aşağıdaki tablo)
4. **Deploy** — build'de `prisma generate` otomatik çalışır (`package.json` `build` + `postinstall`)

---

## Ortam değişkenleri

`.env.example` şablondur. **Zorunlu** olmayanlar boşken uygulama yine çalışır (ilgili özellik
dormant kalır / fallback'e düşer).

| Anahtar | Zorunlu | Açıklama |
|---------|:------:|----------|
| `DATABASE_URL` | ✅ | Neon **pooled** connection string |
| `DIRECT_URL` | ✅ | Neon **direct** connection string (migration; `migrate deploy/resolve` bunu kullanır) |
| `SESSION_SECRET` | ✅ | JWT imzalama — `openssl rand -base64 32` |
| `DATA_ENCRYPTION_KEK` | ✅ | At-rest alan şifreleme KEK'i (E2EE Faz 1) — **AKTİF** (2026-06-23 üretimde set + backfill → klinik veri şifreli; **silmek/değiştirmek prod'u bozar**). `openssl rand -base64 32`. **Ortam-başına AYRI değer (Ray B2, 2026-07-16):** yerel `.env` = dev branch + dev KEK'i; üretim KEK'i yalnız Vercel'de (yerelde `PROD_DATA_ENCRYPTION_KEK` adıyla, bilinçli işlemler için). ⚠️ Kayıp = veri kaybı (escrow/yedek). Rotasyon: `scripts/rotate-kek.ts` + runbook (aşağıdaki escrow bloğu) |
| `ANTHROPIC_API_KEY` | ⛅ | Claude (triyaj/SOAP/epikriz/çeviri/vision). Yoksa triyaj kural tabanlıya düşer |
| `GEMINI_API_KEY` | ⛅ | Gemini Live tercüman. Yoksa canlı tercüme dormant |
| `CF_TURN_KEY_ID` | ⛅ | WebRTC TURN relay **birincil** — Cloudflare Realtime TURN Key ID (dash.cloudflare.com → Realtime → TURN Keys) |
| `CF_TURN_API_TOKEN` | ⛅ | Cloudflare TURN API Token (yukarıdakiyle birlikte; oluşturmada bir kez gösterilir) |
| `METERED_API_KEY` | ⛅ | WebRTC TURN relay **yedek** (Metered; CF yoksa/düşerse). Hepsi yoksa STUN/OpenRelay fallback |
| `METERED_DOMAIN` | ⛅ | Metered hesap alan adı (yukarıdakiyle birlikte) |
| `VAPID_PUBLIC_KEY` | ⛅ | Web Push — `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ⛅ | Web Push gizli anahtar |
| `VAPID_SUBJECT` | ⛅ | `mailto:...` |
| `BLOB_READ_WRITE_TOKEN` | ⛅ | **Vercel Blob** object storage (PHI belgeleri — diploma/MMSS/lab/SO ekleri; bytes upload öncesi şifrelenir → Blob yalnız ciphertext). Kur: Vercel → **Storage → Create Database → Blob** → token'ı buraya. **Boşsa:** belgeler şifreli base64 olarak DB'de (fallback, çalışır ama satır şişer). Token sonradan eklenince eski satırlar: `npx tsx scripts/migrate-docs-to-blob.ts` |
| `TSA_SECRET` | ✅ | Simüle RFC 3161 zaman damgası HMAC sırrı (onam/audit kanıt token'ları — `lib/timestamp.ts`). ⚠️ **Üretimde ZORUNLU (v4.11):** eksik/varsayılan/<16 karakter ise uygulama **boot'ta durur** (SESSION_SECRET ile aynı desen). `openssl rand -base64 32` — yerel `.env` ile AYNI değer; eski (sır öncesi) kayıtlar legacy sırla doğrulanmaya devam eder |
| `BLOB_ACCESS` | ➖ | Vercel Blob erişim düzeyi override'ı (`lib/storage.ts`). Boş/varsayılan = `private` (PHI için doğru). `public` **yalnız** PHI-dışı içerik için |
| `ABLY_API_KEY` | ⛅ | WebRTC sinyalleşme Ably realtime birincil kanalı (`lib/ably-server.ts`; format `appId.keyId:secret`). **Boşsa:** Ably devre dışı → sinyalleşme DB-poll yedeğiyle çalışır (kırılmaz, gecikme artar). Anahtar YALNIZ sunucuda; istemci kanala-özel yalnız-subscribe token alır. ⚠️ Transkript (PHI) Ably'ye gitmez. Kur: Ably paneli → API Keys → değeri buraya (Production+Preview, Sensitive) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ⛅ | **Upstash Redis** — dağıtık rate-limit (`lib/rate-limit.ts`: login 10/5dk/IP · paylaşım-şifre 10/5dk/IP+link · AI 20/dk/kullanıcı). **Boşsa:** in-memory yedek (kırılmaz; serverless'ta instance-başına en-iyi-çaba). Upstash hatasında fail-open → in-memory. Kur: console.upstash.com → Redis Database → REST API iki değeri buraya + Vercel (Production+Preview, Sensitive). Vercel Marketplace `KV_REST_API_*` adları da tanınır |
| `GOOGLE_CLIENT_ID` | ⛅ | Google ile giriş/kayıt (M5). Boşsa "Google ile devam et" dormant; e-posta kaydı çalışır. Yetkili yönlendirme: `<origin>/api/auth/google/callback` |
| `GOOGLE_CLIENT_SECRET` | ⛅ | Google OAuth gizli anahtarı (yukarıdakiyle birlikte) |
| `RESEND_API_KEY` | ⛅ | E-posta gönderimi + **e-posta doğrulama** (v5.6, `lib/email.ts`). **Boşsa dormant:** gönderim simüle edilir VE yeni-kayıt doğrulama zorunluluğu devreye girmez (akış bugünkü gibi). Etkinleşince yeni e-posta kayıtları doğrulama bağlantısı almadan giriş yapamaz (mevcut/demo muaf; Google doğrulanmış sayılır). Kur: resend.com → API Key (Sensitive; sır aktarımı bash `printf` ile — CRLF tuzağı) |
| `EMAIL_FROM` | ➖ | Gönderici adresi (ör. `AURA <no-reply@ornek.com>`; Resend'de domain DNS doğrulaması ister). **Boşsa** Resend test göndericisi (`onboarding@resend.dev` — yalnız hesap sahibinin adresine gönderir, test içindir) |
| `TRIAGE_MODEL` | ➖ | Opsiyonel — triyaj modeli (varsayılan `claude-sonnet-4-6`) |

> ✅ zorunlu · ⛅ özellik için gerekli (yoksa fallback) · ➖ opsiyonel.
> **Yeni env eklenince Vercel'de redeploy gerekir** (boş commit ile tetiklenir). Vercel env'lerini
> panelden **kullanıcı** ekler (asistanın erişimi yok).

---

## Doğrulama

- **CI kapısı (P0 #4):** `.github/workflows/ci.yml` her push/PR'da `prisma generate` + `tsc --noEmit`
  + `npm test` (birim, DB'siz) + `npm run lint` çalıştırır. Entegrasyon/E2E secret (`TEST_DATABASE_URL`)
  eklenince açılır (workflow'da yorumlu). **Öneri:** GitHub branch protection ile CI yeşil olmadan
  main'e merge/deploy engellensin (Vercel bozuk build'i zaten durdurur ama testleri/tsc'yi durdurmaz).
- **Deploy öncesi (elle):** `npm test` (birim — DB yok) + `npx tsc --noEmit` + `npm run build` → hepsi EXIT 0.
  Entegrasyon (`npm run test:integration`) + E2E (`npm run test:e2e`) için ayrı **Neon dev branch**
  (`TEST_DATABASE_URL`) gerekir; prod'a karşı **çalıştırma** (yerel `.env` üretim Neon'a bağlı) —
  bkz. `tests/integration/README.md` + `tests/e2e/README.md`.
- Canlı URL'de `/giris` → demo girişleri (parola `1234`): `hasta@` · `doktor@` · `koordinator@` · `kurul@` · `partner@air.test`
- `/` landing · `/triyaj` · `/doktor` · `/operasyon` · `/etik-kurul` → rol bazlı erişim
- Giriş sonrası `/onam` KVKK kapısı bir kez görünür

## Yedekleme / Felaket Kurtarma (DR)

> Canlı gerçek PHI taşıyan bir uygulama için **zorunlu operasyonel disiplin** (denetim P0 #5).
> Kod değil süreç: aşağıdaki adımları kullanıcı/operatör uygular ve düzenli doğrular.

- **Veritabanı yedeği (Neon):** Neon konsolunda **Point-in-Time Restore (PITR)** penceresini doğrula
  (plan retention'ına göre). Kurtarma provası: bir **dev branch**'i belirli bir ana geri sar (restore),
  bütünlüğü kontrol et. ⚠️ Yerel + üretim **aynı** Neon DB olduğundan (bkz. üst not) staging yok — bir
  an önce ayrı üretim DB + staging branch ayrımı önerilir.
- **✅ Son PITR provası: 2026-07-03 (neonctl ile, GEÇTİ).** Runbook (kanıtlı adımlar):
  1. `npx neonctl branches create --project-id old-credit-34860036 --name pitr-<tarih> --parent "<ISO-zaman>"`
  2. `npx neonctl connection-string pitr-<tarih> --project-id old-credit-34860036` → salt-okuma bütünlük
     kontrolü (tablo sayıları + son audit kaydı < restore noktası — zaman-yolculuğu kanıtı)
  3. Gerçek felakette: Vercel'de `DATABASE_URL`/`DIRECT_URL`'i yeni branch endpoint'ine çevir + redeploy
  4. Prova bitince branch'i sil (`neonctl branches delete`)
  Prova sonucu: 07:00Z anına dönüş ~1 dk'da hazır; 46 vaka / 31 doktor / 6 kullanıcı / 28 audit satırı eksiksiz.
  ⚠️ **BULGU: mevcut planda retention penceresi yalnız 6 SAAT** (öncesi reddedilir: "timestamp is before
  retention window"). Bozulma 6 saatten geç fark edilirse PITR YETİŞMEZ → plan yükseltme (7-30 güne
  çıkarma) değerlendirilmeli; en azından kritik değişiklik öncesi manuel dump (`pg_dump`) alınmalı.
- **KEK escrow (KRİTİK):** `DATA_ENCRYPTION_KEK` **kaybı = tüm klinik verinin geri döndürülemez kaybı**
  (at-rest şifreli). KEK'i **en az iki bağımsız güvenli konumda** sakla (ör. parola kasası/secret manager
  + çevrimdışı şifreli kopya). **Rotasyon aracı VAR (2026-07-17):** `scripts/rotate-kek.ts` — içerik
  çözülmeden yalnız DEK sarımı değişir; dry-run varsayılan, prod için `ALLOW_PROD_KEK_ROTATION=1` şart;
  dev tam-tur provası yapıldı. Adım adım runbook: vault `wiki/yonetisim/sir-envanteri.md` §3.1.
  ⚠️ Rotasyon sonrası **eski KEK imha edilmez, arşivlenir** (PITR/yedek restore eski sarımları getirir).
  Aynı disiplin `SESSION_SECRET` ve `TSA_SECRET` için de geçerli.
- **Gizli anahtar envanteri:** Vercel'deki tüm env değişkenlerinin (KEK/SESSION_SECRET/TSA_SECRET/API
  anahtarları) nerede escrow'landığı tek bir güvenli belgede tutulmalı; personel değişiminde erişim gözden geçirilir.
- **Doğrulama kadansı:** PITR restore provası + KEK erişim testi periyodik (ör. üç ayda bir) tekrarlanmalı;
  "yedek var" varsayımı değil, **geri yükleme kanıtı** esastır.

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın, güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı; tüm API anahtarları yalnız sunucuda.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri (DPA/SCC) + uygun bölge
  (AB/TR) + AI sağlayıcı aktarım güvenceleri gerekir (bkz. vault `wiki/kavramlar/` + `wiki/platform-mimarisi.md`).

## Yayın kabul checklist'i (v6.20+, launch-gate 10 gereği)

Her push/deploy öncesi (sıra önemli):

1. **Doğrulama:** `npx tsc --noEmit` 0 · `npx vitest run` yeşil · `npm run build` EXIT 0
   (⚠️ dev server kapalı — prisma generate EPERM) · gerekiyorsa lint.
2. **Metin değiştiyse:** vault `wiki/yonetisim/iddia-kaydi.md` kontrolü — yasak ifade taraması
   (uçtan uca şifreli · akredite · determinist AI · ölçülmemiş metrik · WCAG beyanı) +
   **meta/OG/JSON-LD ayrı taranır** (görünür metin yetmez) + 8 dilin HEPSİ hizalanır (EN'e bakıp
   "tutarlı" sanma). Vitrin title/h1/CTA değiştiyse `scripts/synthetic-checks.mjs` beklentileri
   de güncellenir (yoksa sentetik kontrol yanlış alarm üretir — Ray C).
3. **Terminoloji:** hasta yüzü "başvuru" (vaka değil) · "Doktor" (Hekim değil) · "Access Care"
   yalnız EN · klinik personel yüzeyinde "vaka" kalır.
4. **Push kapsamı:** `git fetch` + `git log origin/main..HEAD` — paralel oturum commit'i taşınmıyor
   mu? Kapsam kontrolü ile push AYRI adım (zincirleme `&&` yok).
5. **Deploy sonrası:** Vercel state READY + doğru SHA · prod smoke: `node scripts/synthetic-checks.mjs`
   (8 rota durum/title/h1/CTA/noindex + TLS + asset — eski elle 200 listesi bunun alt kümesi) +
   ayrıca `/v2` `/trust` 308 ve `X-Vercel-Id: fra1::fra1` teyidi · değişen metin canlıda örneklenir
   (korumalı rota deploy-sinyali YAPILMAZ). Sürekli nöbet zaten GitHub Actions'ta (~30 dk,
   `.github/workflows/synthetic.yml`; düşen koşu e-posta bildirir).
6. **Belge senkronu:** vault mvp/changelog/todo/log + kod repo README/DEPLOY sürüklenmesi
   (CLAUDE.md kapanış protokolü).

## Ortam ayrımı (Ray B, launch-gate 3 — 2026-07-16)

**Hedef durum:** üretim · geliştirme · test ayrı veritabanları + ortam-başına ayrı anahtarlar
(KEK/SESSION_SECRET). Durum (2026-07-16): **ÜÇ KATMAN AYRI** — üretim (`production` branch) ·
geliştirme (`development` branch) · test (`test` branch, `TEST_DATABASE_URL`).

**B1 — DB guard (AKTİF):** `src/lib/db.ts` üretim-dışı bir süreç (next dev, tsx script) üretim
endpoint'ine bağlanırken YÜKSEK SESLE uyarır. Kurulum (yerel `.env`, zorunlu):

1. `PROD_DB_FINGERPRINT="<uretim-endpoint-parcasi>"` — ör. DATABASE_URL host'unun `ep-...` kısmı.
2. İstenirse `AURA_DB_GUARD=block` → uyarı yerine HATA (bağlantı hiç kurulmaz).

Guard Vercel'de devre dışıdır (NODE_ENV=production / VERCEL=1 — üretimin kendi DB'sine bağlanması
normal). Parmak izi kodda tutulmaz (public repo).

**B2 — TAMAMLANDI (2026-07-16):** Neon `development` branch'i (schema-only fork, auto-delete YOK)
+ yerel `.env` düzeni değişti:

- `DATABASE_URL`/`DIRECT_URL` → **development branch** (+`connect_timeout=15`); `DATA_ENCRYPTION_KEK`
  ve `SESSION_SECRET` → **yeni, dev'e özgü** değerler; `AURA_DB_GUARD="block"` varsayılan.
- Üretim değerleri `PROD_DATABASE_URL`/`PROD_DIRECT_URL`/`PROD_DATA_ENCRYPTION_KEK`/
  `PROD_SESSION_SECRET` adlarıyla `.env`'de saklı (kaynak-of-truth Vercel env). **Prod'a bilinçli
  işlem** (ör. onaylı `migrate deploy`): komuta `DATABASE_URL`/`DIRECT_URL` PROD değerleriyle
  AÇIKÇA verilir — varsayılan hiçbir akış artık prod'a gitmez.
- Yeni makinede kurulum sırası: branch aç (schema-only) → `.env` DEV url'leri →
  `prisma migrate reset --force --skip-seed` (YALNIZ dev!) → `ALLOW_DESTRUCTIVE_SEED=1 npm run db:seed`.
- 📌 **Doğrulama alışkanlığı değişti:** fonksiyonel doğrulama artık dev branch'te (seed: 5 kullanıcı ·
  30 doktor · 20 vaka; demo girişler çalışır); üretime yalnız HTTP smoke.
- ⚠️ Bilinçli sınırlar (açık kalemler): tedarikçi API anahtarları (AI/Blob/Ably/TURN…) ortamlar
  arasında hâlâ ORTAK (ayrımı ayrı kalem) · **Vercel Preview deployment'ları hâlâ prod DB'ye bakar**
  (`DATABASE_URL` kapsamı "Production and Preview") — istenirse panelde Preview kapsamına
  development branch bağlantısı atanır.
