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
- **DICOM:** `dicom-parser` + `@cornerstonejs/codec-openjpeg` + `codec-charls` + `jpeg-lossless-decoder-js`
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

## Roller & Giriş

Giriş **iki ekrana ayrıdır** (v4.21): **`/giris` = Hasta Girişi** · **`/kurumsal-giris`** =
Doktor/Koordinatör/Etik Kurul/Partner/**Sağlık Turizmi Acentesi**. **Kapı/form ayrımı (v5.9.1):**
`/giris` ve `/kurumsal-giris` artık vitrin **AURA giriş kapılarıdır** (letterform panel + yan video;
`components/aura/auth-gates.tsx`) — Google doğrudan OAuth'a, Apple/E-posta ise **çalışan formlara**
(`/giris/e-posta` hasta = Google `intent=patient` [env-gated] / Apple [yakında] / e-posta,
üyelik **`/kayit/hasta`** → `POST /api/auth/signup-patient`, `lib/patient-signup`; `/kurumsal-giris/e-posta`
= personel/acente demoları) götürür. Kapılar `?next`/`?verify`/`?oauth` parametrelerini forma iletir;
Header/SiteFooter kromu kapılarda gizli. Doktorlar
**`/kayit`** ile kendileri kayıt olabilir (Google [env-gated] / Apple [yakında] / e-posta; Google
niyeti `g_oauth_intent` cookie'siyle taşınır — mevcut kullanıcıda yok sayılır). Giriş sonrası tek
seferlik KVKK onam kapısı (`/onam`) vardır (sürümlü; `lib/consent-config.CONSENT_VERSION` artarsa
bir kez yeniden alınır).

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
| Doktor | `doktor@air.test` | **Doktor Ana Sayfası (5-pencere)** + onboarding, video görüşme, klinik kodlama, post-op izleme, klinik nöbet, Ücretsiz Sağlık Hizmeti, **Konsültasyon Talepleri** |
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
| 1 | **Triyaj** | ✅ Ön-konsültasyon kapısı (ücret/sigorta) → 5 adımlı sihirbaz, **gerçek Claude** branş+aciliyet (30 branş, ~198 dinamik branş sorusu), belge yükleme + **AI ön-değerlendirme** (vision/PDF → tür+TR çeviri+özet+anormal bayrak) + lab→FHIR oto-dolum |
| 2 | **Doktor Paneli + Video** | ✅ Aciliyet sıralı kuyruk, kokpit, **gerçek WebRTC** video + canlı transkript (Web Speech) + AI-SOAP + medikal çeviri + **AI Epikriz** + **Gemini canlı tercüman** (iki yönlü ses+altyazı; **v6.30 tek-sıçrama**: konuşan KENDİ mikrofonunu karşının diline çevirtir, çeviri `replaceTrack` ile karşıya gider — sessiz-ölüm bekçisi + fail-open mikrofona dönüş) — **transkript herhangi taraftan, tercüme YEREL ilk konuşma sesinde otomatik başlar (VAD; başlat düğmesi yok), tercüme yalnız diller farklıysa** + **DICOM görüntüleyici** (5 sıkıştırılmış codec) + klinik kodlama (FHIR) |
| 3 | **Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, **3 kademeli sigorta** (1 zorunlu · 2 operasyon teminat poliçesi [toplam fatura×oran×branş riski] · 3 malpraktis — doktorun yüklediği MMSS'inin bıraktığı boşluğu doldurur; `lib/pricing.ts` `computeInsurance`, parametrik/endikatif) + **hasta sağlık beyanı → risk çarpanı** (v6.31: `/paket`'te hasta-only form [kronik/ilaç/sigara/ameliyat, triyaj+profil prefill'li] → `computeHealthRiskMult` çarpımsal-tavanlı, yalnız Katman 2/3'e; beyan `Case.healthDeclaration` **şifreli+vaka-sabit** + `User.patientHealthHistory` profil kopyası; personel/acente ham beyan GÖRMEZ, yalnız çarpan; prim client+server aynı fonksiyondan), **Escrow + split** + **lojistik Patient Journey takibi** (durum+tarih+not; koordinatör yönetir, hasta görür) + SOAP'tan AI paket teklifi + hastaya teklif gönderme (link/PDF) |
| 4 | **Post-Op Takip** | ✅ Günlük kontrol (ağrı/ateş/ilaç/foto), kırmızı bayrak, branş protokolü, doktor izleme + **Güvenli Dijital Paylaşım** (token/TTL/şifre/audit/iptal) + alıcı dilinde görüntüleme + **AI foto analizi** (Claude vision) |
| 5 | **Doktor Adaptasyon** | ✅ **Self-signup** (`/kayit` — Google[env-gated]/Apple[yakında]/e-posta → `User`+`Doctor` `verified:false`, `lib/doctor-signup` + `lib/oauth`) + **Doktor Ana Sayfası — 5 pencere** (Klinik Nöbet / İkinci Görüş / Ücretsiz Sağlık Hizmeti / Konsültasyon Talepleri / Haberler), her doktora ünvan+opt-in'e göre koşullu (`lib/doctor-home.ts`) + **ilk-giriş onboarding** (`/doktor/baslangic`: **FHIR uzmanlık** [diploma/tescil no = Practitioner.identifier + uzmanlık belgesi = qualification] + **branş işlemleri & ücretleri** ≥1 [`ProcedureSelector`→`Doctor.procedures`] + **zorunlu mesleki belge** — Tıp Diploması + MMSS poliçesi; hepsi tamamlanmadan hesap **aktifleşmez** [`canCompleteOnboarding` gate; `DoctorDocument` + `Doctor.activatedAt` + `lib/doctor-activation`; içerik at-rest şifreli; MMSS teminat limiti → M3 Katman 3 malpraktis girdisi]; İkinci Görüş ünvana göre; Ücretsiz Sağlık Hizmeti + Konsültasyon opt-in) + Panel 1 yalnız eşleşen vakalar + itibar/hakediş/kapasite/profil tercihleri (dil/pazar/işlem-ücret/opt-in). **Doğrulama kapısı:** self-signup doktor `verified:false` başlar → doktor dizini + Nöbetçi/İcapçı/Ücretsiz Sağlık Hizmeti eşleştirmelerinde gizli; **`/admin/hekim-onay`** (ADMIN/Etik Kurul) onayıyla `verified:true` olur (bildirim) |
| 6 | **Doktor Tanıtım** | ✅ Doktor dizini + doğrulanmış profil (**verified-kapılı** — doğrulanmamış doktor public profil alamaz), **gerçek profil fotoğrafı** (`Doctor.photo` per-doktor / cinsiyet-fallback) + **tanıtım videosu** (cinsiyete göre), yorumlar (gerçek Review; üretim-fallback **"örnek değerlendirme" etiketli**), akreditasyon (JCI — yalnız gerçek veri, uydurma varsayılan yok), **kalıcı akademik** (düzenlenebilir) |
| 7 | **Etik Kurul** | ✅ Şikayet, anonimleştirilmiş (data masking) inceleme, karar/yaptırım, **Escrow iade** tetikleyicisi |
| — | **Tedavi Kararı → STA akışı (2026-07-10)** | ✅ Görüşme ekranında **birleşik Klinik Kodlama + Tedavi Kararı** paneli (`ClinicalDecisionPanel`): ICD-10 tanı → **"Sağlık Turizmi Planlaması" tuşu** (v6.4 — tedavi/işlem + süre + hastane planı yalnız bu tuşla açılır; basınca tanıya göre **AI işlem önerisi otomatik sıralanır**, doktor seçer; tuş öncesi plan kapalı) → **tanıya eşlenmiş işlemler** (küratörlü statik eşleme `data/icd-procedures.ts` + **AI işlem önerisi** `/api/ai/suggest-procedures`) → taban↔tavan slider ücret (onboarding artık ücret SORMAZ; doktor fiyat hafızası karar kaydında güncellenir) → **öngörülen tedavi süresi (gün aralığı)** → **hastane seçimi** (HealthTürkiye dizini) → Kaydet = dosya **Sağlık Turizmi Acentesine** iletilir (`agencySentAt` + AGENCY bildirimi). Eski "Paketi oluştur / AI Teklif hazırla / Sağlık Turizmi Paketi" düğmeleri kaldırıldı — **teklifi acente hazırlar** (`/acente`, kısıtlı dosya, `mode=offer`). **AI Epikriz post-op ekranına taşındı** (`/takip/[caseId]` personel görünümü); hasta aynı ekrandan **"Epikriz iste"** talebi açar (`dischargeRequestedAt` + doktora bildirim) |
| — | **HealthTürkiye kayıt defteri (2026-07-10)** | ✅ `healthturkiye.gov.tr` resmi dizini günlük senkron (`lib/ht-registry.ts` — web-api.healthturkiye.gov.tr; ~10.000 doktor + ~4.600 tesis; soft-delete diff) → `RegistryDoctor`/`RegistryHospital`/`RegistryReport`; **cron** `vercel.json` → `/api/cron/registry-sync` (günde 1, `CRON_SECRET`) → **günlük eklenen/çıkarılan raporu** `/admin/registry-raporu` + ADMIN bildirimi. **Doktor kayıt doğrulaması:** signup'ta ad-soyad dizin eşleşmesi → `Doctor.registryStatus` → `/admin/hekim-onay`'da yeşil rozet / **kırmızı uyarı bayrağı**. Tedavi kararındaki hastane seçici bu dizinden (`/api/registry/hospitals`). **Detay zenginleştirme (2026-07-10):** tesislerin **hizmet dilleri / akreditasyon / olanak adları + sağlık turizmi yetki belge no'su** (`authorizationNumber`, ör. "ST-0292") sitenin SSR detay JSON'undan doldurulur (`enrichHospitalDetails` — cron'da 40/gün + ilk toplu doldurma `scripts/registry-enrich.ts`; belge-no backfill `… auth`); hastane seçici sonuçlarında 🌐 diller + 🏅 akreditasyonlar + **🛡 yetki belgesi rozeti**; rozet **hasta yüzünde** de görünür (teklif `/teklif` + rezervasyon `/rezervasyon` paket kartında, çevrili etiketle) ve acente dosyasında hastane kartında. **Alan-güncellemesi (v5.4):** liste-API alanlarının kısa hash'i (`fingerprint`) satırda tutulur; günlük senkron yalnız hash'i değişen kayıtları günceller (ad/şehir/branş değişimleri; tavan 1000 — aşımı rapor notuna düşer, enrichment alanları etkilenmez); ilk doldurma `scripts/registry-fingerprint-backfill.ts`, rapor sayfasında "✎ güncellendi" sayacı |
| — | **Bildirim kanalı + hasta iletişim (2026-07-10)** | ✅ Doktor Ana Sayfa **bildirim tercihi** (Uygulama/WhatsApp/SMS — WA+SMS **dormant simülasyon** `lib/messaging.ts`, env anahtarı eklenince gerçek gönderime hazır; kayıt formunda cep telefonu alanı, at-rest şifreli) · **4 hasta intake'inde** (triyaj/SO/turizm/ücretsiz) telefon + "hangi yoldan ulaşalım?" (Uygulama/SMS/E-posta) → `patientPhone` (şifreli) + `contactPreference` · **Partner-konsültasyon videosu 10 dk sınırlı** (7'de kırmızı, 9'da iki tarafa uyarı; otomatik kesme yok) |
| — | **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul/admin/**partner**/**acente[AGENCY]**), bcrypt + JWT + proxy + KVKK onam kapısı + **doktor self-signup** (`/kayit`; e-posta + Google OAuth [env yoksa dormant] + Apple [yakında]) + **e-posta doğrulama** (v5.6, `RESEND_API_KEY` yoksa dormant: yeni e-posta kayıtları doğrulama bağlantısı almadan giriş yapamaz [mevcut/demo hesaplar muaf, Google doğrulanmış sayılır]; `lib/email.ts` + `lib/email-verification.ts` + `/api/auth/verify-email` + `/api/auth/resend-verification`) |
| — | **Partner Doktor + Konsültasyon Havuzu** | ✅ **Partner Doktor** (`PartnerDoctor` + `PARTNER` rolü, `/partner`): hasta DB erişimi YOK, anonim konsültasyon talebi açar (+**tıbbi belge yükleme** → `assessDocument` AI: tür/TR çeviri/özet/anormal bayrak/LOINC lab) → **anonimleştirme katmanı** (`lib/deidentify.ts`: yapısal de-id + TC/pasaport/e-posta/telefon scrub) + **DICOM PHI tag-strip (v6.32, `lib/dicom-deidentify.ts` dcmjs):** partner `.dcm` yükleyebilir — kimlik/kurum/hekim/tarih etiketleri kayıt ÖNCESİ boşaltılır (PS3.15 alt kümesi; UID'ler yenilenir, private tag'ler silinir, açıklamalar scrub'lanır; sıyrılamayan dosya fail-closed REDDEDİLİR; burned-in piksel yazısı kapsam dışı → formda zorunlu beyan kutusu) → anonim dosya auth'lu `/raw` ucundan mevcut **DicomViewer**'da açılır (yanıtlayan hekim + talebi açan partner; audit'li; AI değerlendirme DICOM'a uygulanmaz) → **`ConsultationRequest` havuzu** (at-rest şifreli; `/doktor/konsultasyon`'da kayıtlı doktorlar görüş + **kodlu öneri** verir: lab/görüntüleme=ServiceRequest, ilaç=MedicationRequest ATC). **Çift-yönlü AI çeviri** (özet→TR doktor · görüş→hasta dili partner) + **FHIR Bundle** (`/fhir/ConsultationRequest/[id]`). Yanıt başına ödeme simüle. **Yazılı görüşme (chat — Faz 2):** partner↔doktor çift-yönlü `ConsultationMessage` (at-rest şifreli + AI oto-çeviri; doktor nihai görüş öncesi de soru sorabilir → talebi atomik sahiplenir, IN_DISCUSSION). **Görüntülü görüşme (video — Faz 3):** presence/heartbeat (`/api/presence/ping`) + İcapçı offer/respond randevu (`ConsultationVideoAppointment`) + WebRTC oda (`/konsultasyon/gorusme/[id]`; sinyalleşme yeniden kullanımı + fallback chat) |

