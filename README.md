# AIR / AURA Telehealth — MVP

**🚀 Canlı demo: https://telehealth-mvp-roan.vercel.app** · Demo girişi: `doktor@air.test` / `1234`

Çok ülkeli sağlık turizmi + telehealth platformunun çalışan sürümü.

**Farkı nerede:** sınır ötesi sağlığın asıl zor problemi veri/güven/uyum — ve çözülen kısım bu.
KVKK hash-zincirli onam + RFC 3161 zaman damgalı **Onay Kanıtı**, **FHIR R4** dışa aktarım
(Composition/Consent + denetim izi) ve uçtan uca **AI klinik** (triyaj, belge analizi, SOAP,
epikriz, post-op vision). Bir hafta sonunda klonlanamayan parça budur.

Üstüne uçtan uca akış canlıda: hasta triyajından doktor kokpitine, gerçek WebRTC video
görüşmeye, sağlık turizmi paketine ve post-op takibe — üç paralel hasta akışıyla (**Talk to
Doctor** genel triyaj, **İkinci Görüş**, **Ücretsiz Sağlık Hizmeti** ücretsiz gönüllü konsültasyon).

> Bilgi tabanı (Obsidian vault) komşu `../Air` klasöründedir. Güncel mimari için
> `Air/output/guncel-yazilim-mimarisi.md`, modül detayları için `Air/wiki/moduller/`,
> canlı durum/sürüm geçmişi için `Air/wiki/mvp.md` + `Air/wiki/todo.md`.

## Teknoloji

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4**, **lucide-react** ikonlar
- **Prisma 6 + PostgreSQL (Neon)** — yerel `.env` Neon **development branch**'ine bağlanır; üretim
  ayrı branch'tedir ve yalnız `PROD_*` env'i AÇIKÇA verilerek dokunulur (Ray B2 ortam ayrımı,
  `DEPLOY.md` §B2; SQLite kullanılmaz)
- **Kimlik doğrulama:** imzalı JWT (`jose`) httpOnly cookie + `bcryptjs` + rol bazlı proxy (Next 16)
- **AI:** `@anthropic-ai/sdk` (Claude — triyaj/SOAP/epikriz/çeviri/vision) · `@google/genai`
  (Gemini Live — gerçek zamanlı ses→ses tercüme)
