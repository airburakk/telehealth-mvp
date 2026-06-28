# AIR / AURA Telehealth — MVP

**🚀 Canlı demo: https://telehealth-mvp-roan.vercel.app** · Demo girişi: `doktor@air.test` / `1234`

Çok ülkeli sağlık turizmi + telehealth platformunun çalışan sürümü.

**Farkı nerede:** sınır ötesi sağlığın asıl zor problemi veri/güven/uyum — ve çözülen kısım bu.
KVKK hash-zincirli onam + RFC 3161 zaman damgalı **Onay Kanıtı**, **FHIR R4** dışa aktarım
(Composition/Consent + denetim izi) ve uçtan uca **AI klinik** (triyaj, belge analizi, SOAP,
epikriz, post-op vision). Bir hafta sonunda klonlanamayan parça budur.

Üstüne uçtan uca akış canlıda: hasta triyajından doktor kokpitine, gerçek WebRTC video
görüşmeye, sağlık turizmi paketine ve post-op takibe — üç paralel hasta akışıyla (**Talk to
Doctor** genel triyaj, **İkinci Görüş**, **Pro Bono** ücretsiz gönüllü konsültasyon).

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
- **Gerçek zamanlı:** WebRTC P2P (polling tabanlı sinyalleşme — `Signal` modeli) + Metered TURN relay
- **DICOM:** `dicom-parser` + `@cornerstonejs/codec-openjpeg` + `codec-charls` + `jpeg-lossless-decoder-js`
- **PWA / bildirim:** service worker + `web-push` (VAPID)

## Çalıştırma

```bash
npm install
cp .env.example .env          # değerleri doldur (DATABASE_URL, SESSION_SECRET zorunlu)
npx prisma db push            # şemayı Neon'a uygula (ilk kez)
npm run db:seed               # demo veri: kullanıcılar + 30 hekim + 20 vaka + takip/şikayet
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
| `npm run db:seed` | `prisma/seed.ts` — demo veri (tam reset) |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npx tsx scripts/enrich-profiles.ts` | profil/vaka **zenginleştirme** (idempotent backfill; yalnız boş alan: doktor procedures/markets/akademik + vaka FHIR lab/icd10/belge — silmez) |

## Roller & Giriş

Uygulama kimlik doğrulama gerektirir (`/giris`). Hekimler **`/kayit`** ile kendileri kayıt
olabilir (Google [env-gated] / Apple [yakında] / e-posta). Giriş sonrası tek seferlik KVKK onam
kapısı (`/onam`) vardır (sürümlü; `lib/consent-config.CONSENT_VERSION` artarsa bir kez yeniden
alınır). Demo kullanıcıları (parola `1234`):

| Rol | E-posta | Erişim |
|-----|---------|--------|
| Hasta | `hasta@air.test` | Vakalarım, triyaj, paket, takip, şikayet, paylaşım, İkinci Görüş, Pro Bono |
| Doktor | `doktor@air.test` | **Doktor Ana Sayfası (5-pencere)** + onboarding, video görüşme, klinik kodlama, post-op izleme, klinik nöbet, Pro Bono, **Konsültasyon Talepleri** |
| Koordinatör | `koordinator@air.test` | Operasyon paneli (S2) + doktor alanı |
| Etik Kurul | `kurul@air.test` | Etik Kurul paneli |
| Partner Doktor | `partner@air.test` | **Partner paneli** — yurtdışı ortak hekim; hasta DB erişimi YOK, uzaktan hizmet YOK; yalnız anonim **konsültasyon talebi** açar |

Rol bazlı erişim `src/proxy.ts` (Next 16 proxy konvansiyonu) ile zorlanır. Yetkisiz erişim `/giris`'e, yanlış rol ana
sayfaya, onamsız oturum `/onam`'a yönlendirilir. Parolalar `bcrypt` ile hash'lenir; `.env`
içinde `SESSION_SECRET` tanımlı olmalıdır.

## Modüller (canlı)

### 7 çekirdek modül