### Paralel hasta akışları

- **İkinci Görüş (Second Opinion):** genel triyajdan bağımsız akış — 12 durumlu state machine, 7
  Prisma modeli, CRM oto-atama + hoca kabul, 4 bölümlü yazılı görüş + video randevu teklifi, izole
  video oda (**AI canlı tercüme + transkript — M2 paritesi, ilk konuşma sesinde otomatik**). SLA:
  **600 USD · 5-7 iş günü · video 15 gün**. (`lib/second-opinion.ts`)
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
  kartını** (genel skor + metrik dökümü), hasta `/hekim/[id]`'de **güven rozetlerini** (eşik-bazlı, anlam-renk,
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
| `/` · `/giris` · `/giris/e-posta` · `/kurumsal-giris` · `/kurumsal-giris/e-posta` · `/kayit` · `/kayit/hasta` · `/onam` (+`/onam/kanit`) | **AURA sinematik landing** (v5.9 — vitrinden taşındı: hero video+letterform, 4 chapter destesi, gsap+lenis; 8 dil statik `lib/aura-landing/copy.ts`, dil anahtarı `air_lang`). **Bölüm akışı (v6.8):** hero → chapters → nasıl çalışır (+AI sorumluluk notu) → doktorlar → **güven (6 ürün-kanıtlanabilir kart)** → kapanış; eski *Şeffaflık* bölümü v6.8'de Güven'e birleştirildi (`transparency.tsx` kaldırıldı — aynı iddiayı iki kez veriyordu). İddia kuralları: aşağıda "Vitrin iddia dürüstlüğü (v6.8)" · **SEO (v5.9.2):** canonical + OpenGraph/Twitter kart + 8-dil `og:locale:alternate` (tek URL — `lib/aura-landing/seo.ts`) + JSON-LD MedicalOrganization/WebSite · **hasta giriş kapısı** + **`/giris/e-posta` çalışan form** · **kurumsal giriş kapısı** (noindex) + **`/kurumsal-giris/e-posta` form** (v5.9.1 kapı/form ayrımı — kapılar `components/aura/auth-gates.tsx`) · doktor kaydı · **hasta üyeliği** · KVKK onam + Onay Kanıtı |
| `/how-it-works` | **Nasıl Çalışır rehberi** (v5.9 — vitrinden taşındı): 4 yolculuğun adım listeleri + tıkla-oynat rehber videoları + HowTo JSON-LD + OpenGraph (title template `%s · AURA`); global Header/SiteFooter bu rotada ve `/`'de gizli (sayfa kendi aura nav/footer'ını taşır). Eski vitrin aura-health.higgsfield.app tüm sayfaları buraya 301 yönlendirir |
| `/guven-ve-gizlilik` | **Güven ve Gizlilik** (v6.12): iddia dürüstlüğü sayfası — 10 bölüm × 8 dil (`copy.ts` `trustPage`), 5'inde **"neyi iddia etmiyoruz"** kutusu + FAQPage JSON-LD (cevap gövde+sınırı birlikte taşır) + OG 8 dil; global Header/SiteFooter burada da gizli (kendi aura nav/footer'ı). **`/trust` → 308.** ⚠️ Gizlilik Politikası **değildir**. Kurallar: Güvenlik notları "Güven ve Gizlilik sayfası (v6.12)" |
| `/v2` | **Yeni ana sayfa ÖNİZLEMESİ** (v6.14 · `components/aura/v2/{home,hero,entry-paths,nav}.tsx` · `copy.ts` `v2`, 8 dil). **noindex + sitemap'te YOK** — aynı içeriğin iki URL'de indekslenmesi `/`'nin SEO'sunu bölerdi. Canlı `/` **dokunulmadı**. **Bölümler:** nav (tek bakım mimarisi, v6.16) → hero (sahneli açılış) → entry-paths (video-arkalı 4 kart, `id="care"`) → mevcut how (`id="how"`)/doctors/trust → closing. **`/`'ye taşırken:** eski landing'e **git tag** (geri dönüş) → `app/page.tsx`→`V2Home` → `/v2`+noindex kalkar → sitemap'e girer → ⚠️ `.aura-brand` seçicileri artık landing'i de kapsar, **token/glow ölçümünü tekrarla** → ⚠️ `v2/nav.tsx` kök `aura/nav.tsx`'in yerini alır ve içindeki `/v2` hedefleri (logo · `#care` çapası) **`/` köküne döner**. Sözleşme: aşağıda "/v2 hero + entry-paths (v6.14)" + "/v2 nav (v6.16)" |
| `/sitemap.xml` · `/robots.txt` | **SEO altyapısı (v5.9.2 · v6.12):** `app/sitemap.ts` yalnız 8 halka açık rota (/, /how-it-works, **/guven-ve-gizlilik**, /giris, /kayit, /kayit/hasta, /second-opinion, /ucretsiz-saglik) · `app/robots.ts` hassas panel/API disallow + sitemap referansı. `SITE_URL` tek kaynak `lib/aura-landing/seo.ts` (domain taşınırsa tek nokta) |
| `/basla` | KALDIRILDI (v5.8) — eski linkler için `/triyaj`'a kalıcı redirect |
| `/saglik-turizmi` | **Sağlık Turizmi hasta-yüzü planlama** (v4.24-25): tercih (branş/ülke/seviye/gece) + endikatif paket önizlemesi (`computePackage`) + öz-yeterli "Talep Oluştur" → `POST /api/patient/tourism-request` (runTriage → tourism-etiketli Case, `Case.tourismPlan` JSON; doktor `/paket` PackageBuilder ön-değeri + kokpit 🧳 rozeti). Klinik-önce: bağlayıcı fiyat/rezervasyon daima doktor onayı sonrası (simüle/park; USHAŞ yetki belgesi + TÜRSAB hukuki zemini vault'ta belgeli) |
| `/triyaj` | Triyaj sihirbazı (tek ekran ödeme kapısı + 3 adım — v5.8) |
| `/vaka/[caseId]` | **Tek hasta vaka merkezi** (v5.8 F6): süreç tracker + 3-seçenek kapısı + vaka bilgisi + aktif görüşme CTA + teklif (`#teklif`) + rezervasyon (`#rezervasyon`) gömülü; eski hasta rotaları (`/triyaj/[id]` · `/teklif/[bookingId]` · `/rezervasyon/[bookingId]`) buraya kalıcı redirect |
| `/vakalarim` · `/erisim-kaydi` | Hastanın vaka ana ekranı · erişim denetim kaydı ("verime kim erişti") |
| `/doktor` (+`/baslangic`, `/vaka/[id]`, `/takip`, `/profil`, `/ucretsiz-saglik`, `/konsultasyon`) | Doktor Ana Sayfası (5-pencere), ilk-giriş onboarding, kokpit, izleme, profil, Ücretsiz Sağlık Hizmeti, klinik nöbet, Konsültasyon Talepleri kutusu |
| `/partner` (+`/talep`) | Partner Doktor paneli (**tüm arayüz partner dilinde + RTL**, haber akışı dahil) · anonim konsültasyon talebi oluşturma (belge yükleme, hasta DB erişimi yok) |
| `/gorusme/[id]` | WebRTC video görüşme odası (asimetrik) |
| `/konsultasyon/gorusme/[id]` | Konsültasyon görüntülü görüşme odası (partner↔doktor, Faz 3; fallback chat) |
| `/paket/[caseId]` · `/rezervasyon/[id]` · `/teklif/[id]` | Paket · Escrow rezervasyon · hastaya gönderilen teklif. Rezervasyon/teklif (v4.27): **escrow milestone güven görseli** (`EscrowMilestones` — "gerçek para yok/simülasyon" etiketli) + **i18n** (hasta dili, `useT`+`air_lang`+RTL; `ReservationView`/`OfferView`) + "Koordinatörle konuş" bildirimi |
| `/takip` · `/takip/[caseId]` | Hasta Post-Op hub (takip listesi) · post-op takip |
| `/hekimler` · `/hekim/[id]` | Doktor dizini · doğrulanmış profil |
| `/sikayet/[caseId]` · `/etik-kurul` (+`/[id]`) · `/denetim` | Şikayet · Etik Kurul liste/karar · denetim izi bütünlüğü (denetçi) |
| `/admin/hekim-onay` | Doktor doğrulama onayı (ADMIN/Etik Kurul) — self-signup doktoru `verified:true` yapar |
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
| `shares` · `complaints` · `bookings` | Güvenli paylaşım · şikayet · rezervasyon (`respond` · `journey` · `contact-coordinator` [hasta→koordinatör bildirim talebi, BOLA+rate-limit]) |
| `notifications` · `push` | Bildirim merkezi · Web Push aboneliği |
| `consultation-requests` · `presence` | Konsültasyon talebi yanıt/belge + **chat (`messages`)** + **video** randevu (offer/respond) · `presence/ping` (heartbeat) |
| `doctor` · `auth` | Doktor tercihleri/akademik/işlem · oturum + **`signup`** (doktor kaydı) + **`google/{start,callback}`** (OAuth, env-gated) |
| `admin` | `doctors/[id]/verify` — doktor doğrulama (ADMIN/Etik Kurul) |

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
scripts/                    # add-demo-cases.ts (idempotent), gen-icons.mjs, ...
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
DICOM PHI tag-strip (bilinçli park — `deidentify.ts` başlığı) · veri ikametgâhı (data residency) —
çok ülkeli pazar girişi için.

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
  (uydurma pazarlama varsayılanı yok); `verified` default false; public profil `/hekim/[id]`
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
  (`consent.ts` · `crypto.ts` · `ownership.ts` · `/admin/hekim-onay` · `audit.ts` · `booking`
  `agencySentAt` kapısı) — **madde eklemeden ÖNCE kod kanıtını göster.**
  ⚠️ **Görünür metin YETMEZ:** `meta`/`og`/`twitter`/**JSON-LD** (`app/page.tsx`) aynı iddia sınıfıdır,
  ayrı tara. 🪤 hero "Telehealth and Health Tourism, **end to end**" + `layout.tsx` "uçtan uca dijital
  sağlık platformu" = **hizmet sürekliliği**, şifreleme iddiası DEĞİL → dokunma.
- **Güven ve Gizlilik sayfası (v6.12) — `/guven-ve-gizlilik`, iddia dürüstlüğünün ANA YÜZEYİ:** yukarıdaki
  kuralların uzun biçimi; 10 bölüm × 8 dil (`copy.ts` `trustPage` · `components/aura/trust-safety.tsx`).
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
  da imzada**) 8 dilde birebir kalır; bölüm-özgü render **key ile** bağlanır, index ile DEĞİL.
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
  çelişiyordu**. Sözlük `copy.ts` → `v2.nav` (8 dil); `menu`/`close` **kök nav sözlüğünden yeniden
  kullanılır** (`t.nav.menu` — zaten 8 dilde çevrili, tekrar tanımlama).
  · 🪤 **`nav.cta` = `hero.ctaPrimary` — 8 dilde AYNI etiket** (`nav.tsx`'in *"aynı etiket = aynı
  niyet"* sözleşmesi: ikisi de `/giris`'e gidiyor). Brand paketinin nav çevirileri v6.14 hero
  çevirilerinden **ayrı kalemden** gelmişti → EN dışında **7 dilde iki farklı etiket** çıkmıştı
  (TR *"Bakımınıza başlayın"* vs *"Bakım yolculuğunu başlat"*). **Birini değiştirirsen diğerini de
  değiştir.** Taşma değil ses sorunuydu: 1024px'te en uzun etiket (TR **187px**) ile link grubu
  arasında **222px** boşluk ölçüldü — uzunluk kısıt değil.
  · **Hero ikincil CTA → `#how`** (v6.16): etiket *"AURA nasıl çalışır?"* diyor → 4 adımlık şeride
  iner. Önce `#care`'e gidiyordu = **etiketle hedef çelişiyordu**.
  · **Doktorlar İçin → `/kurumsal-giris`** (geçici): todo'daki `/for-clinicians` rotası gelince oraya
  bağlanır. ⚠️ **"Hekim" DEĞİL "Doktor"** — v4.21 proje-geneli rename (brand paketi "Hekimler İçin"
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
  4 madde + not) — sözlük `copy.ts` `v2.ai` / `v2.accessibility`, 8 dil.
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
  · **Locale rotaları `/en…/az` (`app/[lang]`):** ÇALIŞIR ama **bilinçli noindex + sitemap dışı** —
  "/" hâlâ 8-dil-tek-URL kanoniği (v5.9.1). **📌 Kullanıcı kararı (2026-07-16): KAPALI KALIYOR** —
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