- **Gerçek zamanlı:** WebRTC P2P (sinyalleşme: **Ably realtime birincil** + DB `Signal` yedeği, v4.15) + Cloudflare Realtime TURN relay (yedek: Metered)
- **DICOM:** `dicom-parser` + `dcmjs` + `@cornerstonejs/codec-openjpeg` + `codec-charls` +
  `jpeg-lossless-decoder-js` + `jpeg-js` — codec'ler hem tarayıcıda görüntüleme hem **sunucuda
  burned-in PHI maskeleme** için (v6.37; WASM ikilileri `next.config.ts` `outputFileTracingIncludes`
  ile serverless bundle'a dahil edilir)
- **PWA / bildirim:** service worker + `web-push` (VAPID)

## Çalıştırma

```bash
npm install
cp .env.example .env          # değerleri doldur (DATABASE_URL, SESSION_SECRET zorunlu)
npx prisma migrate deploy     # migration geçmişini Neon'a uygula (taze DB'de tüm şemayı kurar)
npm run db:seed               # demo veri: kullanıcılar + 30 doktor + 20 vaka + takip/şikayet
npm run dev                   # http://localhost:3000
```

> Yerel `.env` Neon **development branch**'ine yazar (dev'e özgü KEK/SESSION_SECRET, seed'li) ve
> `AURA_DB_GUARD="block"` üretim-dışı sürecin prod'a bağlanmasını **engeller** (`src/lib/db.ts`).
> Üretim işlemi = ayrı onay + `PROD_DATABASE_URL` açıkça (runbook: `DEPLOY.md` §B2).
> `ANTHROPIC_API_KEY` yoksa triyaj kural tabanlı motora düşer; `GEMINI_API_KEY` yoksa canlı
> tercüme dormant kalır — uygulama yine çalışır.

### npm script'leri

| Script | İşlev |
|--------|-------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Üretim sunucusu |
| `npm run lint` | ESLint |
| `npm test` | **Birim testleri** (vitest — saf mantık, DB yok; pricing/journey/deidentify/crypto/ownership/rate-limit[Upstash mock+fail-open]/postop/storage/ai-minimize/chain-seal/session-sv) |
| `npm run test:integration` | **Entegrasyon testleri** (gerçek DB — `TEST_DATABASE_URL` Neon dev branch gerekir; yoksa atlanır, bkz. `tests/integration/README.md`) |
| `npm run test:e2e` | **E2E testleri** (Playwright — 3 demo-kritik akış + erişilebilirlik smoke paketi [salt-okur: axe · tek-h1 · klavye · reduced-motion · RTL; WCAG İDDİASI DEĞİL]; Ray B2'den beri normal `npm run dev` sunucusu yeterli, bkz. `tests/e2e/README.md`) |
| `npm run db:seed` | `prisma/seed.ts` — demo veri (tam reset) |
| `npm run db:migrate` | `prisma migrate deploy` — **üretim şema değişikliği yolu** (db push değil; akış: `DEPLOY.md` Adım 2) |
| `npx tsx scripts/enrich-profiles.ts` | profil/vaka **zenginleştirme** (idempotent backfill; yalnız boş alan: doktor procedures/markets/akademik + vaka FHIR lab/icd10/belge — silmez) |
| `npx tsx scripts/migrate-docs-to-blob.ts [--dry-run]` | belge **object storage backfill** (mevcut base64-in-DB → Vercel Blob; idempotent; `BLOB_READ_WRITE_TOKEN`+`DATA_ENCRYPTION_KEK` gerekir) |
| `npx tsx scripts/fix-congress-duplicates.ts [--prod] [--yaz]` | kongre **çift-kayıt göçü** (v6.75: kimlikleri branşsıza taşır + aynı ada inen kümeleri birleştirir + CongressFollow'u kalan satıra taşır; idempotent, dry-run varsayılan; prod'da koşuldu 2026-08-04: 101 kimlik + 1 birleşme) |
| `npx tsx scripts/probe-plaintext-count.ts` | şifreleme kapsamı **salt-okur sayım** (v6.76: encrypt-existing kapsamındaki kolonlarda düz-metin kalanlar + demo/gerçek sahip ayrımı; `PROD_DATABASE_URL` açıkça şart, KEK İSTEMEZ — PHI/e-posta basmaz) |
| `npx tsx scripts/find-kek.ts [--file <aday>] [--run [--apply]]` | **KEK kurtarma/teşhis** (v6.82: "elimdeki hangi değer bu DB'nin anahtarı?" — adayları `.env PROD_DATA_ENCRYPTION_KEK` + isteğe bağlı dosyadan toplar, **base64 · hex→base64 · base64url** varyantlarını dener; kanıt `rewrapEnvelope(s,kek,kek)` ile → **PHI ÇÖZÜLMEZ**, sır BASILMAZ; `--run` anahtarı AYNI süreçte `encrypt-existing`'e devreder → sır terminale kopyalanmaz; `PROD_DATABASE_URL` şart) |
| `npx tsx scripts/fix-pubmed-dates.ts [--prod] [--yaz]` | **PubMed yayın tarihi onarımı** (v6.85: PubMed'in `pubdate`/`sortpubdate` alanı derginin KAPAK tarihidir — sürekli-yayın dergileri makaleyi "31 Aralık"a, aylık dergiler gelecek sayıya yazar; gerçek tarih `epubdate`. Mevcut `NewsArticle` kayıtlarını esummary'den yeniden hesaplar, toplayıcının KENDİ `pubDate()`'iyle [tek doğruluk kaynağı]. Dry-run varsayılan · dokunulan tek alan `publishedAt` · idempotent · 2026-08-12'de koşuldu — dev 74/74, **prod 95/95** [gelecek tarihli 92→0]) |
| `npx tsx scripts/seed-career-pathways.ts [--prod] [--yaz]` | **Kariyer/denklik rehberi seed'i** (v6.89: `prisma/seed-data/career-pathways.json` → `CareerPathway`; kaynak belgesi vault `output/kariyer-denklik-veritabani-2026-08-12.md`). **FAIL-CLOSED doğrulayıcı** — `officialUrl` https şartı · gelecek tarihli `verifiedAt` reddi · adımsız kayıt reddi · scope/confidence allowlist; **bir kayıt düşerse HİÇBİR ŞEY yazılmaz** (kaynaksız/şüpheli süreç bilgisi doktoru yanlış plana sokar). Dry-run varsayılan · idempotent (slug upsert) · 2026-08-12'de dev+prod 6/6 |
| `npx tsx scripts/ingest-yargitay.ts [--yaz] [--prod] [--limit=N]` | **Yargıtay içtihat dolumu** (v6.86): karararama.yargitay.gov.tr → `NewsArticle` (`category=ictihat`; kamuya açık, kaynağında anonim yargı kararları — PHI yok). Dry-run varsayılan; prod yalnız `--prod`+`PROD_DATABASE_URL`. ⚠️ Kaynağın **belge ucunda oturum kotası** (~17-31 belge/koşu) + IP hız freni (HTTP 429 / `FMTY=ERROR`) var → **dilimli koş**: aralıklarla tekrar, idempotent devam; fren görünce 10-15 dk bekle. Cron zaten günde 2 sorguluk rotasyonla ~20 karar alır (`queriesForToday`) — script tam listeyi hızlandırmak içindir |
| `npx tsx scripts/ingest-doktrin.ts [--yaz] [--prod]` | **Doktrin (TR-Dizin) dolumu/tazeleme** (v6.92): hakemli makale metadata'sı → `NewsArticle` (`category=doktrin`). Tek aşamalı ve ucuz (ikinci belge isteği yok); dry-run lib ile AYNI `matchesQuery` ibare süzgecini koşar ("ES sonucu N · ibare-doğrulanan M" raporlar). TELİF: yalnız başlık+yazar+özet+link |
| `npx tsx scripts/backfill-hukuk-brans.ts [--yaz] [--prod]` | **Hukuk içerikleri branş-etiket backfill'i** (v6.93): mevcut İçtihat+Doktrin kayıtlarının `branchSlugs`'ını `extractBranches` ile yeniden hesaplar, YALNIZ değişenleri yazar (İçtihat `minHits:2` · Doktrin başlık+özet). `BRANCH_PATTERNS` sözlüğü değişince yeniden koşulur — idempotent, dokunulan tek alan `branchSlugs` |

## Roller & Giriş

Giriş **iki ekrana ayrıdır** (v4.21): **`/giris` = Hasta Girişi** · **`/kurumsal-giris`** =
Doktor/Koordinatör/Etik Kurul/Partner/**Sağlık Turizmi Acentesi**/**Sağlık Uzmanı**. İkisi de vitrin
**AURA giriş kapılarıdır** (letterform panel + yan video; `components/aura/auth-gates.tsx`).
**Kapı-içi form (v6.84, 2026-08-06 — v5.9.1 kapı/form ayrımı SÜPERSEDE):** Google ve Apple butonları
**doğrudan OAuth** başlatır (`/api/auth/{google,apple}/start?intent=patient|doctor`); "E-posta ile
devam et" formu **kapının içinde açar** (`components/aura/gate-email-form.tsx` — giriş + doğrulama
yeniden-gönder + demo hızlı-giriş kilidi). **Üyelik daveti kapının KALICI öğesidir (2026-08-12):**
form kapalıyken de "veya" ayracının altında görünür; kurumsal kapıda **rol seçimine göre değişir**
(Doktor→`/kayit` · Partner→`/kayit/partner` · Uzman→`/kayit/saglik-uzmani` · Acente→`/kayit/acente`
· Koordinatör/Etik Kurul→"davetle katılım" notu — 9 dil `corporate.rolePrompts`). Eski
`/giris/e-posta` ve `/kurumsal-giris/e-posta` rotaları **kalıcı yönlendirmedir** (parametre
koruyarak kapıya). OAuth hata/`?verify` dönüşleri kapıya düşer ve formu otomatik açar. Hasta
üyeliği **`/kayit/hasta`** → `POST /api/auth/signup-patient` (`lib/patient-signup`); doktorlar
**`/kayit`** ile kendileri kayıt olabilir (Google/Apple [env-gated] / e-posta; OAuth niyeti
`g_oauth_intent`/`a_oauth_intent` cookie'siyle taşınır — mevcut kullanıcıda yok sayılır). Giriş
sonrası tek seferlik KVKK onam kapısı (`/onam`) vardır (sürümlü;
`lib/consent-config.CONSENT_VERSION` artarsa bir kez yeniden alınır; personel metni **rol-duyarlı**
ek maddeler taşır — AGENCY/PARTNER/HEALTH_PRO, `ConsentGate STAFF_ROLE_EXTRA`).

**Kurumsal üyelik yaşam döngüsü (2026-08-12):** PARTNER / AGENCY / **HEALTH_PRO (Sağlık Uzmanı —
yeni rol; klinik yetkisi YOK, iniş `/uzman`)** başvuruyla açılır: `/kayit/{partner,acente,saglik-uzmani}`
rol-config soru seti (`lib/staff-application-config.ts` tek kaynak; yanıtlar **at-rest şifreli**
`StaffApplication.answers`) + başvuru-KVKK onay kutusu (ayrı scope `STAFF_APPLICATION_KVKK`,
hash-zincirli ConsentRecord) → hesap **yetkisiz** açılır (`User.staffVerifiedAt=null`) → `/kayit/durum`
(belge yükleme: imza-tabanlı MIME + şifreli depo; REJECTED'te gerekçe + düzelt-yeniden-gönder) →
**insan onayı** `/admin/personel-onay` (ETHICS/ADMIN; onay damgalar, PARTNER'da `PartnerDoctor`
oluşturup `User.partnerId` bağlar; audit `STAFF_APP_APPROVE/REJECT` + bildirim). Kapı yaptırımı:
`getCurrentUser` her istekte `staffVerified`'ı DB'den doldurur; `/partner` `/acente` `/uzman`
sayfaları + acente teklif API'si doğrulanmamışı `/kayit/durum`'a düşürür. **COORDINATOR/ETHICS
başvuru ALMAZ** — yalnız davet: `scripts/create-staff.ts` (create-admin korkulukları; hesap
damgalı açılır). ⚖️ Soru seti/KVKK metinleri TASLAK — hukukçu onayıyla kesinleşir.

**Hasta akışı (v5.8 basitleştirme):** `/basla` 4'lü seçim ekranı KALDIRILDI — giriş hunisi doğrudan
**Branş Doktoru akışına** (`/triyaj`) iner; **dönen hasta** (başvurusu olan) girişte **vaka merkezine**
(`/vakalarim`; SO yolculuğunda `/second-opinion/vakalarim`) iner (`lib/patient-journey.patientHome`);
her vakanın tek merkezi `/vaka/[caseId]` hub'ıdır (teklif/rezervasyon gömülü, eski rotalar redirect).
Diğer kulvarlara erişim: Vakalarım üstündeki kulvar kartları + kendi sayfaları (İkinci Görüş →
`/second-opinion/basvur` · Sağlık Turizmi → `/saglik-turizmi` · Ücretsiz Sağlık → `/ucretsiz-saglik/basvur`).
`User.patientJourney` artık **başvurulan akışta damgalanır** (`stampPatientJourney` → intake API'leri) ve
üst bandı belirler (`lib/nav.ts navItemsFor`); **profil hafızası** (Faz 0/1): intake'te girilen
ülke/dil/telefon(şifreli)/iletişim tercihi `User`'a yaz-geri edilir, sonraki intake'ler kompakt
"Kayıtlı bilgileriniz" şeridiyle prefill eder (`GET /api/patient/profile` + `ProfilePrefill`).

Demo kullanıcıları (parola `1234`; hasta demo `/giris`'te, personel demoları `/kurumsal-giris`'te):

| Rol | E-posta | Erişim |
|-----|---------|--------|
| Hasta | `hasta@air.test` | Vakalarım, triyaj, paket, takip, şikayet, paylaşım, İkinci Görüş, Ücretsiz Sağlık Hizmeti |
| Doktor | `doktor@air.test` | **Doktor Ana Sayfası (pencere-tabanlı)** + onboarding, video görüşme, klinik kodlama, post-op izleme, klinik nöbet, Ücretsiz Sağlık Hizmeti, **Konsültasyon Talepleri** |
| Koordinatör | `koordinator@air.test` | Operasyon paneli (S2) + doktor alanı |
| Etik Kurul | `kurul@air.test` | Etik Kurul paneli |
| Partner Doktor | `partner@air.test` | **Partner paneli** — yurtdışı ortak doktor; hasta DB erişimi YOK, uzaktan hizmet YOK; yalnız anonim **konsültasyon talebi** açar |
| Sağlık Turizmi Acentesi | `acente@air.test` | **Acente paneli (S3, `/acente`)** — doktorun ilettiği tedavi dosyaları (KISITLI: kimlik/iletişim + işlem/ücret/süre/hastane; tıbbi belge ASLA) → hastaya paket **teklifi** hazırlar (`mode=offer`; doğrudan Escrow yetkisi yok) |

Rol bazlı erişim `src/proxy.ts` (Next 16 proxy konvansiyonu) ile zorlanır. Yetkisiz erişim `/giris`'e, yanlış rol ana
sayfaya, onamsız oturum `/onam`'a yönlendirilir. Parolalar `bcrypt` ile hash'lenir; `.env`
içinde `SESSION_SECRET` tanımlı olmalıdır.

## Modüller (canlı)

### 7 çekirdek modül

| # | Modül | Durum |
|---|-------|-------|
| 1 | **Triyaj** | ✅ Ön-konsültasyon kapısı (ücret — kartla demo ödeme; **sigortayla ödeme yolu v6.78'de kaldırıldı**, anlaşmalı sigorta şirketi yok) → 5 adımlı sihirbaz, **gerçek Claude** branş+aciliyet (30 branş, ~198 dinamik branş sorusu), belge yükleme + **AI ön-değerlendirme** (vision/PDF → tür+TR çeviri+özet+anormal bayrak) + lab→FHIR oto-dolum. **Belge-bekleyen başvuru (`DOCS_PENDING`, 2026-07-24, kullanıcı kararı):** eksik zorunlu belgeyle (docAck) oluşturulan **aciliyet ≤3** vaka doktor havuzuna DÜŞMEZ (doktor kuyruğu/nöbetçi/İcapçı/bildirimler görmez; koordinatör "Belge Bekleniyor" rozetiyle görür) — hasta vaka merkezindeki `PendingDocsPanel`'de kalemleri yükleyip işaretleyince `POST /api/cases/[id]/pending-docs` (hasta-only+BOLA+rate-limit+audit `CASE_DOCS_COMPLETED`) vaka NEW'e geçirir ve NEW_CASE bildirimi O ANDA gider. **Aciliyet 4-5 İSTİSNA:** belge beklemeden havuza düşer (klinik risk; MISSING_DOCS bildirimi yalnız bu yolda). Bekleyen kalemler `Case.pendingDocs` (düz JSON; migration `20260724014426`). **Periyodik hatırlatma (v6.36):** günlük bakım cron'u (purge-deleted, ~06:30 TR) `remindPendingDocs` koşar — bekleyen hastaya günde 1, **en fazla 3** hatırlatma (`lib/pending-docs-reminder.ts`; durum ayrı kolonda değil, MISSING_DOCS bildirim kayıtlarından türetilir; tavan dolunca susar, hasta panelden her an tamamlayabilir) |
| 2 | **Doktor Paneli + Video** | ✅ Aciliyet sıralı kuyruk, kokpit, **gerçek WebRTC** video + canlı transkript (Web Speech) + AI-SOAP + medikal çeviri + **AI Epikriz** + **Gemini canlı tercüman** (iki yönlü ses+altyazı; **v6.30 tek-sıçrama**: konuşan KENDİ mikrofonunu karşının diline çevirtir, çeviri `replaceTrack` ile karşıya gider — sessiz-ölüm bekçisi + fail-open mikrofona dönüş) — **transkript herhangi taraftan, tercüme YEREL ilk konuşma sesinde otomatik başlar (VAD; başlat düğmesi yok), tercüme yalnız diller farklıysa** + **DICOM görüntüleyici** (5 sıkıştırılmış codec; **v6.33: hastanın triyajda yüklediği .dcm ASLIYLA+şifreli saklanır** — kokpitte "Hasta yüklemesi" olarak demo çalışmalarla yan yana, auth'lu `/api/cases/[id]/documents/[docId]/dicom` ucundan açılır; AI belge değerlendirmesi DICOM'u atlar) + klinik kodlama (FHIR) |
| 3 | **Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, **3 kademeli sigorta** (1 zorunlu · 2 operasyon teminat poliçesi [toplam fatura×oran×branş riski] · 3 malpraktis — doktorun yüklediği MMSS'inin bıraktığı boşluğu doldurur; `lib/pricing.ts` `computeInsurance`, parametrik/endikatif) + **hasta sağlık beyanı → risk çarpanı** (v6.31: `/paket`'te hasta-only form [kronik/ilaç/sigara/ameliyat, triyaj+profil prefill'li] → `computeHealthRiskMult` çarpımsal-tavanlı, yalnız Katman 2/3'e; beyan `Case.healthDeclaration` **şifreli+vaka-sabit** + `User.patientHealthHistory` profil kopyası; personel/acente ham beyan GÖRMEZ, yalnız çarpan; prim client+server aynı fonksiyondan), **lojistik Patient Journey takibi** (durum+tarih+not; koordinatör yönetir, hasta görür) + SOAP'tan AI paket teklifi + hastaya teklif gönderme (link/PDF). ⚠️ **Sağlık turizmi kulvarı ÖDEMESİZ (2026-07-23, kullanıcı kararı):** teklif onayı ödeme/escrow İÇERMEZ — `tourism` bayrağıyla `OfferView`/`ReservationView` escrow bandı+split GÖSTERMEZ, buton "Teklifi Onayla", backend `escrowStatus` PENDING kalır (HELD yazılmaz; respond+booking route). Escrow+split **Branş Doktoru kulvarındaki** paket akışında yaşamaya devam eder |
| 4 | **Post-Op Takip** | ✅ Günlük kontrol (ağrı/ateş/ilaç/foto), branş protokolü, doktor izleme + **Güvenli Dijital Paylaşım** (token/TTL/şifre/audit/iptal) + alıcı dilinde görüntüleme + **AI foto analizi** (Claude vision). **v6.64-66 görsel/terminoloji turu (2026-08-04):** şiddet etiketleri tıp literatürüne çekildi — **Stabil · Yakın izlem · Alarm bulgusu** (eski Normal/İzlemde/Kırmızı bayrak; triyaj metinleri bilinçli DEĞİŞMEDİ) · kartlar `/vakalarim` CaseCard anatomisiyle birebir (BranchAvatar + kulvar şeridi + sağda rozet; tema-duyarlı token'lar — sabit emerald/violet gündüz temada okunmuyordu) · **45° durum alanı**: kartın sağında %15'ten başlayan tam-45° kesik (globals `.postop-slant` skewX tekniği; elle yüzde değil), şiddete göre yeşil/sarı/kırmızı, RED'de Doctorium temposuyla parlar (`postop-alert-aura`; reduced-motion'da sabit %20) · **vital kutucukları**: ağrı/ateş iç kutularda, renk eşikleri alarm hesabıyla TEK KAYNAK (`painSeverity`/`feverSeverity` — `assessCheckIn` de aynılarını kullanır) · **tıklanır KPI filtreleri** (`RecoveryList` client bileşeni; CaseQueue stat deseni; PHI çözümü sunucuda kalır) |
| 5 | **Doktor Adaptasyon** | ✅ **Self-signup** (`/kayit` — Google/Apple[ikisi de CANLI, env-gated]/e-posta → `User`+`Doctor` `verified:false`, `lib/doctor-signup` + `lib/oauth`) + **Doktor Ana Sayfası — pencere-tabanlı** (v6.42 düzeni [Bildirim Tercihi v6.98'de /doktor/profil'e taşındı]: Eşleşen Vakalar / **Uzaktan Sağlık** [eski "Klinik Nöbet" penceresi; 3'lü nöbet tercihi pencere içinde "Klinik Nöbet" bölümü] / İkinci Görüş / Sağlık Turizmi / Ücretsiz Sağlık Hizmeti / Konsültasyon Talepleri [**tam genişlik**, alt alta]), her doktora ünvan+opt-in'e göre koşullu (`lib/doctor-home.ts`). **v6.56–58 mobil/oturum düzeni:** paneller **mobilde kapalı başlar + tek-açık akordeon** (`DashboardPanel` — başlık aç/kapa, chevron yalnız mobil, sm+ hep açık CSS'te; kardeş client adaları `aura-panel-open` CustomEvent'iyle koordine; başlık satırı flex-wrap — rozet dar ekranda metni ezmez); **header hesap menüsü** (sağda yalnız avatar+okunmamış rozeti; menüde Bildirimler [`NotificationBell` `variant="menu-item"` + `onUnreadChange`; menü paneli koşullu render DEĞİL `hidden` — bell hep mount, 30 sn yoklama yaşar] · Profilim [nav bandından taşındı] · **Finans** · Tema [`ThemeToggle` `asMenuItem`; misafirde ikon en sağda] · çıkışlar); **`/doktor/finans`** — kulvar-ayrımlı hakediş sayfası (Uzaktan Sağlık · İkinci Görüş [gerçek `SecondOpinionPayment`'tan, teslim koşullu; PAID değilse "Ödeme bekleniyor"] · Sağlık Turizmi [⚠️ Booking split'inde doktor payı KALEMİ YOK — hastane kalemi içinde örtük; tutar uydurulmaz, rezervasyon+escrow durumu listelenir, toplam dışı] · Konsültasyon Talepleri [kümülatif `answeredStatsForDoctor`]); profildeki hakediş bölümü ve `/doktor/konsultasyon` üstündeki hakediş penceresi KALDIRILDI (tek merkez Finans). **v6.55 Doctorium kimliği:** nav/sayfa başlığı zümrüt **AURA lockup** ("Doctor**ium**"; `AuraMark tone="emerald"`, `TONES` paleti — gradient id'leri ton-başına AYRI) + sabit slogan "Bilim, sizin ritminizde." + nav'da yazı-lockup (yanıp sönen `ium`, `doctorium-ium-breathe`); `BookOpen` ikonu projeden tamamen çıktı. **Doctorium — doktor bilgi portalı (v6.46-48):** Haberler penceresi ana sayfadan ÇIKTI → üst bant linki + `/doktor/doctorium` (eski `/doktor/haberler` 308). **4 modül** (`lib/doctorium`): **Akışım** (doktorun seçtiği branşlar — `Doctor.newsBranches` JSON slug dizisi, `/doktor/doctorium/tercihler`; seçim yoksa kendi branşı) · **Akademik** (v6.109: PubMed E-utilities + **Europe PMC + DOAJ** hakemli açık kaynaklar [`lib/doctorium-academic-sources.ts` — OPEN_ACCESS/HAS_ABSTRACT süzgeçli, preprint DIŞI; DOI/PMID çapraz-kaynak tekilleştirme, branş birleştirme]; branş→MeSH `NEWS_QUERIES` [açık kaynaklara `meshToKeywords` çevirisiyle], gerçek dergi+yazar+DOI; 1 yıllık backfill: `npx tsx scripts/backfill-doctorium-academic.ts --days 365` [dev 2026-08-18: +991 kayıt, havuz 1.065]) · **Sektörel & Mevzuat** (T.C. Resmî Gazete günlük fihristi, sağlık anahtar kelime süzgeci — ⚠️ RG/TİTCK/SGK makine-okunur besleme YAYIMLAMIYOR, HTML kazınır; kırılgan) · **Kongre Takvimi** (otomatik kaynak YOK → ADMIN küratörlü `/admin/kongre`). **Modül D (ilaç tanıtımı/e-mümessil) PARK** — TİTCK tanıtım yönetmeliği + ruhsat sahibi sıfatı hukuki görüş ister. **Toplama:** günlük bakım cron'u (`purge-deleted`, Hobby cron 2/2 dolu) `ingestDoctorium()` çağırır → `NewsArticle` tablosu (~90 kayıt/gün, ölçüm 83 sn); sayfa DB'den okur, dış API'ye GİTMEZ. **2 dk klinik özet:** `summarizeArticleForClinician` (zorlanmış tool_use) → `NewsArticle.aiSummary`, **TEMBEL** (yalnız yayın açılınca; okunmayan için AI parası ödenmez) + kaldırılamaz "klinik karar aracı değildir" uyarısı. Başlıklar EN→TR `Translation` önbelleğiyle (6 sn bütçe). İçerik PHI DEĞİL → şifrelenmez. **v6.49 kişiselleştirme:** branş tercihleri ayrı sayfa değil, modül sekmelerinin ALTINDA açılır alt menü (`BranchPrefsMenu`; `/tercihler` → yönlendirme) · **Akışım'daki branş çipi tıklanır** → yalnız o branş (`?b=slug`, `singleBranchFeed`; mevzuat odakta gizlenir; yalnız doktorun KENDİ akışındaki slug kabul edilir) · **Sektörel geriye-dönük aralık** (`?d=` — günlük/haftalık/aylık/6 aylık/1 yıllık; geçersiz değer 30 güne düşer) · **Kongre alarmı**: ⭐ takip (`CongressFollow`) + **v6.63'te ÜÇ ayrı eşik** (`Doctor.congressAlertDays` başlangıç · `congressAbstractAlertDays` bildiri son gönderim · `congressEarlyBirdAlertDays` erken kayıt); hatırlatma günlük bakım cron'unda (`remindCongressFollows`), tekrar koruması `CongressFollow.sentAlerts` (`start`/`abstract`/`earlybird` ayrı anahtar), eşik değişince sıfırlanır. ⚠️ v6.49-62'de bildiri+erken kayıt TEK eşikteydi ve "önce gelen" gönderilince öbürü SUSUYORDU (gerçek kayıp riski) — migration eski değeri iki yeni alana kopyalar. **v6.50 — 6 MODÜL + gerçek sektörel kaynaklar:** Mevzuat ile Sektörel AYRILDI, **İlaç & Cihaz** eklendi (`DOCTORIUM_MODULES` sırası **v6.51 kullanıcı kararı**: akis · akademik · sektorel · ilac · kongre · **mevzuat EN SONDA**) + 6 sektörel kategori (`SECTOR_CATEGORIES`: mevzuat · sut · turizm · yonetim · teknoloji · ilac-cihaz; `NewsArticle.category`). **Akışım artık akademikten ibaret DEĞİL** — mevzuat/sektörel/ilaç kalemleri branş ayrımı olmaksızın akışa girer. **Kaynak matrisi (`lib/doctorium-sources.ts`, hepsi 2026-08-01'de ölçüldü):** ✅ Resmî Gazete (günlük + **1 yıl geriye backfill**: `scripts/backfill-gazette.ts`, 3.482 kalem→125 kayıt) · ✅ **OHSAD** (SUT/geri ödeme/mevzuat aktarımı — SGK'nın kendi sitesi duyuruları JS ile yüklediği için tek makine-okunur yol) · ✅ TTB (doktor özlük) · ✅ openFDA drug+device/enforcement (geri çekme) · ✅ ClinicalTrials.gov v2 (faz/lansman) · ✅ WHO RSS · ❌ EMA/TİTCK/SGK/AA (besleme YOK → uydurma içerik üretilmez). **Dijital prospektüs:** `/api/doctorium/prospektus` → openFDA drug/label; ⚠️ **ABD verisi** — "FDA (ABD) onaylı ürün bilgisidir, Türkiye KÜB/KT farklı olabilir" uyarısı KALDIRILAMAZ ve metin ÇEVRİLMEZ (dozaj hatası riski). 🪤 **Kazıma tuzakları:** RG ARŞİVİ windows-1254 / ANA SAYFA utf-8 (karıştırınca 93 bozuk karakter + filtre sessizleşiyor) · anahtar kelime **kelime başında** aranır, yoksa "aşı" → "t·aşı·ma" eşleşip BOTAŞ petrol ilanları ilaç kategorisine düşüyor · veteriner/gıda/petrol/enerji dışlama listesi · ops aracı `scripts/ingest-doctorium.ts`. **v6.51 mevzuat özeti:** fihrist yalnız BAŞLIK verdiği için detay sayfası boş görünüyordu → `ensureRegulationSummary` TEMBEL iki aşamalı: (1) kaynak belgenin metni çekilir (`fetchDocumentText`; 🪤 RG `/eskiler/` belgeleri de **windows-1254**) ve `summary`'ye yazılır, (2) `summarizeRegulationForClinician` (zorlanmış tool_use) → **Doktor özeti + Aksiyon maddeleri + Kimi etkiliyor + Yürürlük** (`aiSummary`). İlk açılış ~13 sn, sonraki 0,3 sn. ⚠️ "hukuki görüş değildir, bağlayıcı olan resmî metindir" uyarısı KALDIRILAMAZ. **PDF kaynakta metin çıkarımı YOK** → özet üretilmez, arayüz bunu açıkça söyler (uydurmaz). **v6.52-54:** tüm ayarlar TEK **"Özelleştir"** penceresinde (`DoctoriumFilters`: aralık · kategori · kongre alarmı · branş tercihleri) — bölüm yoksa düğme hiç çizilmez; **branş tercihi yalnız akışa etki eden sekmelerde** (Akışım + Akademik). doktor→doktor süpürmesi yapıldı — ⛔ arama anahtarları (`HEALTH_KEYWORDS`/`CATEGORY_RULES` içindeki "doktor", "diş doktor", "asistan doktor") ve rota adları (`/doktorlar`, `/admin/doktor-onay`) BİLİNÇLİ DEĞİŞMEDİ: resmî metinler o kelimeyi kullanıyor, değiştirmek mevzuat filtresini kırardı. **TR kaynak erişimi — teşhis TAMAMLANDI (v6.57-60, 2026-08-03):** tek "fetch failed" perdesinin altından ÜÇ ayrı hastalık çıktı (`describeFetchError` `error.cause` zincirini kazıyor): **TTB** = eksik TLS ara sertifikası → **ÇÖZÜLDÜ** (`lib/ttb-ca.ts` Sectigo ara sertifikası + `httpsGetWithCa`; prod cron'da 45 tarandı/21 yazıldı) · **Resmî Gazete** = `UND_ERR_CONNECT_TIMEOUT`, TCP el sıkışması hiç kurulmuyor (veri-merkezi IP aralığı DROP) · **OHSAD** = Cloudflare `403`, gerçekçi Chrome başlıkları YETMEDİ (IP itibarı). Son ikisi Vercel'den yapısal olarak erişilemez → **yerelden besleme** (`scripts/ingest-tr-sources.ts`, kullanıcı kararı): dry-run varsayılan, prod yalnız `--prod`+`PROD_DATABASE_URL`, `AURA_DB_GUARD` kalıcı gevşetilmez. **v6.62 (`4e4ae68`) — özet zinciri tamam:** script boş `summary`'li RG/OHSAD kayıtlarının **resmî metnini de yerelden doldurur** (tembel özetin metin-çekme adımı Vercel'de daima düşüyordu → metin DB'de hazırsa yalnız AI adımı orada koşar) + `fetchDocumentText` TTB'de özel-CA istemcisine geçti (v6.59 onarımı yalnız fihristteydi — sektörel TTB özetleri artık üretilebilir). İlk prod besleme 2026-08-04: RG 8 kalem + 7 metin (30 gün; RG'nin ~%3'ü sağlık çıkıyor); OHSAD origin'i o saatte yanıtsızdı (IP engeli değil) — idempotent koşu tamamlar. Tazelik yerel koşuya bağlı: haftalık `npx tsx scripts/ingest-tr-sources.ts --prod --yaz` (ritim 2026-08-14'te kuruldu; son-koşu tarihi vault todo "Doctorium — İşletim Ritmi" kaleminde izlenir). **v6.94 (2026-08-14) — RG TLS onarımı:** RG sunucusu ara sertifikayı zincirde sunmaz oldu (leaf-only; leaf `CN=*.tccb.gov.tr`, eksik halka "GeoTrust TLS RSA CA G1") → yerel koşu bile `UNABLE_TO_VERIFY_LEAF_SIGNATURE` verir olmuştu; TTB deseniyle onarıldı — `lib/rg-ca.ts` (AIA'dan PEM + yenileme runbook'u) + üç RG yolu (`fetchGazetteArchive` · `fetchGazetteToday` · `fetchDocumentText` RG dalı) özel-CA istemcisi `httpsGetWithCa`'da (referer + ham-bayt desteği eklendi; windows-1254 decode'u çağıranda). ⏰ RG leaf'i **2026-08-28'de doluyor** — yenilemede farklı ara sertifikaya geçilirse aynı hata döner; PEM, rg-ca.ts başlığındaki runbook'la değiştirilir. İlk gerçek prod beslemesi 2026-08-14: RG 3 + OHSAD 19 (0 hata). **v6.86 — HUKUK bölümü (2026-08-11, kullanıcı kararı):** "Mevzuat" modülünün kullanıcı-yüzü adı **"Hukuk"** oldu (iç anahtar `mevzuat` DEĞİŞMEDİ — migration'sız dönüşüm; DB, akış sorguları, URL'ler kırılmaz); `?h=` alt-sekmeleri **Mevzuat · İçtihat** (+ sekme-üstü `<details>` tanıtım bloğu: bölümlerin içeriği ve kullanımı; **Doktrin** v6.92'de gerçek içerikle AÇILDI — aşağıya bak). **İçtihat** = Yargıtay Karar Arama'dan idempotent toplama (`lib/hukuk-ingest.ts`; tırnaklı 7 sorgu — tırnaksız çok-kelime GEVŞEK eşleşir [54k gürültü]; resmî/belgeli API DEĞİL, sözleşme 2026-08-06 canlı ölçümü; tarih filtresi sunucuda İŞLEMİYOR → artımlılık `(source, externalId)` idempotenciyle; kararlar kaynakta anonim, yayın dayanağı FSEK m.31). **Anahtar kelime sistemi TAMAMEN DETERMİNİSTİK (AI YOK — kullanıcı kararı):** `lib/hukuk-keywords.ts` 16 terimlik sözlük (tek dosya, hukukçu düzenler; çok geniş tek kelime EKLENMEZ) + kanun-maddesi çıkarımı ("6098 sayılı … Kanunu'nun 49" ve "TCK'nın 85/1" biçimleri; **temyiz USUL maddeleri [HMK 366-373 vb.] çip olmaz** — her kararda geçen onama kalıbı gürültüsü) + kart alıntısı (öncelik: Suç/Hüküm satırları > "Uyuşmazlık, … ilişkindir." > I. DAVA bölümü). İçtihat UI: `?k=` çip filtresi (metin-içi ILIKE, paylaşılabilir URL) · kartta alıntı+kanun+terim çipleri · detayda TAM karar metni (hukuki metin kesilmez) + kaldırılamaz "hukuki mütalaa değildir / E.-K. ile resmî sistemden doğrulayın" bandı · `url` null (SPA kaynakta derin link yok) · mevzuat AI-özet akışına GİRMEZ. 🪤 Saha frenleri (2026-08-11 ilk dolum): ~20 istekte HTTP 429 → `GAP_MS=2500`+65sn soğuma-retry · belge ucu oturum kotası ~17-31/koşu → 30sn timeout + ardışık-3-hata kuralı (tekil hata atlanır) · uzun IP freni `FMTY=ERROR` → 10-15 dk bekle; ilk dolum `scripts/ingest-yargitay.ts` ile dilimli (prod arşiv: 492 karar). **v6.92 — DOKTRİN AÇILDI (2026-08-13):** üçüncü alt-sekme gerçek içerikle yayında — **TR-Dizin** hakemli makale akışı (`lib/doktrin-ingest.ts`; DergiPark araması bot-doğrulamalı KAZINAMAZ, OAI'de konu-araması yok → fizibilite kararı TR-Dizin; tek aşamalı — metadata arama yanıtında tam gelir, ikinci belge isteği yok; ⚠️ `order` paramı ZORUNLU ve `searchUrl()` içinde sabit [yokluğu sunucuda `json_parse_exception`]; TR öncelikli başlık/özet; DOI varsa doi.org yoksa TR-Dizin detay sayfası). **TELİF sınırı veri modelinde:** yalnız başlık+yazar+ÖZET+link (dizinin herkese açık metadata'sı) — tam metin/PDF ASLA (makalelerde FSEK m.31 serbestisi yok); kart/detay daima yayıncıya link verir, detayda telif bandı + "Özet (TR-Dizin)". 🪤 ES `q` GEVŞEK skorlar ("sağlık hukuku" → alakasız makaleler) ve tırnaklı sorgu SUNUCUYU KIRAR (`failed to parse [must]`) → **istemci-taraflı tam-ibare doğrulaması** `matchesQuery` (505 ES sonucu → 192 gerçekten ilgili; prod dolu). Cron sorgu başına İLK sayfayı tarar; ilk dolum/tazeleme `scripts/ingest-doktrin.ts`. **v6.93 — ÇOK-BRANŞ ETİKETİ (2026-08-14, kullanıcı isteği):** İçtihat+Doktrin içerikleri branşlara etiketlenir — bir içerik birden çok branş alabilir (`branchSlugs` dizi; kart çipleri + Akışım eşleşmesi otomatik). Deterministik: `lib/hukuk-keywords.ts BRANCH_PATTERNS` (30 branşın tamamı, elle desenler; slug'lar triage `BRANCHES` ile sözleşme-testli) + `extractBranches` (⚠️ aşırı geniş tek kelimeler bilinçli desen DEĞİL: "doğum" [her kararda "doğum tarihi"], "göz", "kanser", "bebek" ["tüp bebek" IVF'tir]; İçtihat'ta `minHits:2` — uzun metinde tek yan-cümle geçişi topikal sayılmaz). Eski kayıtlar `scripts/backfill-hukuk-brans.ts` ile etiketlendi (prod: 492 karardan 284'ü — kadın-doğum 80 · estetik 37 · genel cerrahi 30; Doktrin 192/192); desen sözlüğü değişince yeniden koşulabilir (idempotent, dokunulan tek alan `branchSlugs`). **v6.87 — İKİ AŞAMALI GİRİŞ (2026-08-11):** doktor üyeliği iki aşamaya ayrıldı. **Aşama 1 (Doctorium üyeliği):** tabip odası "Protokol Numaralı" üye yazısı (yeni `CHAMBER` belge tipi — tekil; `/api/doctor/documents`) yüklenince `Doctor.chamberLetterAt` damgalanır ve **yalnız Doctorium** açılır (**OTOMATİK** — admin onayı beklemez, kullanıcı kararı; kapı `doctorium/layout.tsx` segment bekçisi: `chamberLetterAt ∨ activatedAt`, `[id]`/`oduller` dahil TÜM alt rotalar — eski "URL bilen onboardsuz doktor girer" boşluğu kapandı; mevcut aktif doktorlar backfill'siz geçer). Aşama-1 ekranında iki **isteğe bağlı** rıza (`Stage1Doctorium`; kartta özet + `<details>` TAM metin): sponsor kişiselleştirmesi (mevcut `SPONSOR_TARGETING` öne çekildi; GÖSTERİM onayı bilinçli eklenmedi) + **İK iletişim onamı** (`lib/hr-consent.ts` — `HR_CONTACT`/`_REVOKE` zinciri + `hrContactOptInAt` damgası; metin ⚖️ TASLAK; İK modülü henüz yok, onam şimdiden birikir). **Aşama 2 (klinik havuz):** gereksinimler AYNEN (diploma+MMSS+işlem+qualification → `activatedAt`); CHAMBER bu sete GİRMEZ (birim test kilidi). **v6.105 (2026-08-17) — AŞAMA = MARKA + ÜÇ AŞAMA + PANEL TERCİHLERİ:** aşama adları markalaştı (**Aşama 1 = Doctorium Üyeliği · Aşama 2 = AURA Üyeliği**, eski ad "klinik havuz") ve `/doktor/baslangic` üç aşamaya çıktı — **Aşama 3 = Tercihler** (beş panel, yeknesak "… Paneli" adlandırması: Uzaktan Sağlık [`duty`, DAİMA açık/`StatusCard`] · İkinci Görüş · Sağlık Turizmi · Ücretsiz Sağlık Hizmeti · Konsültasyon Talepleri). ⚠️ **MMSS aktivasyon şartından ÇIKTI** ("şimdilik", kullanıcı kararı): `REQUIRED_DOC_TYPES=["DIPLOMA"]`, `canActivate` artık `mmssComplete` ARAMAZ → tek zorunlu mesleki belge tıp diploması; MMSS kartı/formu **İHTİYARİ** durur ve teminat limiti `/paket` M3 Katman-3 primini beslemeye devam eder (geri alma tek satır — imzalardaki `_mmss` bilinçli korundu). ⚠️ **Panel görünürlüğü tercihe bağlandı** (`Doctor.soOptIn` + `tourismOptIn`, migration `20260817180000`): önce `so`=ünvanla otomatik / `tourism`=koşulsuz açıktı, artık `so = soEligible(title) && soOptIn` · `tourism = tourismOptIn`. **REGRESYON KORUMASI:** kolonlar DEFAULT false ama migration MEVCUT satırları true damgalar (prod 35/35) — havuzdaki doktorlar panelini kaybetmez; `soOptIn` ünvan kapısını AŞMAZ (damga herkeste true olduğu için kritik → `tests/unit/doctor-panels.test.ts` kilidi, `panelVisibility`'nin ilk testi). `DoctorPanelFields`'e iki alan ZORUNLU (select'e koymayan çağıran derlemede kırılır). **Aşama 1 doktorunun kromu Doctorium'a ait:** nav bandı boş (`navItemsFor {stage1}`), hesap menüsünde Profilim/Finans yok, marka toggle'ının AURA yarısı her yerde soluk+pasif — tetikleyici KAYNAK değil DURUM (`!activatedAt`), Aşama 2 bitince krom kendiliğinden AURA'ya döner; yükseltme yolu korundu (soluk AURA → `/doktor?from=doctorium` → `?from=aura-gecis` uyarı ekranı). **`/api/doctor/academic` KISMİ güncellemeye çevrildi** — akademik form iki bağımsız kutuya bölündüğü için (`AcademicEducationBox` Mesleki Belgeler'in içinde, `CertificatesBox` kendi başlığı altında; eski `AcademicEditor` export'u geriye uyumlu sarmalayıcı, `/doktor/profil` dokunulmadı) ayrı kaydet düğmeleri var; uç eskiden gövdedeki TÜM alanları koşulsuz yazıyordu → sertifika kaydı `licenseNo`/`specBoard`'ı null yapıp hesabı SESSİZCE deaktive ederdi. Artık yalnız gövdede geçen alan yazılır (`if ("alan" in b)`). **Sayfa düzeni:** almaşık tam-genişlik bant AÇIK→KOYU→AÇIK (sabit renk değil `theme-*` SINIFI — `--c-*` kalıtsal olduğundan kutular ve semantik tonlar kendiliğinden uyar); Aşama 2 sırası Mesleki Belgeler [Tıp Diploması → Akademik & Eğitim → MMSS] → Sertifikalar ve Akademik Çalışmalar → Yaptığım İşlemler. **Marka:** `AuraWordmark` — AURA metin içinde yazıyla değil LOGOYLA yazılır (wordmark PNG'si **CSS maskesi**, arkasına marka turkuazı `#28C8D8`; `currentColor` KULLANILMAZ) 🪤 Doctorium lockup'ı JSX'te SATIR KIRILMAZ (araya düşen satır sonu boşluğa dönüşüp "Doctor ium" çizer). `/kayit`ta iki-aşama özet kartı + public **`/kayit/asamalar`** açıklama sayfası. **OAuth kimlik boşluğu kapandı:** Google/Apple yalnız ad+e-posta verir, hesap `branch:""/city:""` açılıyordu ve hiçbir ekran doldurtmuyordu → yeni **`/doktor/profil-tamamla`** ara sayfası (`POST /api/doctor/complete-profile`) + **üç katmanlı bekçi**: callback yönlendirmesi → baslangic bekçisi (branch/city boşsa ara sayfaya; `?from=doctorium` taşınır) → finish kapısı (`missingOnboardingSteps`e Branş+Şehir). Migration `20260811090000` (iki nullable kolon, idempotent). **v6.88 — Anket ÖDÜL PUANLARI (2026-08-12):** anketler puan kazandırır (`Survey.points`, admin belirler; tüm türlerde) → yanıtla AYNI transaction'da `PointEntry` **ledger**'ına yazılır (bakiye kolonu YOK — bakiye=SUM(delta); satır güncellenmez/silinmez, ret-iptal İADE SATIRI üretir; `@@unique(doctorId,surveyId)` çift puanı DB'de keser) → doktor `/doktor/doctorium/oduller` "Puanlarım"da biriktirir (başlıkta bakiyeli rozet; sayfa v6.87 segment-layout kapısı ALTINDA) → katalogdan talep eder (`RewardItem`: **Yurt içi kongre · Uluslararası kongre · Tıbbi kitap**; `RewardRedemption` REQUESTED→APPROVED→FULFILLED **daima insan onaylı**, doktor yalnız REQUESTED'ını iptal eder; puan talep ANINDA rezerve düşer — çifte-harcama `pg_advisory_xact_lock` ile serili, ⚠️ `$executeRaw` şart [`$queryRaw` void'de P2010]). Admin: `/admin/oduller` (katalog + talep kuyruğu; kalem girişi öncesi ⚖️ ayni-menfaat uyarısı [vergi + 657 kamu doktoru] kaldırılamaz) + `/admin/anket` formunda puan alanı. **Katalog BOŞ başlar** — doktor "yakında" görür, vaat ilk kalemle başlar (👤 hukuki değerlendirme sonrası). **Puan ≠ nakit:** parasal değer atfedilmez ("1 puan = ₺X" hiçbir yüzeyde yok), koşul metni TASLAK etiketli/kaldırılamaz; nakit honorarium ACTIVE-kilidi bu sistemden BAĞIMSIZ sürer. API: `GET /api/rewards` · `POST/PATCH /api/rewards/redeem` · `/api/admin/rewards` (+`/redemptions`) — hepsi self-auth. **v6.95 — TIP ÖĞRENCİSİ ÜYELİĞİ (2026-08-14, kullanıcı kararı):** üçüncü Aşama-1 damgası — e-Devlet öğrenci belgesi (`STUDENT_CERT`, tekil) yüklenince `Doctor.studentVerifiedAt` **OTOMATİK** damgalanır (CHAMBER deseni); Doctorium kapısı `chamberLetterAt ∨ activatedAt ∨ studentVerifiedAt` (`hasDoctoriumAccess` üç alanı ZORUNLU tutar — eksik select derlemede kırılır, `deletionLockedAt` deseni). **Ayrı huni:** `/ogrenci` (giriş+kayıt; vitrin footer'ında 9 dilde link) → `/api/auth/signup-student` (unvan/telefon/dil sorulmaz; `title` sabit `STUDENT_TITLE` "Tıp Öğr." — `DOCTOR_TITLES`'ta DEĞİL, test kilidi; **HealthTürkiye dizin doğrulaması ATLANIR** — öğrenci dizinde olmaz, yanlış NOT_FOUND bayrağı üretilmez) → hesap `Doctor.studentTrack:true` doğar → `/doktor/baslangic` **öğrenci modu**: yalnız `StudentStage1Card` (diploma/MMSS/tabip odası/rıza blokları HİÇ render edilmez) + **"Mezun oldum"** çıkışı (`POST /api/doctor/graduate` — `studentTrack:false`; yetki AÇMAZ, yalnız onboarding modu değişir). **Pazarlama süzgeci `isStudentOnly`** (damga ∧ ¬aktivasyon; öğrenci sağlık meslek mensubu DEĞİLDİR — meslek-mensubuna-tanıtım rejimi ona uygulanamaz): sponsor kartı + anket (COMMUNITY dahil) + ödül puanı rozeti ÇİZİLMEZ, `survey/respond` + `rewards/redeem` **403** (talep İPTALİ [PATCH] bilinçli açık — rezerve puan iadesi hak), `/oduller` akışa redirect. **Sade krom:** `navItemsFor {student}` → üst bant yalnız Doctorium; hesap menüsünde Profilim/Finans gizli; mono rol etiketi "Tıp Öğrencisi". `.edu.tr/.edu/.ac.xx` e-posta yalnız **ROZET** (`isEduEmail` — kapı açmaz; kanıt daima belge). Klinik kapılar (`activatedAt`) ve v6.90 ters-yön kesikleri DEĞİŞMEDİ. Migration'lar `20260814150000` + `20260814170000` (idempotent, IF NOT EXISTS). Mezuniyette diploma+MMSS ile aynı hesaptan doktor üyeliğine geçilir (süzgeç kendiliğinden kalkar; öğrenci belgesi Aşama-2 listesine sızmaz). **v6.97 — DOCTORIUM ÇALIŞMA ALANI (2026-08-14, 6 turlu kullanıcı-onaylı görsel oturum):** Doctorium "sekmeli sayfa"dan sol bantlı çalışma alanına dönüştü. **Sol bant** `DoctoriumSidebar` + `DoctoriumShell` (SERVER component — ilk deneme layout'ta `useSearchParams`'lı client banttı, Next 16'da Suspense $RC tamamlanma sinyali hiç gelmedi ve bant `div[hidden]`'da asılı kaldı; aktifliği zaten bilen page'ler Shell'i kurar, layout kapı-only kaldı): viewport soluna fixed, gruplu (BİLGİ/MESLEĞİM/KİŞİSEL — grup başlıkları tıklanmaz), modül-renkli aktiflik (3px şerit+%10 dolgu, Cover deseni), 15px punto; içerik `md:pl-[max(13.25rem,calc((100vw-64rem)/2))]` ile /doktor hizasında (dar ekranda bant payına düşer); mobil **M2 alt çubuk** (Akışım·Bilgi·Mesleğim·Kayıtlı·Puanlarım) + page'de grup şeridi. **Bölüm renk/sembol kararları:** Akışım kıvılcım/sarı `#facc15` · Akademik şişe/zümrüt (branş rengi kartlarda KALKTI — tüm akademik yeşil) · Sektörel bina/mor · İlaç hap/camgöbeği · Kongre takvim/**tema-duyarlı ink** · Kariyer yükseliş/mavi `#60a5fa` · Hukuk **gül** `#fb7185`; **amber yalnız ticaretin işareti**; **sembol takası: terazi=mevzuat · çekiç=içtihat** ([id] "Doktor özeti" başlığı ScrollText'e geçti; Etik Kurul/DecisionForm çekiçleri karar bağlamında KALDI). **Krom katmanı** `--c-chrome` (Header cam-mix'i + SiteFooter + bant; gece #08090b / gündüz #eaede8) + `html{scrollbar-gutter:stable}` (kısa sayfalarda [Post-Op/Sistem Mesajları/Profilim] scrollbar kaybolunca ortalı blok kayıyordu — sekme geçişi "oynaması"nın kökü) + **/doktor·Post-Op·Doctorium genişlikleri 5xl'de eşitlendi** (takip 4xl→5xl; "daralıp açılma" hissinin diğer yarısı). **Modül üst alanları** (mono etiket [modül renginde] + 30px display başlık + tek satır açıklama; metinler kullanıcı onaylı: "Sizin için seçilenler" · "Branşınızda hakemli yayınlar" · "Sağlık gündeminin nabzı" · "Geri çekmeler ve klinik fazlar" · "Kongre takvimi" · "Doktorluk yollarının haritası" · "Sağlık hukuku, tek yerde") — v6.48 pill nav + Puanlarım pill'i KALKTI. **KART STANDARDI** (`ArticleCard.tsx`'e taşındı — Kaydettiklerim de aynı kartı kullanır; Post-Op kartı birebir örnek): 112px kapak bölmesi YOK — kartın sol kenarında 3px BÖLÜM şeridi + üst satırda küçük sembol+bölüm etiketi (sağ üstte Kaydet) + altında tür rozeti (`KIND_LABEL`) ve keyword'ler (kategori+branş çipleri; içtihat kanun/terim çipleri) + başlık/alt-başlıklar (kaynak·tarih) + **hairline çizgi** + tür-uygun linkler ("Detay" jeneriği YOK: "2 dk klinik özet" · "Kararı oku →" · "Kongre kartı →" · "Süreç adımları →" · "Devamını oku →" + "kaynağı aç"); **sponsor + sponsorlu-anket TÜM ÇEVRE kalın amber** (`border-2 border-amber-400/70`; kapakları da kalktı), topluluk anketi gök şeritli standart kutu; Kongre/Kariyer bölüm listeleri de aynı anatomide (kongrede Kaydet, Takip'in yanında). **KAYDETTİKLERİM:** `SavedArticle` (CongressFollow deseni — ilişkisiz düz id, `@@unique(doctorId,articleId)`; migration `20260814210000`) — **ÜÇ KAYNAKLI** kaydetme: makale id · kongre id · kariyer SLUG (`POST /api/doctorium/save` üç tabloda doğrular; `savedFeed` üç kaynaktan birleştirir, silinen kaynak sessizce atlanır) + `SaveButton` (optimistic toggle) + **`/doktor/doctorium/kaydettiklerim`** + bantta KİŞİSEL'in İLK sırası; puan ÜRETMEZ; öğrenci-sınırlı üye de kaydedebilir (içerik işlevi — pazarlama yüzeyi değil). **AKIŞ TERCİHLERİ:** `Doctor.feedModules` (nullable; null/boş=TÜMÜ; migration `20260814213000`) + `POST /api/doctor/feed-modules` (6 bölüm anahtarı süzülür; TÜMÜ seçiliyse null yazılır — bölüm listesi büyürse eski kayıt yenisini otomatik görür) + Özelleştir panelinin **İLK bölümü** (6 çip; son çip kapatılamaz — boş akış anlamsız). **Akış = BÖLÜM-KOTALI KARIŞIM** (`personalFeed` yeniden yazıldı): eski tek "en yeni 40" sorgusu yoğun sektörel/haber akışının altında hukuku (hele ARŞİV tarihli içtihat/doktrini) TAMAMEN boğuyordu → her seçili bölümden kendi kotası (akademik 14 [branş-eşleşmeli] · sektörel 8 · ilaç 6 · hukuk **4+2+2 kind-alt-kotalı** · kongre 3 · kariyer 3), tek listede tarihe göre birleşir; **kongre/kariyer akışa normal KART olarak girer** (`createdAt` ile — `startDate` gelecek tarihli tepeyi işgal ederdi; kariyer kartı id=slug, kartlar kendi detay rotalarına). Bant "Tercihler" öğesi ÇİZİLMEZ (`/tercihler` v6.49'dan beri redirect — koşullu-href ilkesi). **v6.98 PROFİL YENİDEN DÜZENİ + MEDYA:** Bildirim Tercihi Ana Sayfa kartından `/doktor/profil` bölümüne taşındı (sıra: Eşleştirme Kalite Skoru [varsayılan-KAPALI `<details>` akordeonu — chevron'da açılınca sönen ışıma, Doz 1 bilinçli istisna] → Bildirim Tercihi → Profil Tercihleri → Yaptığım İşlemler; 5 kutu başlığı mono-etiketten `aura-display` 17px `h2`'ye — onboarding'deki ProcedureSelector/AcademicEditor de aynı görünümü alır). **Profil Tercihleri YENİ içerik:** Profil Resmi (≤5MB) + Video Kart (URL VEYA dosya; ≤60 sn İSTEMCİ-doğrulamalı [sunucu süre ölçemez — gerçek tavan 50MB] ) + Hakkımda (2000 kr → vitrin `richBio` kaynağı) + Birim katılımı KORUNDU; dil/pazar/kapasite düzenleme YÜZEYİ kalktı (`/api/doctor/preferences` KISMİ güncellemeli — yalnız gövdede gelen alan yazılır, geriye-uyumlu). **Medya = `@vercel/blob` client-upload:** `POST /api/doctor/media-upload` token bekçisi (4.5MB fonksiyon gövde limiti nedeniyle tarayıcı→Blob DOĞRUDAN; public store — profil medyası PHI DEĞİL, klinik belgeler `lib/storage.ts` şifreli private'ta kalır); medya değişiminde eski blob silinir; CSP dar genişletme (connect-src `vercel.com` + `*.blob.vercel-storage.com`; img/media-src blob storage). `Doctor.introVideo` (migration `20260814230000`; ⚠️ şema satırı paylaşımlı-dosya kazasıyla v6.97 commit'ine karışmıştı — kolon prod'a o deploy'la gitti, migration dosyası v6.98'de tarihçeye girdi). Hero'da yüklenen foto baş harf avatarının yerine geçer. **v6.99 — AKIŞ DİSİPLİNİ + GÖRSEL KATMAN (2026-08-15/16, çok turlu kullanıcı-onaylı oturum):** (1) **Doktrin hukuk süzgeci** `lib/doktrin-filter.ts` — konuma duyarlı skor (başlık+3 · keyword+2 · özet+1 · hukuk-dergisi+3; özetteki rutin "onam alındı/etik kurul" kalıbı özet kanalını SUSTURUR [kirliliğin kökü buydu — matchesQuery ibareyi özette buluyordu]; tıp bağlamı şart, veteriner kesin dışlanır; desenler KÖK biçimde ["tıbbi uygulama hata"] + EN karşılıkları); arşiv temizliği `scripts/temizle-doktrin.ts` (dry-run varsayılan) — dev+prod 57'şer kayıt silindi → 135'er hukuk-odaklı. (2) **Akademik seçkin-dergi katmanı** `lib/academic-journals.ts` — 113 dergilik küratörlü beyaz-liste (hepsi PubMed `[ta]` doğrulamalı; ⚠️ NLM "core clinical journals"[sb] ÖLÜ — 0 sonuç) + kanıt tipleri (RCT/meta/sistematik/çok-merkezli/rehber; editöryel-mektup dışlanır); katman 1 eksik kalırsa katman 2 (kanıt-only) tamamlar — 30 branşın 29'unda K1 dolu. (3) **Sektörel "doktor haberleri":** İstanbul Tabip Odası (🪤 /haberler JS-boş — sayfanın kendi Ajax ucu `views/haber/gethaber.view.php` POST Limit) + Medscape + Medical Xpress (`ingestRss`; 🪤 Medscape tarayıcı-UA'lı Node isteğine 403, BAŞLIKSIZA 200 [OHSAD dersinin tersi] → 403/429'da başlıksız yeniden dener) — hepsi `isProfessionallyRelevant` süzgecinden (reklam/advertorial + tüketici içeriği + kurum-içi etkinlik gürültüsü elenir); kategoriler 6→8 (**meslek** + **kuresel**; WHO teknoloji→kuresel) + Özelleştir'de **Kaynak** filtresi (?s= ulusal/uluslararası; `SECTOR_SOURCE_SCOPES` ingest kaynak setiyle sözleşme-testli) + branş bölümünde menekşe **"Tüm branşları seç"**. (4) **Haber detayında kaynak görseli:** `NewsArticle.imageUrl` (migration `20260816100000`; hotlink + kaldırılamaz "GÖRSEL: {kaynak} — KAYNAĞA AİTTİR" atfı — next/image bilinçli değil [optimizasyon=kopya]; çıkarım TEMBEL yalnız yeni kayıtta: RSS media → og:image; TTB özel-CA yolu dahil) — `NEWS_IMAGE_HOSTS` allowlist ↔ CSP img-src dar genişleme SÖZLEŞME-testli; yalnız ULUSAL kaynak fotoğrafı gösterilir, uluslararasıda (Getty/thumbnail kalitesizliği) kaynak LOGOSU bandı: Medscape (siyah-yazılı logo → BEYAZ plaka) · MedicalXpress · WHO (sitenin kendi h-logo-white.svg'si) + künye şeridinde açık URL. (5) **Kapak/band katmanı `CoverArt.tsx`:** kart 72px koyu plaka — akademik+branşlı içerik lucide BRANŞ İKONU (`components/branch-icons.tsx` — BranchAvatar setiyle TEK kaynak; üç netleştirme turu sonrası kullanıcı kararı), diğer bölümler Higgsfield sembol webp'leri (`public/doctorium/`; stil referansı kardiyoloji branş sembolü; kongre=tıp-artılı takvim, ilaç=tek kapsül [sade — "küçülünce anlam kaybı" ilkesi]); detay bandı öncelik: kaynak logosu → hukuk yassı bandı (mevzuat=terazi+§ · içtihat=tokmak+yankı halkaları · doktrin=kitap+sütun; letterbox üretim + içerik-kırpma ~4.2-5.4:1; 🪤 sabit 120px kutu+object-cover bandı KIRPIP büyütüyordu → w-full h-auto; 🪤 stil referansından MOTİF sızabilir [ilk mevzuat bandına kardiyoloji kalbi girdi — gözle yakala]) → branş ikonu → modül sembolü. **TEMA:** koyu zemin webp'lere gömülü → `public/doctorium/light/` gündüz varyantları (zemin şeffaf + çizgi %48 koyulaştırma) ve seçimi CSS yapar (`[.theme-light_&]` — 🪤 SUNUCUDA cookie okumak YANLIŞTI: ThemeToggle yalnız html class'ını anında değiştirir, RSC yeniden render olmaz). (6) Detaylarda ham metin dökümleri KALKTI (akademik "Özgün abstract" + mevzuat/sektörel/ilaç "Resmî metinden"; İçtihat karar metni ve Doktrin özeti esas içerik — kaldılar). Testler: `tests/unit/doctorium-filtreler.test.ts` (26 sözleşme testi, vakalar canlı veriden).

**Kongre modülü v2 (v6.63, 2026-08-03) — KÜRATÖRLÜ VERİTABANI:** otomatik agregatör YOK (kongreuzmani/doktorbun/emedevents/clocate ölçüldü: bot korumalı · JS-render · ToS engelli) → 30 branşın ulusal + uluslararası kongreleri **iki turda** (6 araştırma + 3 doğrulama ajanı) **resmî sitelerinden** derlendi: **113 kayıt** (95 doğrulanmış / 18 kısmi), `prisma/seed-data/congresses.json` + vault `output/kongre-veritabani-2026-08-03.md`. Şema (`20260803120000`): `source`/`externalId` (+unique → idempotent seed; elle kayıtlarda null, çakışmaz) · `scope` · `edition` · `frequency` · `venue` · `format` · `language` · `cmeCredit` · `registrationNotes` · `themes` · `warning` · `coverImage` · `sourceUrls` · `confidence` · `verifiedAt`. **Arayüz:** branş tercihi artık Kongre sekmesinde de GÖRÜNÜR (🐛 v6.48'den beri süzüyordu ama seçici çizilmiyordu — doktor göremediği filtreyle eksik liste görüyordu) · **ulusal/uluslararası filtresi** (`?s=`, paylaşılabilir URL) · **kongre kartı** `/doktor/doctorium/kongre/[id]` (künye + kayıt koşulları + ⚠️ uyarı bandı [ERA·IDWeek·EPA sahte kayıt sitesi ihbarı yayımlıyor] + kaynak listesi + doğrulama tarihi) · **takvime ekle (.ics)** — RFC 5545 metnini kendimiz üretiyoruz (dış servis yok, CRLF+75 oktet katlama, anonim 401). **Görsel (v6.67, 2026-08-04):** kapaklar `scripts/fetch-congress-covers.ts` ile doldurulur — og:image (yedek twitter:image) yerelden indirilir, sharp ile ~320px webp'e re-encode edilir (SVG/aktif içerik sökülür) ve **Claude vision elemesinden** geçenler (**yalnız "kongreyi tanıtan afiş"**; dernek logosu/soyut süs/stok foto/yanlış edisyon RED — şüphede RED, `ANTHROPIC_API_KEY` yoksa script koşmaz) **data URI** olarak `coverImage`'a yazılır. ⛔ CSP `img-src 'self' data:` dış hostu engeller — **politika gevşetilmedi**, data: zaten izinliydi; görseli olmayan/elenen kongrede branş amblemi çizilir. İlk prod koşusu: 102 adaydan 17 kapak, 17 AI-elendi, 62 og:image'sız. ⚠️ Liste sorguları (`upcomingCongresses` + admin) AÇIK select'lidir — data URI'lar listeyi şişirmesin; kongre kartına yeni alan eklerken select'e de ekle. **Program/konuşmacı KOPYALANMAZ** (telif + kongreden 1-2 ay önce kesinleşir → bayat bilgi riski): tema + resmî programa bağlantı. **Tazeleme döngüsü:** `scripts/congress-refresh-queue.ts` kademeli iş listesi üretir — 🔴 kritik tarihi ≤90 gün (haftalık; bu tarihler UZATILIYOR) · ⚫ geçmiş (sonraki edisyon arama kuyruğu) · 🟡 kısmi (aylık) · 🟢 soğuk (3 aylık); `verifiedAt`'e bakar, aynı kaydı gereksiz taramaz. ⚠️ Kongre verisi ASLA tahmin edilmez — bilinmeyen alan boş kalır (uydurma tarih = yanlış alarm = doktorun gerçek kaybı).
**Kariyer modülü (v6.89, 2026-08-12) — KÜRATÖRLÜ DENKLİK REHBERİ, İLAN/ARACILIK YOK:** Doctorium'un 7. sekmesi (`kariyer`, Kongre'den sonra · Hukuk'tan önce). Alt-sekmeler `CAREER_TABS` = **Yurt Dışı · Türkiye** (`?t=`; v6.86 `LEGAL_TABS` deseninin eşleniği — ⚠️ `?c=` sektörel kategoriye ait, çakışmaz). **⚖️ Kapsamı HUKUK belirledi:** Özel İstihdam Büroları mevzuatı "başvur butonu, üyelik sistemi ya da kayıt işlemi OLMAKSIZIN" ilan gösteren siteyi muaf tutuyor; üyelik arkasında ilan sunmak **"iş ve işçi bulmaya aracılık"** sayılıyor → İŞKUR özel istihdam bürosu izni şart (aksi halde idari para cezası) + iş arayandan (doktordan) ücret ALINAMAZ. Doctorium üyelik arkasında olduğundan bu fazda **başvuru butonu · CV gönderimi · işveren eşleştirmesi YOKTUR**; ekranda bunu söyleyen kalıcı not var ("Bu bölüm iş ilanı içermez"). İzin alınırsa AYRI sekme açılmaz — aynı `CAREER_TABS`'a **"İK Fırsatları"** eklenir ve v6.87'de toplanan `Doctor.hrContactOptInAt` rızası ORADA kullanılır (kullanıcı kararı). **Veri = küratörlü** (`CareerPathway` + `prisma/seed-data/career-pathways.json` + `scripts/seed-career-pathways.ts`; kaynak belgesi vault `output/kariyer-denklik-veritabani-2026-08-12.md`): resmî otorite siteleri makine erişimine KAPALI (2026-08-12 ölçümü — `gmc-uk.org` **HTTP 403**, `anerkennung-in-deutschland.de` **404**; TTB/RG ile aynı sınıf) → otomatik toplayıcı imkânsız, kongre modülünün deseni uygulandı. **İlk 6 süreç:** Almanya Approbation · Dubai DHA · Suudi SCFHS · UK GMC · ÜAK doçentlik · İyi Hal (Good Standing) belgesi. **Şema dürüstlük alanları:** `officialUrl` + `verifiedAt` **ZORUNLU** (kaynağı olmayan kayıt yazılamaz) · `confidence` (`dogrulandi|kismi` — kısmi kayıt kartta **"⚠️ Teyit bekliyor"** ibaresiyle çıkar) · `warning` (kayda özgü uyarı: Almanya'da eyalet farkı · BAE'de tek lisans olmadığı · Good Standing'de **Bakanlık ve TTB belgelerinin her ülkede birbirinin yerine geçmediği**) · `steps`/`documents` JSON. ⚠️ **`typicalMonths` 6 kaydın 6'sında NULL** — hiçbir süre resmî kaynaktan doğrulanamadı, ikincil kaynaktaki "3-6 ay" YAZILMADI (tahmini süre = doktorun yanlış planlaması). Kartlarda **"Son doğrulama: …"** görünür (bayatlık gizlenmez). Danışmanlık şirketi blogları kaynak olarak KULLANILMAZ (ticari çıkar + denetimsiz güncellik) — yalnız resmî otorite adresleri. Ekranlar: liste (`CareerList`) + detay `/doktor/doctorium/kariyer/[slug]` (adımlar · belge listesi · resmî kaynak · "bu bilgi nereden geliyor" · kaldırılamaz "hukuki/idari danışmanlık değildir" uyarısı); ortak parçalar `CareerShared.tsx`'te (route dosyasından bileşen import etmek Next.js'te kırılgan). **Kalan (teyit bekliyor, seed'e ALINMADI):** Almanya Berufserlaubnis · Abu Dhabi DOH · TUS/YDUS · mecburi hizmet — *eksik kayıtla yayına çıkmak, yanlış kayıtla çıkmaktan iyidir.*

| 6 | **Doktor Tanıtım** | ✅ Doktor dizini + doğrulanmış profil (**verified-kapılı** — doğrulanmamış doktor public profil alamaz), **gerçek profil fotoğrafı** (`Doctor.photo` per-doktor / cinsiyet-fallback) + **tanıtım videosu** (cinsiyete göre), yorumlar (gerçek Review; üretim-fallback **"örnek değerlendirme" etiketli**), akreditasyon (JCI — yalnız gerçek veri, uydurma varsayılan yok), **kalıcı akademik** (düzenlenebilir) |
| 7 | **Etik Kurul** | ✅ Şikayet (**hasta ilgili/karşı tarafı beyan eder, v6.81**: Doktor/Acente/Hastane yetkilisi/Platform-diğer — zorunlu), anonimleştirilmiş (data masking) inceleme, **karşı taraftan savunma/bilgi talebi** (v6.81: kurul kimlik GÖRMEDEN talep açar → Sistem Mesajları'ndan hedefe düşer [atanmış doktora kişisel; acente rol-yayın; hastane/platform/atanmamış-doktor → koordinatör vekaleten]; **karar formu talep açıkken kilitli — yanıt VEYA 3 gün**, cron'suz zaman-bazlı, PATCH da 409 reddeder; yanıt kurula "Karşı taraf (tip)" anonim etiketiyle iner + `DEFENSE_REPLY` bildirimi; audit `DEFENSE_REQUEST/REPLY` içeriksiz), karar/yaptırım (**v6.81: Yaptırım kapalı select → 5 açık kart**; escrow'suz vakada iade kartları gri) — kurul yüzünden **AI gerekçe + aciliyet rozeti kaldırıldı** (veri minimizasyonu), **Escrow iade** tetikleyicisi |
| — | **Tedavi Kararı → STA akışı (2026-07-10)** | ✅ Görüşme ekranında **birleşik Klinik Kodlama + Tedavi Kararı** paneli (`ClinicalDecisionPanel`): ICD-10 tanı → **"Sağlık Turizmi Planlaması" tuşu** (v6.4 — tedavi/işlem + süre + hastane planı yalnız bu tuşla açılır; basınca tanıya göre **AI işlem önerisi otomatik sıralanır**, doktor seçer; tuş öncesi plan kapalı) → **tanıya eşlenmiş işlemler** (küratörlü statik eşleme `data/icd-procedures.ts` + **AI işlem önerisi** `/api/ai/suggest-procedures`) → taban↔tavan slider ücret (onboarding artık ücret SORMAZ; doktor fiyat hafızası karar kaydında güncellenir) → **öngörülen tedavi süresi (gün aralığı)** → **hastane seçimi** (HealthTürkiye dizini) → Kaydet = dosya **Sağlık Turizmi Acentesine** iletilir (`agencySentAt` + AGENCY bildirimi). Eski "Paketi oluştur / AI Teklif hazırla / Sağlık Turizmi Paketi" düğmeleri kaldırıldı — **teklifi acente hazırlar** (`/acente`, kısıtlı dosya, `mode=offer`). **AI Epikriz post-op ekranına taşındı** (`/takip/[caseId]` personel görünümü); hasta aynı ekrandan **"Epikriz iste"** talebi açar (`dischargeRequestedAt` + doktora bildirim) |
| — | **HealthTürkiye kayıt defteri (2026-07-10)** | ✅ `healthturkiye.gov.tr` resmi dizini günlük senkron (`lib/ht-registry.ts` — web-api.healthturkiye.gov.tr; ~10.000 doktor + ~4.600 tesis; soft-delete diff) → `RegistryDoctor`/`RegistryHospital`/`RegistryReport`; **cron** `vercel.json` → `/api/cron/registry-sync` (günde 1, `CRON_SECRET`) → **günlük eklenen/çıkarılan raporu** `/admin/registry-raporu` + ADMIN bildirimi. **Doktor kayıt doğrulaması:** signup'ta ad-soyad dizin eşleşmesi → `Doctor.registryStatus` → `/admin/doktor-onay`'da yeşil rozet / **kırmızı uyarı bayrağı**. Tedavi kararındaki hastane seçici bu dizinden (`/api/registry/hospitals`). **Detay zenginleştirme (2026-07-10):** tesislerin **hizmet dilleri / akreditasyon / olanak adları + sağlık turizmi yetki belge no'su** (`authorizationNumber`, ör. "ST-0292") sitenin SSR detay JSON'undan doldurulur (`enrichHospitalDetails` — cron'da 40/gün + ilk toplu doldurma `scripts/registry-enrich.ts`; belge-no backfill `… auth`); hastane seçici sonuçlarında 🌐 diller + 🏅 akreditasyonlar + **🛡 yetki belgesi rozeti**; rozet **hasta yüzünde** de görünür (teklif `/teklif` + rezervasyon `/rezervasyon` paket kartında, çevrili etiketle) ve acente dosyasında hastane kartında. **Alan-güncellemesi (v5.4):** liste-API alanlarının kısa hash'i (`fingerprint`) satırda tutulur; günlük senkron yalnız hash'i değişen kayıtları günceller (ad/şehir/branş değişimleri; tavan 1000 — aşımı rapor notuna düşer, enrichment alanları etkilenmez); ilk doldurma `scripts/registry-fingerprint-backfill.ts`, rapor sayfasında "✎ güncellendi" sayacı |
| — | **Bildirim kanalı + hasta iletişim (2026-07-10)** | ✅ Doktor Ana Sayfa **bildirim tercihi** (Uygulama/WhatsApp/SMS — WA+SMS **dormant simülasyon** `lib/messaging.ts`, env anahtarı eklenince gerçek gönderime hazır; kayıt formunda cep telefonu alanı, at-rest şifreli) · **4 hasta intake'inde** (triyaj/SO/turizm/ücretsiz) telefon + "hangi yoldan ulaşalım?" (Uygulama/SMS/E-posta) → `patientPhone` (şifreli) + `contactPreference` · **Partner-konsültasyon videosu 10 dk sınırlı** (7'de kırmızı, 9'da iki tarafa uyarı; otomatik kesme yok) |
| — | **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul/admin/**partner**/**acente[AGENCY]**), bcrypt + JWT + proxy + KVKK onam kapısı + **doktor self-signup** (`/kayit`; e-posta + Google OAuth + **Apple OAuth — CANLI 2026-08-06** [ikisi de env yoksa dormant; Apple `.p8` girişte PEM'e normalize edilir]) + **e-posta doğrulama** (v5.6, `RESEND_API_KEY` yoksa dormant: yeni e-posta kayıtları doğrulama bağlantısı almadan giriş yapamaz [mevcut/demo hesaplar muaf, Google doğrulanmış sayılır]; `lib/email.ts` + `lib/email-verification.ts` + `/api/auth/verify-email` + `/api/auth/resend-verification`) |
| — | **Partner Doktor + Konsültasyon Havuzu** | ✅ **Partner Doktor** (`PartnerDoctor` + `PARTNER` rolü, `/partner`): hasta DB erişimi YOK, anonim konsültasyon talebi açar (+**tıbbi belge yükleme** → `assessDocument` AI: tür/TR çeviri/özet/anormal bayrak/LOINC lab) → **anonimleştirme katmanı** (`lib/deidentify.ts`: yapısal de-id + TC/pasaport/e-posta/telefon scrub) + **DICOM PHI tag-strip (v6.32, `lib/dicom-deidentify.ts` dcmjs):** partner `.dcm` yükleyebilir — kimlik/kurum/doktorlar/tarih etiketleri kayıt ÖNCESİ boşaltılır (PS3.15 alt kümesi; UID'ler yenilenir, private tag'ler silinir, açıklamalar scrub'lanır; sıyrılamayan dosya fail-closed REDDEDİLİR) + **burned-in piksel PHI maskeleme (v6.37, `lib/dicom-pixels.ts` + `lib/dicom-burnin.ts`):** görüntünün İÇİNE işlenmiş yazılar da kapatılır — sunucuda piksel çözme (6 transfer syntax: sıkıştırmasız · RLE · JPEG Baseline · Lossless · JPEG-LS · JPEG 2000) → maskeleme → sıkıştırmasız yeniden yazma; maskeler (a) standarda dayalı OTOMATİK kurallar (US `SequenceOfUltrasoundRegions` dışı · cihaz bilgi şeridi · `BurnedInAnnotation` sinyali) ve (b) yükleyenin `DicomRedactEditor`'da çizdiği kutulardan gelir (auth'lu `/api/dicom/redact-preview` PNG önizlemesi; **maskeyi DAİMA sunucu uygular**, istemci yalnız koordinat gönderir). **OCR/tahmin BİLİNÇLİ YOK** (klinik alanı yanlış karartma riski) → beyan kutusu KALIR, metni sorumluluğu açıkça yükleyende bırakır. Maskeleme yalnız HAVUZ kopyasına; vakadaki asıl dosya değişmez (`PatientIdentityRemoved=YES` + `DeidentificationMethod` ne yapıldığını yazar) → anonim dosya auth'lu `/raw` ucundan mevcut **DicomViewer**'da açılır (yanıtlayan doktor + talebi açan partner; audit'li; AI değerlendirme DICOM'a uygulanmaz) + **iç vakadan havuza açılma (v6.33 Faz 3):** vakaya ATANAN doktor kokpitten "Havuzdan görüş iste" — `deidentifyCase` anonim özet taslağı (düzenlenebilir; yine scrub+redact'ten geçer) + seçilen belgeler (DICOM'lar aynı tag-strip'ten) → kendi talebi havuzda kendisine GÖSTERİLMEZ (`requestedByDoctorId`), gelen görüş vaka sayfası "Havuz Görüşü" kartına + bildirime düşer; TR özet `summaryTr`'ye çevirisiz yazılır → **`ConsultationRequest` havuzu** (at-rest şifreli; `/doktor/konsultasyon`'da kayıtlı doktorlar görüş + **kodlu öneri** verir: lab/görüntüleme=ServiceRequest, ilaç=MedicationRequest ATC). **Çift-yönlü AI çeviri** (özet→TR doktor · görüş→hasta dili partner) + **FHIR Bundle** (`/fhir/ConsultationRequest/[id]`). Yanıt başına ödeme simüle. **Yazılı görüşme (chat — Faz 2):** partner↔doktor çift-yönlü `ConsultationMessage` (at-rest şifreli + AI oto-çeviri; doktor nihai görüş öncesi de soru sorabilir → talebi atomik sahiplenir, IN_DISCUSSION). **Görüntülü görüşme (video — Faz 3):** presence/heartbeat (`/api/presence/ping`) + İcapçı offer/respond randevu (`ConsultationVideoAppointment`) + WebRTC oda (`/konsultasyon/gorusme/[id]`; sinyalleşme yeniden kullanımı + fallback chat) |

### Paralel hasta akışları

- **İkinci Görüş (Second Opinion):** genel triyajdan bağımsız akış — 12 durumlu state machine, 7
  Prisma modeli, CRM oto-atama + hoca kabul, 4 bölümlü yazılı görüş + video randevu teklifi, izole
  video oda (**AI canlı tercüme + transkript — M2 paritesi, ilk konuşma sesinde otomatik**). SLA:
  **600 USD · 5-7 iş günü · video 15 gün**. (`lib/second-opinion.ts`)
  **Başvuruda branş kapısı (v6.43):** "İlgili tıbbi branşı biliyor musunuz?" → *biliyorum* = branş
  seçici; *bilmiyorum* = tanı/durum alanı öne gelir + "Branşı belirle" → **triyajın mevcut ucu**
  (`POST /api/triage/analyze`) branşı önerir (kart: branş + güven + "doğru değilse değiştirebilirsiniz")
  ve hasta düzeltebilir. Yeni AI hattı YOK (`runTriage` LLM yoksa kural motoruna düşer ⇒ akış AI'a
  bağımlı değil); yeni rıza da gerekmez (`AiConsentGate` bu kulvarı zaten kapsıyor).
- **Ücretsiz Sağlık Hizmeti:** sağlığa erişimi kısıtlı hastaları gönüllü doktorlarla **ücretsiz** video görüşmede
  buluşturan akış — atomik eşleştirme, doktor konsolu + haftalık kontenjan. (`lib/free-care.ts`)

### Kesişen yetenekler

- **i18n (8+ dil) + RTL:** tüm hasta yüzeyleri çevrilir (Arapça/Farsça RTL dâhil); `Translation`
  cache + `lib/i18n.ts` + `/api/i18n` + `useT`. Klinik veri **TR kanonik** (doktor/AI etkilenmez).
  **Klinik/PHI serbest-metin** (epikriz/SOAP/uzman görüşü/talep açıklaması) hastaya çevrilirken ayrı
  yoldan geçer: `translateClinical` + `/api/i18n/clinical` + `useClinicalT` — **önbelleksiz** (düz-metin
  PHI `Translation`'a yazılmaz = at-rest şifrelemeyi baypas etmez) + hasta adı `[HASTA]` ile maskeli
  (de-id'siz dış AI'ya gitmez, KVKK/GDPR). Cache'li `useT`/`getTranslations` yalnız statik UI etiketleri için.
- **FHIR R4 dışa aktarım:** `/fhir/Composition/:caseId` (epikriz→Composition; ICD-10/LOINC/SNOMED) ·
  `/fhir/Consent/:shareId` + audit. (`lib/fhir.ts`)
- **PWA + Web Push:** kurulabilir uygulama; tarayıcı kapalıyken cihaz bildirimi (VAPID).
- **Bildirim Merkezi:** Header zili; rol- ve kullanıcı-hedefli `Notification`.
- **Operasyon Paneli (S2):** `/operasyon` — KPI, dönüşüm hunisi, gelir/Escrow, dağılımlar, trend, kapasite ·
  **Lojistik takip** (`/operasyon/lojistik` — rezervasyonların Patient Journey aşamalarını yönet; `lib/journey.ts`) ·
  **Kayıt defteri tarayıcısı** (`/operasyon/kayit-defteri` — HealthTürkiye doktor+tesis dizinini ara/filtrele/sayfala;
  ST yetki-belgesi rozeti + dil/akreditasyon chip'leri; doktor kayıtlarında şehir kaynakta boş → filtre veri gelene dek gizli)
- **Consent Manager + RFC 3161 ispat:** `/onam` tek seferlik KVKK onamı (`GENERAL_KVKK` scope); sürümlü `ConsentRecord` +
  hash-zinciri + zaman damgası + Onay Kanıtı (`/onam/kanit`). (`lib/consent.ts`, `lib/timestamp.ts`)
- **AI karşılama açık rızası (`AI_TRIAGE` scope, v6.4):** 4 kulvarda (triyaj · ikinci görüş · sağlık turizmi ·
  ücretsiz sağlık) semptom/tanı girişinden **ÖNCE** ayrı açık rıza kapısı (`components/AiConsentGate.tsx`) — AI'nın
  yalnız doğru branşa yönlendirme + yüklenen belgelerin çevirisi için işleyeceğini, tanı/tedavi kararı için
  kullanılmayacağını bildirir. **"Açık Rızam Vardır"** rızayı aynı ispat altyapısıyla kaydeder (`POST /api/consent/ai`,
  idempotent, `/onam/kanit`'te görünür), **"Süreci Sonlandır"** hastayı ana sekmeye döndürür. Rıza verilene dek asıl
  form **mount edilmez**. Metin ⚖️ **TASLAK** (`lib/ai-consent.ts`, `AI_CONSENT_VERSION` sürümlü). Ayrı migration
  gerektirmez (`ConsentRecord` scope zaten kompozit); `lib/consent.ts` scope-parametreli. (`lib/ai-consent.ts`)
- **Simültane tercüme açık rızası (`AI_INTERPRET` scope, v6.5):** dijital bekleme odasında
  (`components/PreConsultLobby.tsx` — cross-cutting; hem Talk `/gorusme/[id]` hem ikinci görüş
  `SoVideoRoom` görüşmelerinin önünde → 4 kulvar tek noktadan) canlı görüşmeden **ÖNCE** ayrı rıza kapısı —
  görüşme sesinin AI tarafından yalnız simültane tercüme için işleneceğini bildirir. **"Açık Rızam Vardır"**
  rızayı aynı ispat altyapısıyla kaydeder (`POST /api/consent/ai-interpret`, idempotent), **"Süreci Sonlandır"**
  hastayı ana sekmeye (`/vakalarim`) döndürür. Doktor görünümünde çıkmaz; rıza verilene dek kamera/mikrofon
  izni istenmez. Metin ⚖️ **TASLAK** (`AI_INTERPRET_VERSION` sürümlü). Ayrı migration gerektirmez. (`lib/ai-consent.ts`)
- **Değiştirilemez erişim denetimi (E2EE Faz 0):** klinik veriye her anlamlı erişim (vaka görüntüleme,
  klinik not, FHIR dışa aktarım, belge görüntüleme, **klinik kodlama / lab yazımı, AI belge analizi,
  epikriz üretimi**) `AccessLog`'a mühürlenir — append-only hash-zinciri + zaman damgası, küresel bir
  **advisory kilit** altında sıralanır (eşzamanlı yazımda çatallanmaz). Hasta `/erisim-kaydi`'da kendi
  kaydını; denetçi (Etik Kurul / Admin) `/denetim`'de küresel zincir bütünlüğünü doğrulanmış görür. (`lib/audit.ts`)
- **Uygulama-katmanı at-rest şifreleme (E2EE Faz 1):** hassas klinik kolonları (belge içeriği, transkript,
  SOAP, epikriz, triyaj semptom/gerekçe, post-op not/foto, İkinci Görüş içeriği, **hasta kimliği (ad + kimlik no)**) AES-256-GCM **envelope** ile şifrelenir (per-record DEK + env-KEK); sunucu
  gerektiğinde çözer → defense-in-depth (DB-dump + KEK'siz operatör). `DATA_ENCRYPTION_KEK` yoksa dormant
  (düz metin, okuma bozulmaz). KMS swap-point hazır. (`lib/crypto.ts`)
- **Post-op erişim daraltma (E2EE Faz 2A):** post-op takip tamamlanınca (doktor "Takibi tamamla" veya
  branş protokol süresi + tampon otomatik/lazy) klinik personel erişimi kapanır → **hasta-only**;
  daraltılan noktalar (kokpit, vaka API, FHIR, görüşme, check-in, kodlama/lab/AI) 403/409 döner +
  `POSTOP_ACCESS_DENIED` audit, tamamlama `RECOVERY_COMPLETE` audit. Hasta erişimi korunur. Hasta dilerse
  erişimi **yeniden açar** (geri-alma; `recovery/reopen` → `RECOVERY_REOPEN` audit + `Recovery.reopenedAt`,
  otomatik kapanma penceresi buradan yeniden başlar). Açma **hasta kararıdır** — klinik personel kendi
  erişimini geri açamaz. M4 paylaşımda iptal **ileriye dönüktür** (yeni erişimi durdurur; görülen veri geri
  alınamaz — bu UI'da net belirtilir). (`lib/postop-access.ts`)
- **Klinik nöbet rolleri:** Branş / İcapçı / Nöbetçi (`Doctor.clinicalState/onCall/sentinel`) +
  "online doktor yoksa 3-seçenek kapısı" (`/vaka/[caseId]` hub'ında) + `ConsultAppointment`. (`lib/clinical-duty.ts`)
- **CRM eşleştirme kalite indikatörleri (9 metrik):** doktor seçimi branş/müsaitlik dışında performans
  metadata'sıyla ağırlıklandırılır — rating · başarı · ücretsiz sağlık hizmeti · icap dönüş oranı · **yanıt süresi**
  (`Doctor.respCount/respTotalSec`) · **iptal oranı** (ConsultAppointment+SO CANCELLED) · **tamamlanan vaka
  hacmi** · **yorum hacmi** · **güncellik**. **Veri-olgunluk-farkında:** verisi olmayan oran/zaman metrikleri
  skoru dilute etmez (ağırlık aktif kümeye yeniden normalize) → "ölçekle değer artar". Uygulandığı yerler:
  Nöbetçi · SO oto-atama (+ yük dengeleme) · İcapçı fan-out. Doktor `/doktor/profil`'de kendi **kalite
  kartını** (genel skor + metrik dökümü), hasta `/doktorlar/[id]`'de **güven rozetlerini** (eşik-bazlı, anlam-renk,
  hover tooltip) görür. Ücretsiz Sağlık Hizmeti FIFO kalır. Metadata = klinik içerik değil → E2EE uyumlu. (`lib/match-score.ts`)
- **Hasta–doktor uyumu (soft boost):** kalite (mutlak) yanına vaka-özel uyum (göreceli) eklenir —
  pazar (`Doctor.markets` ⊇ `Case.country`) + acil vakada deneyim (`Case.urgency`≥4 → `Doctor.experienceYears`).
  Uyumlu doktor sıralamada öne çıkar; **uyumsuz ELENMEZ, yalnız geri sıralanır** (erişim korunur). markets boş =
  "tüm pazarlar". Dil kasıten kriter değil (simultane tercüme kapsar). Nöbetçi · İcapçı · SO oto-atamada etkin.
  Şema değişmez; "ölçekle değer artar" (doktorlar `markets` girdikçe etki büyür). (`fitScore` → `lib/match-score.ts`)
- **Görüşme öncesi oda (bekleme odası):** cihaz testi + geri sayım + 3 alt-durum + **atanan doktor
  özet kartı** (tıkla-genişlet: bio/akademik/güven rozeti/akreditasyon + video kartvizit + tam profil
  linki; `lib/doctor-card.ts`) + **hasta soru notu** (görüşme odasında da görünür+düzenlenebilir,
  `PatientQuestionsPanel`). 3 akış ortak (Talk/Ücretsiz Sağlık Hizmeti/İkinci Görüş) (`PreConsultLobby`).
- **Video kartvizit hasta dilinde:** karttaki tanıtım videosu (`DoctorVideoCard`) hasta dilini alır —
  varsa dil-bazlı varyant `public/videos/doctor-{male,female}-{dilkodu}.mp4` (ör. `-ar`) oynar, dosya
  yoksa varsayılana düşer (bilinen-404 tekrar denenmez); her durumda kanonik tanıtım metni
  (`VIDEO_CARD_SCRIPT`, `lib/constants.ts`) AI çevirisiyle hastanın dilinde **WebVTT altyazı** olarak
  basılır (video süresine eşit dağıtım, RTL dahil). Dil varyantı eklemek = mp4'ü klasöre koymak.
- **Sesle dikte (v6.0):** 4 hasta intake kulvarının (triyaj / İkinci Görüş / Ücretsiz Sağlık Hizmeti /
  Sağlık Turizmi) semptom/hedef alanına konuşarak metin girişi — tarayıcının **Web Speech API**'si ile;
  **harici servis/kütüphane YOK**, ses tanıma tamamen istemcide çalışır (PHI sunucuya ekstra gitmez).
  Çok dilli (`air_lang`→BCP-47); API'yi desteklemeyen tarayıcıda düğme gizli. (`components/DictationButton.tsx`)
- **30 branş görsel kimliği (v6.0):** her klinik branşa semantik renk + SVG amblem + renk-türevi CSS banner
  (`BRANCH_COLORS` + `branchBannerBg`; `BranchBanner` + `BranchAvatar`; `public/branches/*.svg` ×30 — Recraft
  vector). Yerleşim: triyaj bandı + `/vaka/[id]` banner + `/vakalarim` amblemleri (genel + İkinci Görüş).
  **`resolveBranchKey`** kritik köprü: `Case.branch` (LABEL) ile triyaj `effectiveBranch` (KEY) farkını tek
  noktada normalize eder (hem key hem label kabul eder). (`lib/branch-visuals.ts`)

## Rotalar

| Rota | Açıklama |
|------|----------|
| `/` · `/giris` · `/giris/e-posta` · `/kurumsal-giris` · `/kurumsal-giris/e-posta` · `/kayit` (+`/asamalar` — iki aşamalı doktor üyeliği açıklaması, v6.87) · `/kayit/hasta` · `/onam` (+`/onam/kanit`) | **AURA sinematik landing** (v5.9 — vitrinden taşındı: hero video+letterform, 4 chapter destesi, gsap+lenis; 9 dil statik `lib/aura-landing/copy.ts`, dil anahtarı `air_lang`). **Bölüm akışı (v6.8):** hero → chapters → nasıl çalışır (+AI sorumluluk notu) → doktorlar → **güven (6 ürün-kanıtlanabilir kart)** → kapanış; eski *Şeffaflık* bölümü v6.8'de Güven'e birleştirildi (`transparency.tsx` kaldırıldı — aynı iddiayı iki kez veriyordu). İddia kuralları: aşağıda "Vitrin iddia dürüstlüğü (v6.8)" · **SEO (v5.9.2):** canonical + OpenGraph/Twitter kart + 9-dil `og:locale:alternate` (tek URL — `lib/aura-landing/seo.ts`) + JSON-LD MedicalOrganization/WebSite · **hasta + kurumsal giriş kapıları** (kapı-içi e-posta formu v6.84; `/giris/e-posta` ve `/kurumsal-giris/e-posta` → kalıcı yönlendirme; kapılar `components/aura/auth-gates.tsx` + `gate-email-form.tsx`; kurumsal noindex) · doktor kaydı · **hasta üyeliği** · KVKK onam + Onay Kanıtı |
| `/how-it-works` | **Nasıl Çalışır rehberi** (v5.9 — vitrinden taşındı): 4 yolculuğun adım listeleri + tıkla-oynat rehber videoları + HowTo JSON-LD + OpenGraph (title template `%s · AURA`); global Header/SiteFooter bu rotada ve `/`'de gizli (sayfa kendi aura nav/footer'ını taşır). Eski vitrin aura-health.higgsfield.app tüm sayfaları buraya 301 yönlendirir |
| `/guven-ve-gizlilik` | **Güven ve Gizlilik** (v6.12): iddia dürüstlüğü sayfası — 10 bölüm × 9 dil (`copy.ts` `trustPage`), 5'inde **"neyi iddia etmiyoruz"** kutusu + FAQPage JSON-LD (cevap gövde+sınırı birlikte taşır) + OG 9 dil; global Header/SiteFooter burada da gizli (kendi aura nav/footer'ı). **`/trust` → 308.** ⚠️ Gizlilik Politikası **değildir**. Kurallar: Güvenlik notları "Güven ve Gizlilik sayfası (v6.12)" |
| `/v2` | **Yeni ana sayfa ÖNİZLEMESİ** (v6.14 · `components/aura/v2/{home,hero,entry-paths,nav}.tsx` · `copy.ts` `v2`, 9 dil). **noindex + sitemap'te YOK** — aynı içeriğin iki URL'de indekslenmesi `/`'nin SEO'sunu bölerdi. Canlı `/` **dokunulmadı**. **Bölümler:** nav (tek bakım mimarisi, v6.16) → hero (sahneli açılış) → entry-paths (video-arkalı 4 kart, `id="care"`) → mevcut how (`id="how"`)/doctors/trust → closing. **`/`'ye taşırken:** eski landing'e **git tag** (geri dönüş) → `app/page.tsx`→`V2Home` → `/v2`+noindex kalkar → sitemap'e girer → ⚠️ `.aura-brand` seçicileri artık landing'i de kapsar, **token/glow ölçümünü tekrarla** → ⚠️ `v2/nav.tsx` kök `aura/nav.tsx`'in yerini alır ve içindeki `/v2` hedefleri (logo · `#care` çapası) **`/` köküne döner**. Sözleşme: aşağıda "/v2 hero + entry-paths (v6.14)" + "/v2 nav (v6.16)" |
| `/sitemap.xml` · `/robots.txt` | **SEO altyapısı (v5.9.2 · v6.12):** `app/sitemap.ts` yalnız 8 halka açık rota (/, /how-it-works, **/guven-ve-gizlilik**, /giris, /kayit, /kayit/hasta, /second-opinion, /ucretsiz-saglik) · `app/robots.ts` hassas panel/API disallow + sitemap referansı. `SITE_URL` tek kaynak `lib/aura-landing/seo.ts` (domain taşınırsa tek nokta) |
| `/basla` | KALDIRILDI (v5.8) — eski linkler için `/triyaj`'a kalıcı redirect |
| `/saglik-turizmi` | **Sağlık Turizmi hasta-yüzü planlama** (v4.24-25): tercih (branş/ülke/seviye/gece) + endikatif paket önizlemesi (`computePackage`) + öz-yeterli "Talep Oluştur" → `POST /api/patient/tourism-request` (runTriage → tourism-etiketli Case, `Case.tourismPlan` JSON; doktor `/paket` PackageBuilder ön-değeri + kokpit 🧳 rozeti). Klinik-önce: bağlayıcı fiyat/rezervasyon daima doktor onayı sonrası (simüle/park; USHAŞ yetki belgesi + TÜRSAB hukuki zemini vault'ta belgeli) |
| `/triyaj` | Triyaj sihirbazı (tek ekran ödeme kapısı + 3 adım — v5.8) |
| `/vaka/[caseId]` | **Tek hasta vaka merkezi** (v5.8 F6): süreç tracker + 3-seçenek kapısı + vaka bilgisi + aktif görüşme CTA + teklif (`#teklif`) + rezervasyon (`#rezervasyon`) gömülü; eski hasta rotaları (`/triyaj/[id]` · `/teklif/[bookingId]` · `/rezervasyon/[bookingId]`) buraya kalıcı redirect |
| `/vakalarim` · `/erisim-kaydi` | Hastanın vaka ana ekranı · erişim denetim kaydı ("verime kim erişti") |
| `/doktor` (+`/baslangic`, `/profil-tamamla`, `/vaka/[id]`, `/takip`, `/profil`, `/ucretsiz-saglik`, `/konsultasyon`) | Doktor Ana Sayfası (pencere-tabanlı, v6.41 birleşik vaka listesi), ilk-giriş onboarding (**v6.87'den beri iki aşamalı** — Aşama 1: tabip odası yazısı → yalnız Doctorium; Aşama 2: klinik havuz), **OAuth profil-tamamlama ara sayfası** (v6.87 — Google/Apple hesabı branş/şehir boş açılır, bu ekran doldurtur), kokpit, izleme, profil, Ücretsiz Sağlık Hizmeti, klinik nöbet, Konsültasyon Talepleri kutusu |
| `/partner` (+`/talep`) | Partner Doktor paneli (**tüm arayüz partner dilinde + RTL**, haber akışı dahil) · anonim konsültasyon talebi oluşturma (belge yükleme, hasta DB erişimi yok). **2026-08-12:** doğrulanmamış partner (staffVerifiedAt yok) `/kayit/durum`'a düşer |
| `/kayit/{partner,acente,saglik-uzmani}` · `/kayit/durum` | **Kurumsal üyelik başvuruları (2026-08-12):** rol-config soru setli self-signup formları (public; `StaffSignupForm` tek motor) · **başvuru durumu** (oturumlu — PENDING özet+belge yükleme · REJECTED gerekçe+düzelt-yeniden-gönder; doğrulanmamış personelin iniş sayfası) |
| `/uzman` | **Sağlık Uzmanı başlangıç paneli (2026-08-12, HEALTH_PRO):** profil özeti + dürüst erişim-kapsam kartı — klinik vaka verisi YOK (kullanıcı kararı; ownership `default:false`) |
| `/ogrenci` | **Tıp öğrencisi kapısı (v6.95):** doktor girişinden AYRI sekmeli giriş+kayıt (`StudentGateForm`; noindex; vitrin footer'ından 9 dilde link) + dürüst kapsam kutusu — haber/kongre/hukuk/kütüphane AÇIK · sponsor/anket/ödül + klinik yüzeyler KAPALI olduğu açıkça yazılır. Kayıt `Doctor.studentTrack:true` hesap açar → baslangic öğrenci modu (yalnız öğrenci belgesi; doktor belgeleri hiç görünmez) |
| `/gorusme/[id]` | WebRTC video görüşme odası (asimetrik) |
| `/konsultasyon/gorusme/[id]` | Konsültasyon görüntülü görüşme odası (partner↔doktor, Faz 3; fallback chat) |
| `/paket/[caseId]` · `/rezervasyon/[id]` · `/teklif/[id]` | Paket · Escrow rezervasyon · hastaya gönderilen teklif. Rezervasyon/teklif (v4.27): **escrow milestone güven görseli** (`EscrowMilestones` — "gerçek para yok/simülasyon" etiketli) + **i18n** (hasta dili, `useT`+`air_lang`+RTL; `ReservationView`/`OfferView`) + "Koordinatörle konuş" bildirimi. ⚠️ Sağlık turizmi vakasında (`tourism` prop) escrow görseli/split çizilmez, metinler ödemesiz varyant (2026-07-23) |
| `/takip` · `/takip/[caseId]` | Hasta Post-Op hub (takip listesi) · post-op takip |
| `/doktorlar` · `/doktorlar/[id]` | Doktor dizini · doğrulanmış profil |
| `/sikayet/[caseId]` · `/etik-kurul` (+`/[id]`) · `/denetim` | Şikayet · Etik Kurul liste/karar (+savunma/bilgi talebi paneli, v6.81) · denetim izi bütünlüğü (denetçi) |
| `/mesajlar` | **Sistem Mesajları (v6.81)** — bildirimden ayrı, İÇERİKLİ + yanıt akışlı katman; girişli TÜM roller (herkes yalnız kendi hedefli mesajını görür); header hesap menüsünde "Sistem Mesajları" satırı (bildirimlerin altı; avatar rozeti = bildirim+mesaj toplamı); savunma talebine TEK yanıt buradan verilir |
| `/admin/doktor-onay` | Doktor doğrulama onayı (ADMIN/Etik Kurul) — self-signup doktoru `verified:true` yapar |
| `/admin/personel-onay` | **Kurumsal üyelik onayı (2026-08-12, ADMIN/Etik Kurul):** PARTNER/AGENCY/HEALTH_PRO başvuruları — şifreli yanıtlar sunucuda çözülür, belgeler audit'li raw uçtan açılır, Onayla (`staffVerifiedAt` + PARTNER'da PartnerDoctor bağlama) / Reddet (gerekçe başvurana) |
| `/admin` (+`/kampanya`, `/anket`, `/kongre`) | **Yönetim dizini (v6.71-73):** ADMIN bandı yalnız Yönetim·Operasyon (kullanıcı kararı; TAM-liste nav sözleşme testi) — 3 küratör paneli kartı + 10 "Denetim görünümü" kısayolu buradan dağılır. **Kampanya (v6.68):** Doctorium akışı sponsorlu kartları — İLAÇ-DIŞI (Modül D TİTCK parkı; kategori fail-closed, birim regresyon kilidi), hedefleme yalnız açık-rızalı doktora, kişi-bazlı log YOK (agregat sayaç). **Anket (v6.69):** topluluk/sponsorlu tek-soru anketleri — **honorarium>0 yayın KİLİDİ** (ödeme/vergi kurgusu netleşene dek). Admin hesabı self-signup'sız: `scripts/create-admin.ts` (şifre yalnız env, `--promote` korkuluğu) |
| `/operasyon` (+`/lojistik`) | Operasyon paneli · lojistik Patient Journey takibi (S2 — koordinatör/admin) |
| `/paylasim/[token]` · `/paylasimlarim` | Güvenli paylaşım görüntüleyici · paylaşım yönetimi |
| `/second-opinion/*` | İkinci Görüş başvuru/vaka/görüşme akışı |
| `/ucretsiz-saglik/*` | Ücretsiz Sağlık Hizmeti başvuru/bekleme/landing |
| `/fhir/*` | FHIR R4 kaynak çıkışı (Composition / Consent / audit / **ConsultationRequest** Bundle) |
| `/master` (+`/api/master/*`) | **Master paneli (v6.0, env-dormant impersonation)** — `MASTER_ACCOUNT_ENABLED` + `MASTER_ACCOUNT_EMAILS` env'i açıkken allowlist'teki e-posta (rol değil, e-posta yetkisi) herhangi bir kullanıcıya **bürünüp** ekranlarını görebilir; gerçek master kimliği `imp` claim'inde (imzalı JWT), her bürünme `IMPERSONATE_START/END` ile değiştirilemez audit'e; **üç katmanlı kapı** (proxy + sayfa + API), env kapalıysa **404** (özellik sızmaz); üstte kırmızı "Master'a dön" bandı (`MasterBar`) |

### API (route handler grupları — `src/app/api/`)

| Grup | İşlev |
|------|-------|
| `triage` | Semptom → branş/aciliyet (Claude + kural fallback) |
| `cases` | Vaka CRUD + `/[id]/{consult,coding,labs,analyze-docs,sentinel-consult,icapci-request,appointment,terminate}` |
| `consultations` | Görüşme not/bitiş + `/[id]/signal` (WebRTC sinyalleşme — **Ably realtime birincil + DB poll yedek**; transkript DB-only/PHI) |
| `ai` | `soap` · `translate` · `discharge` (Claude) |
| `i18n` | Arayüz çeviri (Translation cache) + `clinical` (klinik PHI de-id çeviri — önbelleksiz, maskeli) |
| `realtime` | `token` (Gemini Live) · `ice` (TURN credentials — Cloudflare birincil, Metered yedek, OpenRelay son çare) · **`ably-token`** (WebRTC sinyalleşme — kanala-özel yalnız-subscribe token, API anahtarı sunucuda) |
| `consent` · `access-log` | KVKK onam (`GENERAL_KVKK`) + **`consent/ai`** (AI işleme açık rızası `AI_TRIAGE` scope, v6.4) + **`consent/ai-interpret`** (simültane tercüme rızası `AI_INTERPRET` scope, v6.5) + `proof` (RFC 3161 kanıt) · erişim denetim kaydı (audit) |
| `clinical` | `duty` — klinik nöbet/müsaitlik |
| `second-opinion` | İkinci Görüş state machine işlemleri |
| `free-care` | `apply`/`waiting`/`availability`/`doctor-feed`/`outcome`/`status` |
| `shares` · `complaints` · `bookings` | Güvenli paylaşım · şikayet (+**`complaints/[id]/defense-request`** v6.81 — ETHICS/ADMIN savunma talebi açar; PATCH karar ucu açık talepte **409** [kilit: yanıt VEYA 3 gün]) · rezervasyon (`respond` · `journey` · `contact-coordinator` [hasta→koordinatör bildirim talebi, BOLA+rate-limit]) |
| `notifications` · `push` · **`system-messages`** | Bildirim merkezi · Web Push aboneliği · **Sistem Mesajları (v6.81)**: GET kendi mesajların (+`?count=1` rozet sayımı; body/reply sunucuda çözülür, `repliedByUserId` yanıtlara ASLA konmaz — anonimlik) · POST okundu · **`[id]/reply`** atomik TEK yanıt (updateMany-guard → yarışta 409; kişisel mesaja yalnız hedef kullanıcı — ADMIN dahi değil) |
| `consultation-requests` · `presence` | Konsültasyon talebi yanıt/belge + **chat (`messages`)** + **video** randevu (offer/respond) · `presence/ping` (heartbeat) |
| `doctor` · `auth` | Doktor tercihleri/akademik/işlem · oturum + **`signup`** (doktor kaydı) + **`signup-staff`** (2026-08-12 — PARTNER/AGENCY/HEALTH_PRO başvurusu: şifreli yanıt + `STAFF_APPLICATION_KVKK` onamı + yetkisiz hesap) + **`google/{start,callback}`** (OAuth, env-gated) |
| `staff-applications` | **Kurumsal başvuru uçları (2026-08-12):** `documents` (GET/POST — kendi başvurusuna belge; imza-tabanlı MIME + şifreli depo) · `resubmit` (REJECTED→PENDING) · `[id]/review` (ETHICS/ADMIN onay/ret + audit + bildirim) · `[id]/documents/[docId]/raw` (incelemeciye belge — audit'li, no-store) |
| `admin` | `doctors/[id]/verify` — doktor doğrulama (ADMIN/Etik Kurul) · **`sponsor`** (v6.68 kampanya CRUD — İLAÇ kategorisi reddedilir; yayınlanmış silinmez→ENDED) · **`survey`** (v6.69 anket CRUD — honorarium>0 ACTIVE edilemez, fail-closed) · `congress` (kongre küratörü) |
| `sponsor` · `survey` | **`sponsor/click`** (v6.68 — rol kapılı tıklama sayacı → 302; URL DB'den, open-redirect yok) · **`survey/respond`** (v6.69 — DOCTOR-only tek yanıt, P2002→409, yanıtla birlikte agregat döner) · **`doctor/sponsor-consent`** (kişiselleştirme açık rızası — grant fail-closed / revoke derhâl; ConsentRecord `SPONSOR_TARGETING`/`_REVOKE` scope'ları) · **`doctor/hr-consent`** (v6.87 — İK iletişim onamı, aynı desen; `HR_CONTACT`/`_REVOKE` + `Doctor.hrContactOptInAt`; opt-in, hizmete şart değil) · **`doctor/complete-profile`** (v6.87 — OAuth kimlik tamamlama: ad/ünvan/branş/şehir/telefon[şifreli]/dil; doğrulama e-posta kaydıyla birebir) |

## Proje yapısı

```
src/
  proxy.ts                   # rol + onam bazlı erişim kontrolü (Next 16 proxy)
  app/                       # 26 rota dizini (yukarıdaki tablo) + api/ (22 grup)
  components/                # 53 bileşen (ConsultationRoom, ConsultationChat, DoctorSignupForm,
                             #   LiveInterpreter, DicomViewer, ProcessTracker, NotificationBell, useT, ...)
  lib/                       # ~58 modül:
                             #   db · auth/session · oauth · doctor-signup · doctor-activation
                             #   triage(+ -llm,-questions) · ai-clinical · ai-minimize · fhir(+ -http)
                             #   second-opinion(+ -service) · free-care(+ tracker'lar)
                             #   clinical-duty · consent(+ -config) · timestamp (audit/onam mühür v2 keyed-HMAC) · audit · i18n · ownership
                             #   notify · push · ice · billing/pricing/fxrate/procedures · postop · share
                             #   storage (Vercel Blob) · rate-limit (Upstash dağıtık + in-memory yedek) · api-auth · error-i18n
                             #   signal-access/-token/-poll · ably-server/-client (WebRTC sinyalleşme + Ably realtime) ...
  data/                      # coding.ts (ICD-10/LOINC/SNOMED) · procedures.json · second-opinion-docs.ts
tests/                       # vitest unit/ (saf mantık, DB yok) + integration/ (Neon dev branch) · Playwright e2e/ (3 akış + a11y smoke)
prisma/
  schema.prisma             # 32 model (User, Doctor, Case, Consultation, ConsultationMessage,
                            #   ConsultationVideoAppointment, Booking, Recovery, CheckIn,
                            #   ShareLink/ShareAccess, Notification, ConsentRecord, AccessLog,
                            #   ConsultAppointment, CaseDocument, DoctorDocument, SecondOpinion* ×7, ...)
  seed.ts                   # demo veri (30 doktor + 20 vaka)
scripts/                    # add-demo-cases.ts (idempotent), gen-icons.py (PWA ikonları), ...
public/                     # PWA manifest + ikonlar + wasm/ (DICOM codec'leri)
```

## Triyaj Motoru

`src/lib/triage-llm.ts` → `runTriage()` gerçek Claude (zorlanmış `tool_use`) ile branş + aciliyet
(1-5) + güven + Türkçe gerekçe üretir. Model **env-ayarlı**: `TRIAGE_MODEL` (varsayılan
`claude-sonnet-4-6`). `ANTHROPIC_API_KEY` yoksa/hata olursa `src/lib/triage.ts` içindeki kural
tabanlı `analyzeTriage()`'a düşer (anahtar kelime eşleştirme + kırmızı bayrak → aciliyet 5).

## Ortam değişkenleri

Tümü `.env.example`'da: `DATABASE_URL` (pooled) · `DIRECT_URL` (direct) · `SESSION_SECRET` · `DATA_ENCRYPTION_KEK` ·
`ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` ·
`CF_TURN_KEY_ID`/`CF_TURN_API_TOKEN` (WebRTC TURN birincil — Cloudflare Realtime) ·
`METERED_API_KEY`/`METERED_DOMAIN` (TURN yedek) · `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (doktor
kaydında "Google ile devam et"; boşsa dormant) · `BLOB_READ_WRITE_TOKEN` (Vercel Blob object storage;
boşsa belgeler şifreli base64 olarak DB'de — fallback) · (opsiyonel) `TRIAGE_MODEL`.

## Deploy

**Vercel** (serverless) + **Neon Postgres** üzerinde canlı. GitHub `airburakk/telehealth-mvp`
(`main`) → Vercel otomatik deploy. Adım adım kılavuz: [`DEPLOY.md`](./DEPLOY.md).

## Gözlemlenebilirlik (Faz 5 Ray C, 2026-07-16)

İki katman + bir bağlayıcı kural:

- **Sentetik rota kontrolleri** — `.github/workflows/synthetic.yml` ~30 dk'da bir
  `scripts/synthetic-checks.mjs` koşturur (8 halka açık rota: durum · süre · title · h1 · kritik CTA ·
  noindex beklentisi + TLS sertifika bitimi + statik asset). Zamanlayıcı GitHub Actions'ta çünkü
  Vercel Hobby cron limiti (2) dolu; koşu düşünce GitHub otomatik e-posta atar. Elle koşu:
  `node scripts/synthetic-checks.mjs` (`--base=` ile yerel/preview'a yöneltilebilir). Vitrin
  metni bilinçli değişirse script'teki beklentiler de güncellenir.
- **Kod-içi kritik alarmlar** — `src/lib/alerts.ts` (`sendAlert`): consent yazım hatası
  (fail-closed) · onam/audit zincir bütünlük kırığı (purge cron'u günlük nöbette doğrular) ·
  audit yazım hatası (istek bozulmaz ama boşluk birikimi görünür) · KEK yokluğu (SEV-1) ·
  decrypt hata kümesi (10 dk'da 5+) · cron başarısızlıkları. Kanal: her zaman `[ALERT] <olay>`
  log satırı (Vercel log'unda grep'lenir); `ALERT_EMAIL` + `RESEND_API_KEY` set ise e-posta
  (aynı olay 30 dk'da bir). Test ortamında alarm susar (kasıtlı kurcalama testleri için).

### 🚫 Asla loglama (bağlayıcı kural)

İzleme, sağlık verisini log'a kopyalamadan hata tespit eder. Şunlar **hiçbir** log/alarm/hata
mesajına giremez: semptom metni · tanı/teşhis · belge içeriği ve belge **adı** · görüşme/transkript
içeriği · hasta bilgisi taşıyan görüntü metadata'sı · sağlık verisi içeren AI prompt'ları · tıbbi
bağlamda gerçek ad-soyad · erişim token'ları · şifreleme anahtarları/materyali · oturum çerezleri.
Yerine iç ID (userId/caseId), olay kategorisi, hata kodu, süre/adet kovası kullanılır. Kural kodda
`src/lib/alerts.ts` başlığında da durur; yeni log satırı eklerken oradaki listeye uy.

## Sonraki adımlar (backlog)

Güncel yol haritası vault'ta: `Air/wiki/todo.md` + `Air/wiki/acik-isler-envanteri.md` (2026-07-19'da
kod kanıtıyla yeniden yazıldı). Öne çıkanlar (altyapı/hukuk gerektirir):
gerçek ödeme + Escrow gateway (Iyzico/Stripe — şu an simülasyon; **kullanıcı kararı: Ray A/şirketleşme
netleşene dek PARK**) · **object storage ✅ Vercel Blob**
(belgeler artık Blob'ta şifreli; token yoksa base64-in-DB fallback) · ileri E2EE fazları (Faz 0+1 ✅ at-rest/audit; Faz 2A ✅ post-op erişim daraltma + geri-alma; 2B kriptografik allowlist + Faz 3 gerçek sıfır-erişim kalan) · gerçek RFC 3161 TSA (şimdilik simüle) ·
**e-posta/SMS proaktif bildirim ✅ kod tarafı v6.28** (`notify.ts routePatientChannel` — hasta tercihi
EMAIL/SMS, içeriksiz dürtü; aktivasyon = `RESEND_API_KEY` / SMS sağlayıcı anahtarı) · **canlı durum ✅
v6.29** (3sn UI polling → Ably `live:` dürtü kanalı + 30sn güvenlik ağı; Ably yoksa eski davranış) ·
**DICOM PHI ✅ TAM (v6.32-33 tag-strip + v6.37 burned-in piksel maskeleme)** — kalan tek boşluk:
maskeleme kullanıcı kutularına + standart kurallara dayanır, otomatik yazı TESPİTİ (OCR) yoktur
(bilinçli karar) · veri ikametgâhı (data residency) — çok ülkeli pazar girişi için.

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın; güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı.
- **JWT iptali (v4.17):** `User.sessionVersion` + token `sv` claim'i — `POST /api/auth/logout-all`
  (Header'daki "Tüm cihazlardan çıkış") sürümü artırır, dolaşımdaki tüm token'lar düşer;
  `getCurrentUser` her istekte DB karşılaştırması yapar (istek-içi `cache()`'li). Eski (sv'siz)
  token'lar 0 kabul edilir. Proxy bilinçli DB'siz (yaptırım veri katmanında).
- **Rate-limit (v4.18):** Upstash Redis birincil (dağıtık/atomik; login 10/5dk/IP · paylaşım-şifre
  10/5dk/IP+link · AI 20/dk/kullanıcı), env yoksa/hatada in-memory yedek (fail-open). Env:
  `UPSTASH_REDIS_REST_URL/TOKEN`.
- **Kök layout DB dayanıklılığı (v6.15) — `src/app/layout.tsx`:** kök layout HER sayfada (vitrin dahil)
  çalışır ve çerez varsa `getCurrentUser()` → DB okur. DB erişilemezse (Neon uyanması/kesinti) buradan
  fırlayan hata **DB sorgusu OLMAYAN statik landing'i bile** `error.tsx`'e düşürüyordu → oturum okuması
  `try/catch` ile izole, hata yutulur ve **misafir kabuk** çizilir.
  🔒 **Bu FAIL-CLOSED'dır, fail-open değil:** `user = null` **en az yetki** demektir. Oturumu token'dan
  "kurtarmak" (DB doğrulamasını atlayıp token'a güvenmek) **fail-open** olurdu — iptal edilmiş oturum
  geçer + rol bayatlar (bkz. JWT iptali maddesi) ⇒ **yapma**. Korunan sayfa/API kendi
  `getCurrentUser`/`requireUser` kapısında yine reddeder; yalnız vitrin kabuğu ayakta kalır.
  ⚠️ **`getCurrentUser`'ın KENDİSİNE bu davranışı taşıma** (17+ çağrı noktası; yaptırım orada olmalı).
  🪤 Belirti aldatıcıdır: çerezsiz ziyaretçi `getCurrentUser`'da DB'ye hiç gitmez ⇒ hata **yalnız giriş
  yapmış kullanıcıda** görünür ("bende çalışıyor"); runtime hata kümesinde `users=1` bunun imzasıdır.
  Kök neden ayrı: `DATABASE_URL` → `connect_timeout=15` (bkz. `DEPLOY.md` Adım 1).
- **Hesap ve veri silme (v6.11) — `lib/account-deletion.ts`:** ⚖️ **"hepsini sil" YAPILMADI, bilinçli:**
  sağlık kaydı yasal saklamaya tabidir (KVKK m.7 → m.5/m.6) → düz bir silme düğmesi hukuka aykırı olurdu.
  **İki katman:** kişisel veri gerçekten silinir (+ parola çöpe, `sessionVersion++` → giriş imkânsız);
  klinik kayıt **HERKESE kapanır** (`deletionLockedAt`) ve `RETENTION_YEARS` (**20**, tek sabit) sonunda
  `cron/purge-deleted` **fiziken imha eder**. `ConsentRecord` (dayanağın ispatı) + `AuditLog` (hash-zinciri;
  satır silmek zinciri kırar) **kasıtlı saklanır**; `User` satırı rıza-ispat bağı için **kabuk** kalır.
  ⚠️ **Kilit rol kontrolünden ÖNCE** (`ownership.ts` en başta `deletionLocked()`): ADMIN/COORDINATOR/ETHICS
  geniş dalları kilidi **delemez** — testle sabit (`tests/unit/ownership`), oraya dokunma.
  ⚠️ `deletionLockedAt` `CaseRef`/`SoCaseRef`'te **ZORUNLU**: yeni bir vaka sorgusu yazarken **select'e
  eklemeyi unutursan DERLEME PATLAR** (kasıtlı — fail-open yerine compile-error).
  🔌 **Gerçek crypto-shred YOK ve bugünkü mimaride kurulamaz:** DEK alanın içinde (`crypto.ts` envelope) →
  imha edilebilir tek anahtar global KEK (= herkesin verisi). Hasta-bazlı DEK'e geçilirse (`crypto.ts:17`
  KMS swap noktası) purge "anahtar satırını sil"e döner. ✅ **Onam metni v6.19'da düzeltildi** (v3,
  hukukçu onaylı): "(crypto-shred)" vaadi çıktı, metin fiziken-imha gerçeğini söylüyor;
  `CONSENT_VERSION` 2→3 = herkes `/onam`'da bir kez yeniden onaylar.
- **Veri ikametgâhı — işlem bölgesi `fra1` (v6.10):** `vercel.json` `"regions": ["fra1"]` (Frankfurt).
  **Neden:** Neon veritabanı **`eu-central-1` (Frankfurt)**; Vercel varsayılanı ise `iad1` (Washington DC)
  idi → PHI AB'de saklanıyor ama **her istekte ABD'de işleniyordu** (şifre orada çözülür) = gereksiz
  uluslararası aktarım + her sorgu Atlantik'i geçiyordu. `fra1` ikisini aynı yere koyar: **veri uçtan uca
  AB'de** + DB gecikmesi düşer. ⚠️ **Bölgeyi değiştirmeden önce Neon bölgesini kontrol et** — ikisi ayrı
  düşerse hem gecikme hem aktarım yükü geri gelir. AB dışına taşımak KVKK/GDPR aktarım analizi gerektirir.
  (Bölge dışı sağlayıcılar ayrı konu: AI çağrıları — bkz. AI veri-minimizasyonu.)
- **Doktor veri dürüstlüğü (v4.19):** rating/successRate/experienceYears/jci nullable + default'sız
  (uydurma pazarlama varsayılanı yok); `verified` default false; public profil `/doktorlar/[id]`
  verified-kapılı; üretilmiş yorumlar "örnek değerlendirme" etiketli; eşleştirme skoru boş metriği
  inactive sayar. `GET /api/cases` artık sayfalı zarf döner: `{items,total,page,pageSize,totalPages}`.
- **Vitrin iddia dürüstlüğü (v6.8) — HALKA AÇIK METİN YAZARKEN OKU:** vitrinde yalnız **üründe
  kanıtlanabilir** iddia bulunur. Kaldırıldı, geri EKLEME: akreditasyon rozetleri (JCI/ISO 9001/
  TÜRSAB/TGA/KVKK — belgeli ilişki yok; 4'ü 3. taraf tescilli markası, KVKK ise bir kanun) · demo
  metrikler (20k+/40+/4.9) · uydurma hasta yorumları. Kurallar: **"uçtan uca / end-to-end şifreleme"
  YAZMA** (gerçek: TLS + Faz 1 envelope, **sunucu KEK** → "iletimde ve sunucuda şifreli") · "KVKK/GDPR
  **kapsamında korunur**" gibi hukuki **sonuç** iddiası yerine "yükümlülüklerini **destekleyecek
  şekilde tasarlandı**" · doktor için "akredite" YOK ("bağımsız"; klinik için "sağlık turizmi **yetki
  belgeli**" = kayıt defterinden doğrulanabilir) · AI dili determinist olamaz ("doğru uzmana
  yönlendirir" ✗ → "uygun branşı **önerir**") · ölçülmemiş hız/oran iddiası YOK ("dakikalar içinde" ✗)
  · "güvenli video" değil **"şifreli video"** (WebRTC DTLS-SRTP) · dil sayısı `SPEECH_LANG` ile
  eşleşmeli (**10**) ya da sayı verilmemeli. Güven bölümünün 6 kartı (`copy.ts` `trust`) kod kanıtlıdır
  (`consent.ts` · `crypto.ts` · `ownership.ts` · `/admin/doktor-onay` · `audit.ts` · `booking`
  `agencySentAt` kapısı) — **madde eklemeden ÖNCE kod kanıtını göster.**
  ⚠️ **Görünür metin YETMEZ:** `meta`/`og`/`twitter`/**JSON-LD** (`app/page.tsx`) aynı iddia sınıfıdır,
  ayrı tara. 🪤 hero "Telehealth and Health Tourism, **end to end**" + `layout.tsx` "uçtan uca dijital
  sağlık platformu" = **hizmet sürekliliği**, şifreleme iddiası DEĞİL → dokunma.
- **Güven ve Gizlilik sayfası (v6.12) — `/guven-ve-gizlilik`, iddia dürüstlüğünün ANA YÜZEYİ:** yukarıdaki
  kuralların uzun biçimi; 10 bölüm × 9 dil (`copy.ts` `trustPage` · `components/aura/trust-safety.tsx`).
  **Sayfanın değeri "neyi iddia etmiyoruz" kutularındadır** (kullanıcı kararı) — 5 bölümde: uçtan uca
  şifreleme **değil** (anahtar sunucuda, çünkü klinik özet/tercüme/doktor görünümü sunucuda işlem
  gerektirir) · "akredite doktor" **demiyoruz** · denetim kaydı **fail-safe** sınırı · silme
  **crypto-shred değil, fiziken** · ihbar adresi **⚖️ TASLAK** (uydurma adres YAZMA). Bu kutular bir
  istisna değil sayfanın omurgasıdır → **sessizce kaldırma**; madde eklemeden önce kod kanıtını göster.
  ⚠️ Sayfa bir **Gizlilik Politikası DEĞİLDİR** (o belge hâlâ yok) — yerine koyma. `/trust` buraya 308.
  🪤 **Letterform `wordAfter` tuzağı:** AURA harf dilimlerinden sonraki ek/noktalama **~12px kopuk**
  çizilir ("AURA ." / "AURA 'da") → `trustPage.wordAfter` tüm dillerde **boş**, noktalama `lineAfter`'a.
  📌 `copy.ts`'e çok-dilli bölüm eklerken: `sections` **uniform** tut, bölüme özgü parçaları **kökte**
  tut (`aiEmphasis`/`transferItems`) → `tests/unit/aura-landing-copy` `shape()` imzası (dizide **uzunluk
  da imzada**) 9 dilde birebir kalır; bölüm-özgü render **key ile** bağlanır, index ile DEĞİL.
- **`/v2` hero + entry-paths (v6.14) — DOKUNMADAN ÖNCE OKU:** sayfa **5 turluk kullanıcı geri
  bildirimiyle** ayarlandı; aşağıdakiler **kullanıcı kararıdır**, sessizce değiştirme.
  · **Video-arkalı kart mimarisi SABİT** (kullanıcı: *"video gömmesi çok iyi olmuş, sıra doğru"*): aktif
  kartın kulvar videosu arkada oynar — aktiflik **hover + KLAVYE focus + mobilde IntersectionObserver**
  (hover tek keşif yolu olamaz); `preload="none"` → açılışta hiçbir video inmez; ekran dışında/sekme
  gizliyken hepsi pause.
  · 🪤 **Kontrastı PERDE DEĞİL KART ZEMİNİ taşır** (`panel/90` aktif · `/75` pasif + `backdrop-blur-md`).
  Daha koyu gerekirse **kart zeminini artır, perdeyi değil** — düz perde videoyu boğar (v6.14'ün hatası:
  `night/65`+`/75` → *"video tam seçilmiyor"*). Hero skrimi **alt-koyu/üst-açık gradyan** (0.88→0.40→0.22),
  entry perdesi `/22`.
  · 🪤 **Hero sahneli açılış (pin+scrub):** `end: "+=30%"` = **TOPLAM** süre, adım **BAŞINA DEĞİL**
  (v6.14.4'te `adım×55+40` yazıldı = ~315vh → *"3 kez kaydırmam gerekiyor"*; 14× kısaltıldı). **stagger
  YOK** (kullanıcı: *"tek yeter"*) — geri eklenirse **pin süresini de büyüt**. `scrub 0.4`.
  · ⚠️ **A11y sözleşmesi — BOZMA:** `reduced-motion`'da pin/scrub **hiç kurulmaz** (tüm metin görünür,
  normal scroll) · metinler **SSR'da DOM'da**, gizleme yalnız **mount sonrası** `gsap.set` ile ⇒ JS
  yoksa/hata alırsa içerik görünür kalır (**fail-open**, SEO güvenli). Bu **bilinçli** scroll-jacking:
  wireframe "avoid" diyor, kullanıcı kararıyla yapıldı.
  · **Marka bloğu (`.aura-brand`)**: AURA letterform + **tam altında Braille** (merkez farkı 0px).
  🪤 `wordAfter`'a dil eki/noktalama **yazma** (letterform sonrası ~9-12px kopuk çizer → `lineAfter`'a).
  🪤 **Glow: "aynı efekt" ≠ aynı değer** — `aura-breathe` blur'u (14/44/90px) letterform ölçeğine göre;
  Braille noktası **5.38px** (26× fark) → aynı blur **görünmez**. Braille'in kendi keyframe'i var
  (`aura-breathe-braille`, 3/8/18). İkisinde de **sürekli hafif ışıma** + hover'da nefes.
- **`/v2` nav (v6.16) — `V2Nav` neden kök `AuraNav`'dan AYRI:** kök nav `/` **ve** `/how-it-works`
  tarafından kullanılıyor; `V2Nav`'ın **"Bakım"** sekmesi `#care` çapasına gider ve o çapa **yalnız
  /v2'de** var (entry-paths) ⇒ kök nav'ı düzenlemek **canlı landing'e kırık link** koyardı. `v2/`
  klasörü zaten "taşıma anında köke geçer" deseniyle kurulu.
  · **Ne değişti:** dört hizmet sekmesi (Telehealth · İkinci Görüş · Sağlık Turizmi · Ücretsiz Sağlık)
  → **tek bakım mimarisi** (Bakım · Nasıl Çalışır · Güven ve Gizlilik · Doktorlar İçin). Sayfa *"tek
  bakım yolculuğu, dört giriş kapısı"* derken nav'ın dört ayrı hizmet sıralaması **sayfayla
  çelişiyordu**. Sözlük `copy.ts` → `v2.nav` (9 dil); `menu`/`close` **kök nav sözlüğünden yeniden
  kullanılır** (`t.nav.menu` — zaten 9 dilde çevrili, tekrar tanımlama).
  · 🪤 **`nav.cta` = `hero.ctaPrimary` — 9 dilde AYNI etiket** (`nav.tsx`'in *"aynı etiket = aynı
  niyet"* sözleşmesi: ikisi de `/giris`'e gidiyor). Brand paketinin nav çevirileri v6.14 hero
  çevirilerinden **ayrı kalemden** gelmişti → EN dışında **7 dilde iki farklı etiket** çıkmıştı
  (TR *"Bakımınıza başlayın"* vs *"Bakım yolculuğunu başlat"*). **Birini değiştirirsen diğerini de
  değiştir.** Taşma değil ses sorunuydu: 1024px'te en uzun etiket (TR **187px**) ile link grubu
  arasında **222px** boşluk ölçüldü — uzunluk kısıt değil.
  · **Hero ikincil CTA → `#how`** (v6.16): etiket *"AURA nasıl çalışır?"* diyor → 4 adımlık şeride
  iner. Önce `#care`'e gidiyordu = **etiketle hedef çelişiyordu**.
  · **Doktorlar İçin → `/kurumsal-giris`** (geçici): todo'daki `/for-clinicians` rotası gelince oraya
  bağlanır. ⚠️ **"Doktor" DEĞİL "Doktor"** — v4.21 proje-geneli rename (brand paketi "Doktorlar İçin"
  önermişti, düzeltildi).
  · **a11y:** mobil panel **Escape** ile kapanır · dokunma hedefleri **44px** (hamburger 36→44) ·
  `aria-controls`/`aria-expanded` bağlı · çapa dışı hedefler `<a>` değil **`<Link>`** (client-side →
  `air_lang` dil seçimi ve video durumu korunur).
- **`how.tsx` 2. adım ikonu (v6.16):** `Sparkles` **DEĞİL** `ClipboardCheck` — yıldız-parıltı AI'yı
  ürünün öznesi gibi gösteriyordu; metin zaten doğruydu (v6.8), **ikon onunla çelişiyordu**. Bölüm
  `/` **ve** `/v2`'de ORTAK → değişiklik ikisini birden etkiler.
- **`--aura-accent-stronger` (v6.16) — accent'in METİN rolü:** gece `cyan-500` (= accent, koyu zeminde
  9.5 zaten yeterli) · gündüz **`cyan-800` #0d6470** (beyazda **6.83**). 🪤 **ÖLÇÜLDÜ:** `--aura-accent`
  (#17919e) beyazda **3.76** = **WCAG AA'nın (4.5) ALTINDA** → gündüz şeridindeki mono üst etiketler ve
  adım numaraları eşiği geçmiyordu. **Kullanım kuralı:** METİN olan accent → `-stronger`; zemin/border/
  ring (`bg-…/12`, `border-…/40`) → düz `--aura-accent` (dekoratif, kontrast eşiği yok). Accent'in
  kendisi DEĞİŞTİRİLMEDİ — marka turkuazı yüzeylerde aynı. **Kapsam:** `.aura-light` ortak → canlı `/`
  landing'in gündüz şeridi de koyulaştı (kullanıcı onaylı). Gece bantlar **hiç etkilenmez** (ölçüldü:
  9.51 sabit).
- **`/v2` iddia bölümleri (v6.16 Faz 2) — `v2/claim-section.tsx`:** AI sorumluluğu (`#ai`) +
  Erişilebilirlik (`#accessibility`). **TEK bileşen, iki besleme** (aynı şekil: eyebrow/headline/intro +
  4 madde + not) — sözlük `copy.ts` `v2.ai` / `v2.accessibility`, 9 dil.
  · ⚠️ **"Neyi iddia etmiyoruz" kutusu bölümün OMURGASI** — sessizce kaldırma (`/guven-ve-gizlilik` ile
  aynı kullanıcı kararı). AI kutusu: *AI tanı koymaz/tedavi seçmez/klinik yargı üretmez, çıktı
  endikatiftir*. A11y kutusu: *WCAG uyumluluk beyanı YOK (bağımsız denetimden geçilmedi)* + **Braille
  GÖRSEL marka öğesidir, Braille cihazı/ekran okuyucu desteği DEĞİL**.
  · 🪤 **Her madde KOD KANITLI** (harita `copy.ts` `v2.ai` başlığında: ClinicalDecisionPanel ·
  ai-consent · ai-minimize · langDir · reduced-motion · entry-paths klavye · hero fail-open).
  **Kanıtlanamayan madde GİRMEZ** ([[public-claim-honesty]]).
  · **Bölüme girmeyenler (kasıtlı):** **sesle dikte** — yalnız 3 hasta formunda (triyaj/SO/turizm), TÜM
  yüzeylerde değil ⇒ landing'de genel vaat yanıltıcı olurdu (kullanıcı kararı 2026-07-16).
- 🪤 **Turbopack CSS cache (v6.16):** globals.css'e **yeni** bir değişken eklendiğinde dev server bunu
  kısmi güncelleyebiliyor — `:root` tanımı geliyor ama aynı derlemedeki `.aura-light` override'ı
  **gelmiyor** (aynı dosya, aynı commit). Belirti: token gündüzde gece değerini veriyor ama `--aura-accent`
  doğru. **Çözüm: `.next` sil + dev server yeniden başlat.** Ölçüm yapmadan önce token'ın computed
  değerini doğrula — yoksa "düzeltmem çalışmadı" diye kaynağı boşuna kurcalarsın.
- **v6.18 TAŞIMA (2026-07-16) — V2 = ANA SAYFA:** `/` artık `V2Home` render eder; `/v2` →
  `permanentRedirect("/")`. **Geri dönüş: tag `landing-eski-v5.9-son`** (eski bileşenler **v6.19'da
  SİLİNDİ** — `724d601`, −769 satır: landing/eski hero/kök nav/motion/client-only; geri dönüş yalnız
  tag'ten. `chapters.tsx` küçültülmüş CANLI: how-it-works `ChapterCta`+`ChapterData` kullanır,
  `AuraChapters` artık yok). **`V2Nav` = SİTE GENELİ nav**
  (/, /how-it-works, /guven-ve-gizlilik, /for-clinicians) — kök `AuraNav`'ın `/#ch-*` çapaları yeni ana
  sayfada karşılıksız (kullanma). Metadata/JSON-LD yeni konumlandırmada ("Care, without borders."; "end
  to end" tamamen çıktı). **Açık/koyu ritim (kullanıcı planı):** çift-koyu açılış sonrası katı almaşık —
  hero(K) entry(K) how(A) connected(K) doctors(A) trust(K) ai(A) accessibility(K) clinicians(A)
  closing(K); koyu bölümler sarmalayıcısız (gece token miras), açıklar tekil `.aura-light`. Koyu kontrast
  ÖLÇÜLDÜ (6.48–17.66 AA üstü). `[lang]` locale rotaları da `V2Home` (initialLang) + v2 metadata.
- **v6.17 sözleşmeleri (2026-07-16):**
  · **`/v2` bölüm sırası:** hero → entry(`#care`) → how(`#how`) → **connected** → doctors → trust →
  ai → accessibility → **clinicians** (+`cta` → `/for-clinicians`). Connected/Clinicians da
  `claim-section` beslemesi — **her madde kod kanıtlı**, harita `copy.ts` ilgili blok başlığında.
  · **`/for-clinicians`:** how-it-works sözleşmesi (indekslenir, sitemap 0.7, kendi aura nav/footer —
  Header/SiteFooter gizleme listesinde). Sözlük `v2.clinicians` **iki yüzeyi** besler (bölüm + sayfa).
  Not kutusu: doğrulama = belge incelemesi, **akreditasyon DEĞİL** (v6.8).
  · **`/doctorium` (v6.100–100.1, 2026-08-16):** Doctorium tanıtım landing'i — for-clinicians gibi
  indekslenir + sitemap 0.7 + Header gizleme listesinde, ama **V2Nav DEĞİL**: kendi üst barı/footer'ı,
  TR-only (`components/aura/doctorium-landing.tsx`). **Almaşık koyu/açık ritim (v6.100.1 — ana
  vitrin deseni):** çift-koyu açılış (hero+güven) → olanaklar A → hukuk K → puanlar A → öğrenci K
  (kutu bantta dikey ortalı) → final A → footer K; açık bölümler `style={LIGHT}` (.aura-light rol
  değerleri; zümrüt metin karşılığı #047857, by-AURA wordmark'ı bölüme duyarlı light/dark PNG;
  CTA dolgu butonları temadan bağımsız sabit zümrüt). Prizma hero (🪤 prism span'ine
  `display:block` şart — inline'da yükseklik 0'a çöker; ışıma dönüş anında). Marka kuralları:
  "Doctorium" her metinde lockup (Doctor beyaz + ium zümrüt, D büyük; zümrüt-zeminli CTA istisna),
  "by AURA" imzasında AURA = gerçek wordmark PNG ve yalnız o tıklanır (→ `/`). Header'da
  **AURA↔Doctorium marka toggle'ı** (DOCTOR/COORDINATOR; ⚠️ **v6.103'te 2. nesle geçti — aşağıya
  bak**; nav'daki Doctorium sekmesi KALKTI) + **Doctorium odak modu** (portaldayken Doktor/Post-Op sekmeleri
  ve menüde Profilim/Finans gizli) + Aşama-1 doktoru AURA'ya geçerken `/doktor?from=doctorium` →
  `baslangic?from=aura-gecis` Aşama-2 uyarı ekranı (belge listesi + doğrulama şartı).
  · **v6.102 (2026-08-16):** `/doctorium/giris` kapısı (DoctoriumGate, auth-gates.tsx — zümrüt dönen
  sembol + lockup başlık + Doktor/Tıp Öğrencisi rolleri + Google/Apple/e-posta; noindex + Header
  gizleme listesinde) · landing arka plan video zemini (`DoctoriumBgVideo`: hero koyu / final CTA
  açık overlay; film2/film3 720p + gate2 kapı videosu). **Braille kuralı GÜNCEL:** her wordmark
  KENDİ braille'ini TAM ALTINDA ortalı taşır (AURA ⠁⠥⠗⠁ · Doctorium ⠙⠕⠉⠞⠕⠗⠊⠥⠍) —
  `DoctoriumBraille` (AuraLogo.tsx; AuraBraille ile birebir geometri; hücreler nokta
  numaralarından türetilir; **min-genişlik 146px**, altında HİÇ çizilmez). Yerler: kapı başlığı
  (aria-hidden içinde) + landing footer marka bloğu (32px lockup ≈154px > braille 146px). Üst bar
  BİLİNÇLİ braille'siz (22px lockup 106px < 146px — "nav'a konmaz" kuralı iki markada geçerli).
  · **v6.103 (2026-08-16) — marka toggle'ı 2. NESİL, TEK KAYAN SEMBOL** (v6.100'ün "iki logo yan
  yana, aktif olan döner" nesli SÜPERSEDE): dönen `AuraMark` **tektir**, aktif markanın yuvasında
  durur; toggle'da öbür yuvaya **kayar** ve rengi değişir (AURA turkuaz `brand` ↔ Doctorium zümrüt
  `emerald`). Renk geçişi **iki ton katmanının cross-fade'i** — SVG gradyan id'leri prop-sabit
  olduğundan CSS ile renk transition'lanamaz. Kayma ölçümlü `left` transition'ı: yuva konumları
  `useLayoutEffect` + `ResizeObserver` ile ölçülür (AURA wordmark PNG genişliği yükleme/temaya göre
  değişir → sabit px OLMAZ; ilk boyada `left: auto→px` atlar, bu yüzden ölçüm öncesi gizli).
  motion-reduce'ta kayma kapalı; pasif taraf `opacity-45`. DoctoriumSidebar'da bant tepesindeki
  lockup KALKTI (marka artık tek konumda: Header toggle'ı) — bant doğrudan zümrüt nabızla açılır.
  · **v6.103.1 (2026-08-16) — marka adı temizliği:** `PortamedLogo.tsx` → **`AuraLogo.tsx`** (export
  `PortamedLogo` → **`AuraLogo`**), `PortamedArt.tsx` → **`AuraArt.tsx`**; 26 dosyada import/JSX/yorum
  süpürüldü. Projede "portamed" metni ve dosya adı **kalmadı** (`git grep -i portamed` = 0). Tek
  bilinçli iz: `PublicLocale.tsx`'teki **`pm_locale`** localStorage anahtarı — eski tercihi
  `air_lang`a taşıyan GÖÇ kodu, silinirse o tarayıcılarda dil seçimi sıfırlanır. 🪤 Bu rename
  sırasında `git mv`'nin stage'i paralel oturumun commit'ine karıştı → `origin/main` bir süre
  build-kırık kaldı (deploy ERROR); ders: rename+süpürme+commit **tek turda** bitirilir.
  · **PWA marka kabuğu (2026-08-19, `82c2b8f`) — 🚀 CANLI:** amblem 2026-07-14'te AuraMark'a
  geçmişti ama **React ağacının DIŞINDAKİ** yüzeyler güncellenmemişti; ~2 ay boyunca çevrimdışı
  sayfası, push bildirimi ikonu/badge'i, ana ekrana ekleme ve tarayıcı sekmesi eski camgöbeği
  üçgen "A"yı gösterdi (favicon daha da eskiydi: 2026-06-04). `icon-192/512` · `apple-touch-icon` ·
  `favicon.ico` (16–256px) güncel amblemden yeniden üretildi — **tek jeneratör
  `scripts/gen-icons.py`** (AuraLogo.tsx geometrisinden; amblem oranı **kare kontrolünden**
  geçmezse durur). Rakip jeneratörler `gen-icons.mjs` (eski üçgeni üretiyordu) + `extract-logo.py`
  (kaynağı eski logo dosyası) SİLİNDİ. `manifest.webmanifest`: **"uçtan uca" çıkarıldı** (iddia
  disiplini — `layout.tsx`'ten çıkarılmıştı, manifest'te kalmıştı), ad/açıklama `layout.tsx` ile
  hizalandı, `theme_color` #101010→**#0d0e10** (viewport ile çelişiyordu), `background_color`
  #ffffff→#0d0e10 (gece varsayılanda PWA açılış ekranı beyaz patlıyordu). OG/Twitter görseli
  `p-hero3`→**`p-hero8`** (canlı hero v-hero8 iken paylaşım kartı eski filmin karesini
  gösteriyordu; 5 sayfa) + beyan edilen boyut 1280×720→**1920×1080** (gerçek dosya). `offline.html`
  gece temasına + marka turkuazı `#28c8d8`'e alındı. `global-error.tsx` renkleri **sabitlendi** —
  bu bileşen kök layout'u ATLAR, `var(--c-*)` çözülmez, buton görünmez kalırdı.
  🪤 **`sw.js` VERSION v4→v5 ŞART:** PRECACHE'teki dosya değişince artırılmazsa mevcut kullanıcı
  eski kopyayı görmeye devam eder (cache adı VERSION'dan türer). Temizlik: ~74 MB süpersede varlık
  (film2-12, v-hero3) + `.gstack/qa-reports` — hepsi önce `doctorium-video-arsivi/3-eski-surumler`'e
  yedeklendi. 🪤 **Ölü varlık taramasında şablon dizgisi kör noktadır:** `` src={`/assets/${d.img}.jpg`} ``
  gibi yollar basename aramasında görünmez — `doc-*.jpg` bu yüzden yanlışlıkla silinip geri alındı;
  silmeden önce `\$\{…\}\.(jpg|png|mp4|webp|svg)` desenini ayrıca tara.
  · **Hero mobil kaynak:** `<source media="(max-width:767px)">` → `src720` (848KB); masaüstü 1080p
  **kullanıcı kararı, dokunma**. Save-Data → video hiç başlatılmaz. 🪤 **WebM DENENDİ ve ATILDI:**
  VP9 çıktısı (1112KB) mevcut h264 720p'den BÜYÜK — kaynak zaten agresif sıkıştırılmış; **eklemeden
  önce ölç**.
  · **"Bakım Yolculuğum"** = hasta-yüzü ad; **rota `/vakalarim` KALDI**, klinik personelde "vaka"
  KALIR. **v6.20:** hasta yüzünde tam rename tamamlandı — SO listesi **"İkinci Görüş Yolculuğum"**
  (köprü "Bakım Yolculuğum"), "Başvuru No"/"Başvurunuz"/"Başvuruyu oluştur" vb.; vitrin TR "başvuru"
  ailesi (7 dil zaten case/Fall/dossier). Hasta yüzünde "vaka" kalan TEK yer `DeleteAccountPanel`
  (⚖️ bilinçli — hukukçu turu, vault output/ paketi). `/takip` + `/sikayet` geri linki **rol-duyarlı**
  (hasta → `/vaka/[id]`, personel → `/doktor/vaka/[id]`).
  · **Locale rotaları `/en…/bg` (`app/[lang]`):** ÇALIŞIR ama **bilinçli noindex + sitemap dışı** —
  "/" hâlâ 9-dil-tek-URL kanoniği (v5.9.1). **📌 Kullanıcı kararı (2026-07-16): KAPALI KALIYOR** —
  Gizlilik Politikası + gerçek ödeme öncesi indeksleme erken; hukuki metinler nihaileşince yeniden
  değerlendirilecek (robots satırı + sitemap + "/" canonical stratejisi birlikte). `dynamicParams=false` ŞART (kök segment — kaldırılırsa
  /herhangi-şey bu rotaya düşer). `LangProvider initialLang`: URL dili kazanır, `air_lang` ezilmez.
- **Video posterleri (v6.14.5) — YENİ/YENİLENEN VİDEO EKLERKEN OKU:** poster **daima o videonun ilk
  karesinden**: `ffmpeg -i <video> -frames:v 1 -q:v 2 <poster>.jpg`. **Ad-versiyonla** (`p-consult2.jpg`)
  — aynı URL'de içerik değiştirmek **edge cache'te eskiyi** sundurur. 🪤 4 kulvar posteri eski sürümden
  kalmıştı (fark **23-46**; hero **0.4** ve HIW **0.7-1.1** kontrol grubuydu) → `preload="none"` ile
  **görünür zıplama**; poster ortak `VIDEOS` haritasından geldiği için hata **canlı landing'de de** vardı.
  **Ölç, göz kararı yapma:** yeni poster ↔ ilk kare farkı **< ~1.5** (JPEG payı); en-boy oranı tutmuyorsa
  veya video posterden yeniyse **şüphelen**.
- **Design token mimarisi (v6.13) — RENK/ÖLÇEK DEĞİŞTİRMEDEN ÖNCE OKU:** `globals.css`'te **ÜÇ ayrı
  sistem** var, karıştırma: **(1)** `--c-*` + `.theme-light`/`.theme-dark` = **sistem geneli** (v6.1;
  `.logo-word-*` toggle buna bağlı) · **(2)** `--aura-*` + **`.aura-light`** = **landing/vitrin**
  (⚠️ landing gündüzü `.theme-light` DEĞİL `.aura-light`) · **(3)** ~~`.aura-theme-*`~~ = kullanıcı
  draft'ının getirmek istediği ikinci tema sistemi — **ALINMADI**, ekleme.
  `--aura-*` iki KATMANDIR: **ham palet** (`:root` üstteki blok — `cyan-50..900`/`night`/`deep-ink`/
  `stone-*`/durum renkleri/text/space/radius/shadow/duration/ease/content) = **statik kaynak**;
  **rol token'ları** (`--aura-bg/panel/surface/ink/grey/micro/accent/hairline`) = **tema değişkeni**,
  ham paletten değer alır. 🪤 **Bileşende ham paleti DOĞRUDAN kullanma** (`var(--aura-cyan-500)`) —
  daima rol token'ı (`var(--aura-accent)`); yoksa o yüzey gündüz temasında sabit kalır = kırılır.
  🪤 Yeni renk rolü eklerken **gece `:root` + gündüz `.aura-light`'a İKİSİNE birden** ekle.
  Ölçek token'ları tanımlı ama bileşenlere uygulanmadı (mevcut değerler yerinde; taşıma ayrı tur).
  ⚠️ Draft'tan 2 kasıtlı sapma: `stone-100` `#eff1ec` (draft `#eef1ec`) · `border-dark` `0.09`
  (draft `0.10`) — sıfır-görsel-değişiklik için kod değerleri korundu.
  📌 **Token'a dokunan değişikliğin doğrulaması:** bu ortamda screenshot alınamıyor → **değişiklikten
  ÖNCE** computed-style baseline al, sonra karşılaştır (v6.13 böyle kanıtlandı: dev + prod sıfır diff).
- **Tipografi / Arapça-Farsça (v6.9) — YENİ YÜZEY EKLERKEN OKU:** Inter Kiril kapsar (RU/KK/KY markalı;
  `subsets` YALNIZ preload'u belirler, `@font-face` diğer subset'leri de içerir) ama **hiçbir Latin
  ailesi Arap alfabesini kapsamaz** → **Noto Sans Arabic** `:lang(ar)/:lang(fa)` altında bağlıdır
  (`globals.css`). 🪤 Genel font yığınına **sıralamayla eklenemez**: next/font her aileye gömdüğü
  `"<Aile> Fallback"` face'inin `unicode-range`'i U+0-10FFFF'tir → sonra koyarsan `"Inter Fallback"`
  (sistem fontu) Arapçayı kapar ve Noto hiç inmez, önce koyarsan `"Noto … Fallback"` Latin'i Inter'den
  çalar; `adjustFontFallback:false` etkisiz. ⚠️ **ar/fa çizen YENİ yüzeye `lang` niteliği vermeyi
  UNUTMA** (`JourneyIntakeShell`/landing verir; `LANG_BCP47[dilAdı]` → "ar-SA") — yoksa font **sessizce**
  sistem fallback'ine düşer, tsc/build YAKALAMAZ.
- **Braille eşiği (v6.9):** `<AuraBraille height>` — `height*364/78 < 56px` ise **hiçbir şey çizmez**
  (marka kuralı: yeterli netlikle çizilemiyorsa Braille konmaz). Kullanılan iki yer `height={12}` (=56px).
  Küçültmek Braille'i **sessizce yok eder**.
- **Ekran-dışı animasyon duraklatma (v6.9):** `AuraAnimPause` (kök layout) tek global IntersectionObserver
  ile `.aura-sym-*`/`.aura-word`'e `.aura-anim-paused` (`animation-play-state: paused`) uygular. Yeni
  sürekli dekoratif animasyon eklersen **sınıfını bu seçiciye ekle**. `AuraMark`/`AuraSpinner` KASITLI
  hook'suzdur (server-component uyumlu) → içine `useEffect` koyma; duraklatma dışarıdan uygulanır.
- **Hata sınırları (v4.17):** kök `error.tsx` + `global-error.tsx` + `not-found.tsx` — 10 hasta
  dilinde statik gömülü metin (`lib/error-i18n.ts`), çeviri zinciri/DB'ye bağımlı değil.
- **Object storage (Vercel Blob):** PHI belgelerinin bytes'ı Blob'a yüklenmeden ÖNCE at-rest
  şifrelenir (`lib/storage.ts`) → Blob yalnız ciphertext tutar; URL tahmin-edilemez + asla istemciye
  sızdırılmaz (auth'lu rota proxy'ler). Token yoksa eski davranış (şifreli base64-in-DB).
- **AI veri-minimizasyonu (`lib/ai-minimize.ts`):** SOAP/epikriz/paket AI çağrılarında hasta ADI
  Anthropic'e GÖNDERİLMEZ ([HASTA] placeholder); çıktıda gerçek adla geri-yerleştirilir (doktor
  görünümü korunur). Klinik içerik AI görevi için gönderilir (de-id sınırı: ad çıkar, semptom kalır).
- **Partner konsültasyon de-id (`lib/ai-clinical.redactPersonNames`):** partnerin serbest-metnine
  yazdığı kişi adları, talep KAYDEDİLMEDEN ÖNCE AI ile `[ad]`'a maskelenir (yapısal scrub e-posta/TC/
  telefonu; bu katman sistemin bilmediği düz adları) → doktor havuzuna hasta kimliği sızmaz.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri (DPA/SCC), AI sağlayıcı
  aktarım güvenceleri ve uygun bölge (AB/TR) seçimi gerekir (bkz. vault `wiki/kavramlar/`).
