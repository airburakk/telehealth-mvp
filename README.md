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
- **Prisma 6 + PostgreSQL (Neon)** — yerel ve üretim **aynı** Neon DB (SQLite kullanılmaz)
- **Kimlik doğrulama:** imzalı JWT (`jose`) httpOnly cookie + `bcryptjs` + rol bazlı proxy (Next 16)
- **AI:** `@anthropic-ai/sdk` (Claude — triyaj/SOAP/epikriz/çeviri/vision) · `@google/genai`
  (Gemini Live — gerçek zamanlı ses→ses tercüme)
- **Gerçek zamanlı:** WebRTC P2P (polling tabanlı sinyalleşme — `Signal` modeli) + Cloudflare Realtime TURN relay (yedek: Metered)
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

> Yerel `.env` doğrudan **üretim Neon DB'sine** yazar (tek ortak DB). Dikkatli ol.
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
| `npm run test:e2e` | **E2E testleri** (Playwright — 3 demo-kritik akış; dev branch'e bağlı sunucu + `E2E_BASE_URL` gerekir, bkz. `tests/e2e/README.md`) |
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
| 2 | **Doktor Paneli + Video** | ✅ Aciliyet sıralı kuyruk, kokpit, **gerçek WebRTC** video + canlı transkript (Web Speech) + AI-SOAP + medikal çeviri + **AI Epikriz** + **Gemini canlı tercüman** (iki yönlü ses+altyazı) — **transkript + tercüme ilk konuşma sesinde otomatik başlar (VAD; başlat düğmesi yok), tercüme yalnız diller farklıysa** + **DICOM görüntüleyici** (5 sıkıştırılmış codec) + klinik kodlama (FHIR) |
| 3 | **Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, **3 kademeli sigorta** (1 zorunlu · 2 operasyon teminat poliçesi [toplam fatura×oran×branş riski] · 3 malpraktis — doktorun yüklediği MMSS'inin bıraktığı boşluğu doldurur; `lib/pricing.ts` `computeInsurance`, parametrik/endikatif), **Escrow + split** + **lojistik Patient Journey takibi** (durum+tarih+not; koordinatör yönetir, hasta görür) + SOAP'tan AI paket teklifi + hastaya teklif gönderme (link/PDF) |
| 4 | **Post-Op Takip** | ✅ Günlük kontrol (ağrı/ateş/ilaç/foto), kırmızı bayrak, branş protokolü, doktor izleme + **Güvenli Dijital Paylaşım** (token/TTL/şifre/audit/iptal) + alıcı dilinde görüntüleme + **AI foto analizi** (Claude vision) |
| 5 | **Doktor Adaptasyon** | ✅ **Self-signup** (`/kayit` — Google[env-gated]/Apple[yakında]/e-posta → `User`+`Doctor` `verified:false`, `lib/doctor-signup` + `lib/oauth`) + **Doktor Ana Sayfası — 5 pencere** (Klinik Nöbet / İkinci Görüş / Ücretsiz Sağlık Hizmeti / Konsültasyon Talepleri / Haberler), her doktora ünvan+opt-in'e göre koşullu (`lib/doctor-home.ts`) + **ilk-giriş onboarding** (`/doktor/baslangic`: **FHIR uzmanlık** [diploma/tescil no = Practitioner.identifier + uzmanlık belgesi = qualification] + **branş işlemleri & ücretleri** ≥1 [`ProcedureSelector`→`Doctor.procedures`] + **zorunlu mesleki belge** — Tıp Diploması + MMSS poliçesi; hepsi tamamlanmadan hesap **aktifleşmez** [`canCompleteOnboarding` gate; `DoctorDocument` + `Doctor.activatedAt` + `lib/doctor-activation`; içerik at-rest şifreli; MMSS teminat limiti → M3 Katman 3 malpraktis girdisi]; İkinci Görüş ünvana göre; Ücretsiz Sağlık Hizmeti + Konsültasyon opt-in) + Panel 1 yalnız eşleşen vakalar + itibar/hakediş/kapasite/profil tercihleri (dil/pazar/işlem-ücret/opt-in). **Doğrulama kapısı:** self-signup doktor `verified:false` başlar → doktor dizini + Nöbetçi/İcapçı/Ücretsiz Sağlık Hizmeti eşleştirmelerinde gizli; **`/admin/hekim-onay`** (ADMIN/Etik Kurul) onayıyla `verified:true` olur (bildirim) |
| 6 | **Doktor Tanıtım** | ✅ Doktor dizini + doğrulanmış profil (**verified-kapılı** — doğrulanmamış doktor public profil alamaz), **gerçek profil fotoğrafı** (`Doctor.photo` per-doktor / cinsiyet-fallback) + **tanıtım videosu** (cinsiyete göre), yorumlar (gerçek Review; üretim-fallback **"örnek değerlendirme" etiketli**), akreditasyon (JCI — yalnız gerçek veri, uydurma varsayılan yok), **kalıcı akademik** (düzenlenebilir) |
| 7 | **Etik Kurul** | ✅ Şikayet, anonimleştirilmiş (data masking) inceleme, karar/yaptırım, **Escrow iade** tetikleyicisi |
| — | **Tedavi Kararı → STA akışı (2026-07-10)** | ✅ Görüşme ekranında **birleşik Klinik Kodlama + Tedavi Kararı** paneli (`ClinicalDecisionPanel`): ICD-10 tanı → **tanıya eşlenmiş işlemler** aktifleşir (küratörlü statik eşleme `data/icd-procedures.ts` + isteğe bağlı **AI işlem önerisi** `/api/ai/suggest-procedures`) → taban↔tavan slider ücret (onboarding artık ücret SORMAZ; doktor fiyat hafızası karar kaydında güncellenir) → **öngörülen tedavi süresi (gün aralığı)** → **hastane seçimi** (HealthTürkiye dizini) → Kaydet = dosya **Sağlık Turizmi Acentesine** iletilir (`agencySentAt` + AGENCY bildirimi). Eski "Paketi oluştur / AI Teklif hazırla / Sağlık Turizmi Paketi" düğmeleri kaldırıldı — **teklifi acente hazırlar** (`/acente`, kısıtlı dosya, `mode=offer`). **AI Epikriz post-op ekranına taşındı** (`/takip/[caseId]` personel görünümü); hasta aynı ekrandan **"Epikriz iste"** talebi açar (`dischargeRequestedAt` + doktora bildirim) |
| — | **HealthTürkiye kayıt defteri (2026-07-10)** | ✅ `healthturkiye.gov.tr` resmi dizini günlük senkron (`lib/ht-registry.ts` — web-api.healthturkiye.gov.tr; ~10.000 doktor + ~4.600 tesis; soft-delete diff) → `RegistryDoctor`/`RegistryHospital`/`RegistryReport`; **cron** `vercel.json` → `/api/cron/registry-sync` (günde 1, `CRON_SECRET`) → **günlük eklenen/çıkarılan raporu** `/admin/registry-raporu` + ADMIN bildirimi. **Doktor kayıt doğrulaması:** signup'ta ad-soyad dizin eşleşmesi → `Doctor.registryStatus` → `/admin/hekim-onay`'da yeşil rozet / **kırmızı uyarı bayrağı**. Tedavi kararındaki hastane seçici bu dizinden (`/api/registry/hospitals`). **Detay zenginleştirme (2026-07-10):** tesislerin **hizmet dilleri / akreditasyon / olanak adları + sağlık turizmi yetki belge no'su** (`authorizationNumber`, ör. "ST-0292") sitenin SSR detay JSON'undan doldurulur (`enrichHospitalDetails` — cron'da 40/gün + ilk toplu doldurma `scripts/registry-enrich.ts`; belge-no backfill `… auth`); hastane seçici sonuçlarında 🌐 diller + 🏅 akreditasyonlar + **🛡 yetki belgesi rozeti**; rozet **hasta yüzünde** de görünür (teklif `/teklif` + rezervasyon `/rezervasyon` paket kartında, çevrili etiketle) ve acente dosyasında hastane kartında. **Alan-güncellemesi (v5.4):** liste-API alanlarının kısa hash'i (`fingerprint`) satırda tutulur; günlük senkron yalnız hash'i değişen kayıtları günceller (ad/şehir/branş değişimleri; tavan 1000 — aşımı rapor notuna düşer, enrichment alanları etkilenmez); ilk doldurma `scripts/registry-fingerprint-backfill.ts`, rapor sayfasında "✎ güncellendi" sayacı |
| — | **Bildirim kanalı + hasta iletişim (2026-07-10)** | ✅ Doktor Ana Sayfa **bildirim tercihi** (Uygulama/WhatsApp/SMS — WA+SMS **dormant simülasyon** `lib/messaging.ts`, env anahtarı eklenince gerçek gönderime hazır; kayıt formunda cep telefonu alanı, at-rest şifreli) · **4 hasta intake'inde** (triyaj/SO/turizm/ücretsiz) telefon + "hangi yoldan ulaşalım?" (Uygulama/SMS/E-posta) → `patientPhone` (şifreli) + `contactPreference` · **Partner-konsültasyon videosu 10 dk sınırlı** (7'de kırmızı, 9'da iki tarafa uyarı; otomatik kesme yok) |
| — | **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul/admin/**partner**/**acente[AGENCY]**), bcrypt + JWT + proxy + KVKK onam kapısı + **doktor self-signup** (`/kayit`; e-posta + Google OAuth [env yoksa dormant] + Apple [yakında]) + **e-posta doğrulama** (v5.6, `RESEND_API_KEY` yoksa dormant: yeni e-posta kayıtları doğrulama bağlantısı almadan giriş yapamaz [mevcut/demo hesaplar muaf, Google doğrulanmış sayılır]; `lib/email.ts` + `lib/email-verification.ts` + `/api/auth/verify-email` + `/api/auth/resend-verification`) |
| — | **Partner Doktor + Konsültasyon Havuzu** | ✅ **Partner Doktor** (`PartnerDoctor` + `PARTNER` rolü, `/partner`): hasta DB erişimi YOK, anonim konsültasyon talebi açar (+**tıbbi belge yükleme** → `assessDocument` AI: tür/TR çeviri/özet/anormal bayrak/LOINC lab) → **anonimleştirme katmanı** (`lib/deidentify.ts`: yapısal de-id + TC/pasaport/e-posta/telefon scrub; DICOM hariç) → **`ConsultationRequest` havuzu** (at-rest şifreli; `/doktor/konsultasyon`'da kayıtlı doktorlar görüş + **kodlu öneri** verir: lab/görüntüleme=ServiceRequest, ilaç=MedicationRequest ATC). **Çift-yönlü AI çeviri** (özet→TR doktor · görüş→hasta dili partner) + **FHIR Bundle** (`/fhir/ConsultationRequest/[id]`). Yanıt başına ödeme simüle. **Yazılı görüşme (chat — Faz 2):** partner↔doktor çift-yönlü `ConsultationMessage` (at-rest şifreli + AI oto-çeviri; doktor nihai görüş öncesi de soru sorabilir → talebi atomik sahiplenir, IN_DISCUSSION). **Görüntülü görüşme (video — Faz 3):** presence/heartbeat (`/api/presence/ping`) + İcapçı offer/respond randevu (`ConsultationVideoAppointment`) + WebRTC oda (`/konsultasyon/gorusme/[id]`; sinyalleşme yeniden kullanımı + fallback chat) |

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
- **Consent Manager + RFC 3161 ispat:** `/onam` tek seferlik KVKK onamı; sürümlü `ConsentRecord` +
  hash-zinciri + zaman damgası + Onay Kanıtı (`/onam/kanit`). (`lib/consent.ts`, `lib/timestamp.ts`)
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
| `/` · `/giris` · `/giris/e-posta` · `/kurumsal-giris` · `/kurumsal-giris/e-posta` · `/kayit` · `/kayit/hasta` · `/onam` (+`/onam/kanit`) | **AURA sinematik landing** (v5.9 — vitrinden taşındı: hero video+letterform, 4 chapter destesi, gsap+lenis; 8 dil statik `lib/aura-landing/copy.ts`, dil anahtarı `air_lang`) · **SEO (v5.9.2):** canonical + OpenGraph/Twitter kart + 8-dil `og:locale:alternate` (tek URL — `lib/aura-landing/seo.ts`) + JSON-LD MedicalOrganization/WebSite · **hasta giriş kapısı** + **`/giris/e-posta` çalışan form** · **kurumsal giriş kapısı** (noindex) + **`/kurumsal-giris/e-posta` form** (v5.9.1 kapı/form ayrımı — kapılar `components/aura/auth-gates.tsx`) · doktor kaydı · **hasta üyeliği** · KVKK onam + Onay Kanıtı |
| `/how-it-works` | **Nasıl Çalışır rehberi** (v5.9 — vitrinden taşındı): 4 yolculuğun adım listeleri + tıkla-oynat rehber videoları + HowTo JSON-LD + OpenGraph (title template `%s · AURA`); global Header/SiteFooter bu rotada ve `/`'de gizli (sayfa kendi aura nav/footer'ını taşır). Eski vitrin aura-health.higgsfield.app tüm sayfaları buraya 301 yönlendirir |
| `/sitemap.xml` · `/robots.txt` | **SEO altyapısı (v5.9.2):** `app/sitemap.ts` yalnız 7 halka açık rota (/, /how-it-works, /giris, /kayit, /kayit/hasta, /second-opinion, /ucretsiz-saglik) · `app/robots.ts` hassas panel/API disallow + sitemap referansı. `SITE_URL` tek kaynak `lib/aura-landing/seo.ts` (domain taşınırsa tek nokta) |
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
| `consent` · `access-log` | KVKK onam + `proof` (RFC 3161 kanıt) · erişim denetim kaydı (audit) |
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
tests/                       # vitest unit/ (saf mantık, DB yok) + integration/ (Neon dev branch) · Playwright e2e/ (3 akış)
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

## Sonraki adımlar (backlog)

Güncel yol haritası vault'ta: `Air/wiki/todo.md`. Öne çıkanlar (altyapı/hukuk gerektirir):
gerçek ödeme + Escrow gateway (Iyzico/Stripe — şu an simülasyon) · **object storage ✅ Vercel Blob**
(belgeler artık Blob'ta şifreli; token yoksa base64-in-DB fallback) · ileri E2EE fazları (Faz 0+1 ✅ at-rest/audit; Faz 2A ✅ post-op erişim daraltma + geri-alma; 2B kriptografik allowlist + Faz 3 gerçek sıfır-erişim kalan) · gerçek RFC 3161 TSA (şimdilik simüle) ·
e-posta/SMS proaktif bildirim · veri ikametgâhı (data residency) — çok ülkeli pazar girişi için.

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
- **Doktor veri dürüstlüğü (v4.19):** rating/successRate/experienceYears/jci nullable + default'sız
  (uydurma pazarlama varsayılanı yok); `verified` default false; public profil `/hekim/[id]`
  verified-kapılı; üretilmiş yorumlar "örnek değerlendirme" etiketli; eşleştirme skoru boş metriği
  inactive sayar. `GET /api/cases` artık sayfalı zarf döner: `{items,total,page,pageSize,totalPages}`.
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