| # | Modül | Durum |
|---|-------|-------|
| 1 | **Triyaj** | ✅ Ön-konsültasyon kapısı (ücret/sigorta) → 5 adımlı sihirbaz, **gerçek Claude** branş+aciliyet (30 branş, ~198 dinamik branş sorusu), belge yükleme + **AI ön-değerlendirme** (vision/PDF → tür+TR çeviri+özet+anormal bayrak) + lab→FHIR oto-dolum |
| 2 | **Doktor Paneli + Video** | ✅ Aciliyet sıralı kuyruk, kokpit, **gerçek WebRTC** video + canlı transkript (Web Speech) + AI-SOAP + medikal çeviri + **AI Epikriz** + **Gemini canlı tercüman** (iki yönlü ses+altyazı) + **DICOM görüntüleyici** (5 sıkıştırılmış codec) + klinik kodlama (FHIR) |
| 3 | **Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, **3 kademeli sigorta** (1 zorunlu · 2 operasyon teminat poliçesi [toplam fatura×oran×branş riski] · 3 malpraktis — doktorun yüklediği MMSS'inin bıraktığı boşluğu doldurur; `lib/pricing.ts` `computeInsurance`, parametrik/endikatif), **Escrow + split** + **lojistik Patient Journey takibi** (durum+tarih+not; koordinatör yönetir, hasta görür) + SOAP'tan AI paket teklifi + hastaya teklif gönderme (link/PDF) |
| 4 | **Post-Op Takip** | ✅ Günlük kontrol (ağrı/ateş/ilaç/foto), kırmızı bayrak, branş protokolü, doktor izleme + **Güvenli Dijital Paylaşım** (token/TTL/şifre/audit/iptal) + alıcı dilinde görüntüleme + **AI foto analizi** (Claude vision) |
| 5 | **Doktor Adaptasyon** | ✅ **Self-signup** (`/kayit` — Google[env-gated]/Apple[yakında]/e-posta → `User`+`Doctor` `verified:false`, `lib/doctor-signup` + `lib/oauth`) + **Doktor Ana Sayfası — 5 pencere** (Klinik Nöbet / İkinci Görüş / Pro Bono / Konsültasyon Talepleri / Haberler), her hekime ünvan+opt-in'e göre koşullu (`lib/doctor-home.ts`) + **ilk-giriş onboarding** (`/doktor/baslangic`: **FHIR uzmanlık** [diploma/tescil no = Practitioner.identifier + uzmanlık belgesi = qualification] + **branş işlemleri & ücretleri** ≥1 [`ProcedureSelector`→`Doctor.procedures`] + **zorunlu mesleki belge** — Tıp Diploması + MMSS poliçesi; hepsi tamamlanmadan hesap **aktifleşmez** [`canCompleteOnboarding` gate; `DoctorDocument` + `Doctor.activatedAt` + `lib/doctor-activation`; içerik at-rest şifreli; MMSS teminat limiti → M3 Katman 3 malpraktis girdisi]; İkinci Görüş ünvana göre; Pro Bono + Konsültasyon opt-in) + Panel 1 yalnız eşleşen vakalar + itibar/hakediş/kapasite/profil tercihleri (dil/pazar/işlem-ücret/opt-in). **Doğrulama kapısı:** self-signup hekim `verified:false` başlar → hekim dizini + Nöbetçi/İcapçı/Pro Bono eşleştirmelerinde gizli; **`/admin/hekim-onay`** (ADMIN/Etik Kurul) onayıyla `verified:true` olur (bildirim) |
| 6 | **Doktor Tanıtım** | ✅ Hekim dizini + doğrulanmış profil, **gerçek profil fotoğrafı** (`Doctor.photo` per-doktor / cinsiyet-fallback) + **tanıtım videosu** (cinsiyete göre), yorumlar (gerçek Review/üretim-fallback), akreditasyon (JCI), **kalıcı akademik** (düzenlenebilir) |
| 7 | **Etik Kurul** | ✅ Şikayet, anonimleştirilmiş (data masking) inceleme, karar/yaptırım, **Escrow iade** tetikleyicisi |
| — | **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul/admin/**partner**), bcrypt + JWT + proxy + KVKK onam kapısı + **doktor self-signup** (`/kayit`; e-posta + Google OAuth [env yoksa dormant] + Apple [yakında]) |
| — | **Partner Doktor + Konsültasyon Havuzu** | ✅ **Partner Doktor** (`PartnerDoctor` + `PARTNER` rolü, `/partner`): hasta DB erişimi YOK, anonim konsültasyon talebi açar (+**tıbbi belge yükleme** → `assessDocument` AI: tür/TR çeviri/özet/anormal bayrak/LOINC lab) → **anonimleştirme katmanı** (`lib/deidentify.ts`: yapısal de-id + TC/pasaport/e-posta/telefon scrub; DICOM hariç) → **`ConsultationRequest` havuzu** (at-rest şifreli; `/doktor/konsultasyon`'da kayıtlı hekimler görüş + **kodlu öneri** verir: lab/görüntüleme=ServiceRequest, ilaç=MedicationRequest ATC). **Çift-yönlü AI çeviri** (özet→TR hekim · görüş→hasta dili partner) + **FHIR Bundle** (`/fhir/ConsultationRequest/[id]`). Yanıt başına ödeme simüle. **Yazılı görüşme (chat — Faz 2):** partner↔hekim çift-yönlü `ConsultationMessage` (at-rest şifreli + AI oto-çeviri; hekim nihai görüş öncesi de soru sorabilir → talebi atomik sahiplenir, IN_DISCUSSION). **Görüntülü görüşme (video — Faz 3):** presence/heartbeat (`/api/presence/ping`) + İcapçı offer/respond randevu (`ConsultationVideoAppointment`) + WebRTC oda (`/konsultasyon/gorusme/[id]`; sinyalleşme yeniden kullanımı + fallback chat) |

### Paralel hasta akışları

- **İkinci Görüş (Second Opinion):** genel triyajdan bağımsız akış — 12 durumlu state machine, 7
  Prisma modeli, CRM oto-atama + hoca kabul, 4 bölümlü yazılı görüş + video randevu teklifi, izole
  video oda. SLA: **600 USD · 5-7 iş günü · video 15 gün**. (`lib/second-opinion.ts`)
- **Pro Bono:** sağlığa erişimi kısıtlı hastaları gönüllü hekimlerle **ücretsiz** video görüşmede
  buluşturan akış — atomik eşleştirme, doktor konsolu + haftalık kontenjan. (`lib/pro-bono.ts`)

### Kesişen yetenekler

- **i18n (8+ dil) + RTL:** tüm hasta yüzeyleri çevrilir (Arapça/Farsça RTL dâhil); `Translation`
  cache + `lib/i18n.ts` + `/api/i18n` + `useT`. Klinik veri **TR kanonik** (doktor/AI etkilenmez).
- **FHIR R4 dışa aktarım:** `/fhir/Composition/:caseId` (epikriz→Composition; ICD-10/LOINC/SNOMED) ·
  `/fhir/Consent/:shareId` + audit. (`lib/fhir.ts`)
- **PWA + Web Push:** kurulabilir uygulama; tarayıcı kapalıyken cihaz bildirimi (VAPID).
- **Bildirim Merkezi:** Header zili; rol- ve kullanıcı-hedefli `Notification`.
- **Operasyon Paneli (S2):** `/operasyon` — KPI, dönüşüm hunisi, gelir/Escrow, dağılımlar, trend, kapasite ·
  **Lojistik takip** (`/operasyon/lojistik` — rezervasyonların Patient Journey aşamalarını yönet). (`lib/journey.ts`)
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
  "online doktor yoksa 3-seçenek kapısı" (`/triyaj/[id]`) + `ConsultAppointment`. (`lib/clinical-duty.ts`)
- **CRM eşleştirme kalite indikatörleri (9 metrik):** doktor seçimi branş/müsaitlik dışında performans
  metadata'sıyla ağırlıklandırılır — rating · başarı · pro bono · icap dönüş oranı · **yanıt süresi**
  (`Doctor.respCount/respTotalSec`) · **iptal oranı** (ConsultAppointment+SO CANCELLED) · **tamamlanan vaka
  hacmi** · **yorum hacmi** · **güncellik**. **Veri-olgunluk-farkında:** verisi olmayan oran/zaman metrikleri
  skoru dilute etmez (ağırlık aktif kümeye yeniden normalize) → "ölçekle değer artar". Uygulandığı yerler:
  Nöbetçi · SO oto-atama (+ yük dengeleme) · İcapçı fan-out. Doktor `/doktor/profil`'de kendi **kalite
  kartını** (genel skor + metrik dökümü), hasta `/hekim/[id]`'de **güven rozetlerini** (eşik-bazlı, anlam-renk,
  hover tooltip) görür. Pro Bono FIFO kalır. Metadata = klinik içerik değil → E2EE uyumlu. (`lib/match-score.ts`)
- **Hasta–doktor uyumu (soft boost):** kalite (mutlak) yanına vaka-özel uyum (göreceli) eklenir —
  pazar (`Doctor.markets` ⊇ `Case.country`) + acil vakada deneyim (`Case.urgency`≥4 → `Doctor.experienceYears`).
  Uyumlu hekim sıralamada öne çıkar; **uyumsuz ELENMEZ, yalnız geri sıralanır** (erişim korunur). markets boş =
  "tüm pazarlar". Dil kasıten kriter değil (simultane tercüme kapsar). Nöbetçi · İcapçı · SO oto-atamada etkin.
  Şema değişmez; "ölçekle değer artar" (hekimler `markets` girdikçe etki büyür). (`fitScore` → `lib/match-score.ts`)
- **Görüşme öncesi oda:** cihaz testi + geri sayım + 3 alt-durum (`PreConsultLobby`).

## Rotalar

| Rota | Açıklama |
|------|----------|
| `/` · `/giris` · `/kayit` · `/onam` (+`/onam/kanit`) | Landing · giriş · **doktor kaydı** (Google/Apple/e-posta) · KVKK onam + Onay Kanıtı |
| `/triyaj` · `/triyaj/[id]` | Triyaj sihirbazı · vaka süreç sayfası + 3-seçenek kapısı |
| `/vakalarim` · `/erisim-kaydi` | Hastanın vaka ana ekranı · erişim denetim kaydı ("verime kim erişti") |
| `/doktor` (+`/baslangic`, `/vaka/[id]`, `/takip`, `/profil`, `/pro-bono`, `/konsultasyon`) | Doktor Ana Sayfası (5-pencere), ilk-giriş onboarding, kokpit, izleme, profil, Pro Bono, klinik nöbet, Konsültasyon Talepleri kutusu |
| `/partner` (+`/talep`) | Partner Doktor paneli (**tüm arayüz partner dilinde + RTL**, haber akışı dahil) · anonim konsültasyon talebi oluşturma (belge yükleme, hasta DB erişimi yok) |
| `/gorusme/[id]` | WebRTC video görüşme odası (asimetrik) |
| `/konsultasyon/gorusme/[id]` | Konsültasyon görüntülü görüşme odası (partner↔hekim, Faz 3; fallback chat) |
| `/paket/[caseId]` · `/rezervasyon/[id]` · `/teklif/[id]` | Paket · Escrow rezervasyon · hastaya gönderilen teklif |
| `/takip/[caseId]` | Post-op takip |
| `/hekimler` · `/hekim/[id]` | Hekim dizini · doğrulanmış profil |
| `/sikayet/[caseId]` · `/etik-kurul` (+`/[id]`) · `/denetim` | Şikayet · Etik Kurul liste/karar · denetim izi bütünlüğü (denetçi) |
| `/admin/hekim-onay` | Hekim doğrulama onayı (ADMIN/Etik Kurul) — self-signup hekimi `verified:true` yapar |
| `/operasyon` (+`/lojistik`) | Operasyon paneli · lojistik Patient Journey takibi (S2 — koordinatör/admin) |
| `/paylasim/[token]` · `/paylasimlarim` | Güvenli paylaşım görüntüleyici · paylaşım yönetimi |
| `/second-opinion/*` | İkinci Görüş başvuru/vaka/görüşme akışı |
| `/pro-bono/*` | Pro Bono başvuru/bekleme/landing |
| `/fhir/*` | FHIR R4 kaynak çıkışı (Composition / Consent / audit / **ConsultationRequest** Bundle) |

### API (route handler grupları — `src/app/api/`)

| Grup | İşlev |
|------|-------|
| `triage` | Semptom → branş/aciliyet (Claude + kural fallback) |
| `cases` | Vaka CRUD + `/[id]/{consult,coding,labs,analyze-docs,sentinel-consult,icapci-request,appointment,terminate}` |
| `consultations` | Görüşme not/bitiş + `/[id]/signal` (WebRTC sinyalleşme) |
| `ai` | `soap` · `translate` · `discharge` (Claude) |
| `i18n` | Arayüz çeviri (Translation cache) |
| `realtime` | `token` (Gemini Live) · `ice` (Metered TURN credentials) |
| `consent` · `access-log` | KVKK onam + `proof` (RFC 3161 kanıt) · erişim denetim kaydı (audit) |
| `clinical` | `duty` — klinik nöbet/müsaitlik |
| `second-opinion` | İkinci Görüş state machine işlemleri |
| `pro-bono` | `apply`/`waiting`/`availability`/`doctor-feed`/`outcome`/`status` |
| `shares` · `complaints` · `bookings` | Güvenli paylaşım · şikayet · rezervasyon |
| `notifications` · `push` | Bildirim merkezi · Web Push aboneliği |
| `consultation-requests` · `presence` | Konsültasyon talebi yanıt/belge + **chat (`messages`)** + **video** randevu (offer/respond) · `presence/ping` (heartbeat) |
| `doctor` · `auth` | Hekim tercihleri/akademik/işlem · oturum + **`signup`** (doktor kaydı) + **`google/{start,callback}`** (OAuth, env-gated) |
| `admin` | `doctors/[id]/verify` — hekim doğrulama (ADMIN/Etik Kurul) |

## Proje yapısı

```
src/
  proxy.ts                   # rol + onam bazlı erişim kontrolü (Next 16 proxy)
  app/                       # 26 rota dizini (yukarıdaki tablo) + api/ (22 grup)
  components/                # 53 bileşen (ConsultationRoom, ConsultationChat, DoctorSignupForm,
                             #   LiveInterpreter, DicomViewer, ProcessTracker, NotificationBell, useT, ...)
  lib/                       # 50 modül:
                             #   db · auth/session · oauth · doctor-signup · doctor-activation
                             #   triage(+ -llm,-questions) · ai-clinical · fhir(+ -http)
                             #   second-opinion(+ -service) · pro-bono(+ tracker'lar)
                             #   clinical-duty · consent(+ -config) · timestamp · audit · i18n · ownership
                             #   notify · push · ice · billing/pricing/fxrate/procedures · postop · share ...
  data/                      # coding.ts (ICD-10/LOINC/SNOMED) · procedures.json · second-opinion-docs.ts
prisma/
  schema.prisma             # 32 model (User, Doctor, Case, Consultation, ConsultationMessage,
                            #   ConsultationVideoAppointment, Booking, Recovery, CheckIn,
                            #   ShareLink/ShareAccess, Notification, ConsentRecord, AccessLog,
                            #   ConsultAppointment, CaseDocument, DoctorDocument, SecondOpinion* ×7, ...)
  seed.ts                   # demo veri (30 hekim + 20 vaka)
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
`METERED_API_KEY`/`METERED_DOMAIN` (WebRTC TURN) · `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (doktor
kaydında "Google ile devam et"; boşsa dormant) · (opsiyonel) `TRIAGE_MODEL`.

## Deploy

**Vercel** (serverless) + **Neon Postgres** üzerinde canlı. GitHub `airburakk/telehealth-mvp`
(`main`) → Vercel otomatik deploy. Adım adım kılavuz: [`DEPLOY.md`](./DEPLOY.md).

## Sonraki adımlar (backlog)

Güncel yol haritası vault'ta: `Air/wiki/todo.md`. Öne çıkanlar (altyapı/hukuk gerektirir):
gerçek ödeme + Escrow gateway (Iyzico/Stripe — şu an simülasyon) · gerçek object storage (belgeler
şu an base64-in-DB) · ileri E2EE fazları (Faz 0+1 ✅ at-rest/audit; Faz 2A ✅ post-op erişim daraltma + geri-alma; 2B kriptografik allowlist + Faz 3 gerçek sıfır-erişim kalan) · gerçek RFC 3161 TSA (şimdilik simüle) ·
e-posta/SMS proaktif bildirim · veri ikametgâhı (data residency) — çok ülkeli pazar girişi için.

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın; güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri (DPA/SCC), AI sağlayıcı
  aktarım güvenceleri ve uygun bölge (AB/TR) seçimi gerekir (bkz. vault `wiki/kavramlar/`).
