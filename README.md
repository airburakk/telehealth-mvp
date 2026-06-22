# AIR / AURA Telehealth — MVP

**🚀 Canlı demo: https://telehealth-mvp-roan.vercel.app** · Demo girişi: `doktor@air.test` / `1234`

Çok ülkeli sağlık turizmi + telehealth platformunun çalışan sürümü. Hasta triyajından
doktor kokpitine, gerçek WebRTC video görüşmeye, sağlık turizmi paketine ve post-op takibe
uzanan **uçtan uca akış canlıda**. Üç paralel hasta akışı vardır: **Talk to Doctor** (genel
triyaj), **İkinci Görüş** ve **Pro Bono** (ücretsiz gönüllü konsültasyon).

> Bilgi tabanı (Obsidian vault) komşu `../Air` klasöründedir. Güncel mimari için
> `Air/output/guncel-yazilim-mimarisi.md`, modül detayları için `Air/wiki/moduller/`,
> canlı durum/sürüm geçmişi için `Air/wiki/mvp.md` + `Air/wiki/todo.md`.

## Teknoloji

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4**, **lucide-react** ikonlar
- **Prisma 6 + PostgreSQL (Neon)** — yerel ve üretim **aynı** Neon DB (SQLite kullanılmaz)
- **Kimlik doğrulama:** imzalı JWT (`jose`) httpOnly cookie + `bcryptjs` + rol bazlı middleware
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
| `npm run db:seed` | `prisma/seed.ts` — demo veri |
| `npm run db:migrate` | `prisma migrate deploy` |

## Roller & Giriş

Uygulama kimlik doğrulama gerektirir (`/giris`). Giriş sonrası tek seferlik KVKK onam kapısı
(`/onam`) vardır (sürümlü; `lib/consent-config.CONSENT_VERSION` artarsa bir kez yeniden alınır).
Demo kullanıcıları (parola `1234`):

| Rol | E-posta | Erişim |
|-----|---------|--------|
| Hasta | `hasta@air.test` | Vakalarım, triyaj, paket, takip, şikayet, paylaşım, İkinci Görüş, Pro Bono |
| Doktor | `doktor@air.test` | Doktor paneli, video görüşme, klinik kodlama, post-op izleme, klinik nöbet, Pro Bono |
| Koordinatör | `koordinator@air.test` | Operasyon paneli (S2) + doktor alanı |
| Etik Kurul | `kurul@air.test` | Etik Kurul paneli |

Rol bazlı erişim `src/middleware.ts` ile zorlanır. Yetkisiz erişim `/giris`'e, yanlış rol ana
sayfaya, onamsız oturum `/onam`'a yönlendirilir. Parolalar `bcrypt` ile hash'lenir; `.env`
içinde `SESSION_SECRET` tanımlı olmalıdır.

## Modüller (canlı)

### 7 çekirdek modül

| # | Modül | Durum |
|---|-------|-------|
| 1 | **Triyaj** | ✅ Ön-konsültasyon kapısı (ücret/sigorta) → 5 adımlı sihirbaz, **gerçek Claude** branş+aciliyet (30 branş, ~198 dinamik branş sorusu), belge yükleme + **AI ön-değerlendirme** (vision/PDF → tür+TR çeviri+özet+anormal bayrak) + lab→FHIR oto-dolum |
| 2 | **Doktor Paneli + Video** | ✅ Aciliyet sıralı kuyruk, kokpit, **gerçek WebRTC** video + canlı transkript (Web Speech) + AI-SOAP + medikal çeviri + **AI Epikriz** + **Gemini canlı tercüman** (iki yönlü ses+altyazı) + **DICOM görüntüleyici** (5 sıkıştırılmış codec) + klinik kodlama (FHIR) |
| 3 | **Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, sigorta, **Escrow + split** + hasta yolculuğu + SOAP'tan AI paket teklifi + hastaya teklif gönderme (link/PDF) |
| 4 | **Post-Op Takip** | ✅ Günlük kontrol (ağrı/ateş/ilaç/foto), kırmızı bayrak, branş protokolü, doktor izleme + **Güvenli Dijital Paylaşım** (token/TTL/şifre/audit/iptal) + alıcı dilinde görüntüleme + **AI foto analizi** (Claude vision) |
| 5 | **Doktor Adaptasyon** | ✅ İtibar metrikleri, hakediş (komisyon sonrası net), kapasite, müsaitlik, profil tercihleri |
| 6 | **Doktor Tanıtım** | ✅ Hekim dizini + doğrulanmış profil, yorumlar, akreditasyon (JCI), video kartvizit, akademik |
| 7 | **Etik Kurul** | ✅ Şikayet, anonimleştirilmiş (data masking) inceleme, karar/yaptırım, **Escrow iade** tetikleyicisi |
| — | **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul/admin), bcrypt + JWT + middleware + KVKK onam kapısı |

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
- **Operasyon Paneli (S2):** `/operasyon` — KPI, dönüşüm hunisi, gelir/Escrow, dağılımlar, trend, kapasite.
- **Consent Manager + RFC 3161 ispat:** `/onam` tek seferlik KVKK onamı; sürümlü `ConsentRecord` +
  hash-zinciri + zaman damgası + Onay Kanıtı (`/onam/kanit`). (`lib/consent.ts`, `lib/timestamp.ts`)
- **Klinik nöbet rolleri:** Branş / İcapçı / Nöbetçi (`Doctor.clinicalState/onCall/sentinel`) +
  "online doktor yoksa 3-seçenek kapısı" (`/triyaj/[id]`) + `ConsultAppointment`. (`lib/clinical-duty.ts`)
- **Görüşme öncesi oda:** cihaz testi + geri sayım + 3 alt-durum (`PreConsultLobby`).

## Rotalar

| Rota | Açıklama |
|------|----------|
| `/` · `/giris` · `/onam` (+`/onam/kanit`) | Landing · kimlik doğrulama · KVKK onam + Onay Kanıtı |
| `/triyaj` · `/triyaj/[id]` | Triyaj sihirbazı · vaka süreç sayfası + 3-seçenek kapısı |
| `/vakalarim` | Hastanın vaka ana ekranı |
| `/doktor` (+`/vaka/[id]`, `/takip`, `/profil`, `/pro-bono`) | Doktor paneli, kokpit, izleme, profil, Pro Bono, klinik nöbet konsolu |
| `/gorusme/[id]` | WebRTC video görüşme odası (asimetrik) |
| `/paket/[caseId]` · `/rezervasyon/[id]` · `/teklif/[id]` | Paket · Escrow rezervasyon · hastaya gönderilen teklif |
| `/takip/[caseId]` | Post-op takip |
| `/hekimler` · `/hekim/[id]` | Hekim dizini · doğrulanmış profil |
| `/sikayet/[caseId]` · `/etik-kurul` (+`/[id]`) | Şikayet · Etik Kurul liste/karar |
| `/operasyon` | Operasyon paneli (S2 — koordinatör/admin) |
| `/paylasim/[token]` · `/paylasimlarim` | Güvenli paylaşım görüntüleyici · paylaşım yönetimi |
| `/second-opinion/*` | İkinci Görüş başvuru/vaka/görüşme akışı |
| `/pro-bono/*` | Pro Bono başvuru/bekleme/landing |
| `/fhir/*` | FHIR R4 kaynak çıkışı (Composition / Consent / audit) |

### API (route handler grupları — `src/app/api/`)

| Grup | İşlev |
|------|-------|
| `triage` | Semptom → branş/aciliyet (Claude + kural fallback) |
| `cases` | Vaka CRUD + `/[id]/{consult,coding,labs,analyze-docs,sentinel-consult,icapci-request,appointment,terminate}` |
| `consultations` | Görüşme not/bitiş + `/[id]/signal` (WebRTC sinyalleşme) |
| `ai` | `soap` · `translate` · `discharge` (Claude) |
| `i18n` | Arayüz çeviri (Translation cache) |
| `realtime` | `token` (Gemini Live) · `ice` (Metered TURN credentials) |
| `consent` | KVKK onam kaydı + `proof` (RFC 3161 kanıt) |
| `clinical` | `duty` — klinik nöbet/müsaitlik |
| `second-opinion` | İkinci Görüş state machine işlemleri |
| `pro-bono` | `apply`/`waiting`/`availability`/`doctor-feed`/`outcome`/`status` |
| `shares` · `complaints` · `bookings` | Güvenli paylaşım · şikayet · rezervasyon |
| `notifications` · `push` | Bildirim merkezi · Web Push aboneliği |
| `doctor` · `auth` | Hekim tercihleri · oturum |

## Proje yapısı

```
src/
  middleware.ts              # rol + onam bazlı erişim kontrolü
  app/                       # 21 rota dizini (yukarıdaki tablo) + api/ (17 grup)
  components/                # 45 bileşen (ConsultationRoom, LiveInterpreter, DicomViewer,
                             #   PreConsultLobby, ProcessTracker, NotificationBell, useT, ...)
  lib/                       # 36 modül:
                             #   db · auth/session · triage(+ -llm,-questions) · ai-clinical
                             #   fhir(+ -http) · second-opinion(+ -service) · pro-bono(+ tracker'lar)
                             #   clinical-duty · consent(+ -config) · timestamp · i18n · ownership
                             #   notify · push · ice · billing/pricing/fxrate/procedures · postop · share ...
  data/                      # coding.ts (ICD-10/LOINC/SNOMED) · procedures.json · second-opinion-docs.ts
prisma/
  schema.prisma             # 25+ model (User, Doctor, Case, Consultation, Booking, Recovery,
                            #   CheckIn, ShareLink/ShareAccess, Notification, ConsentRecord,
                            #   ConsultAppointment, CaseDocument, SecondOpinion* ×7, ...)
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

Tümü `.env.example`'da: `DATABASE_URL` (pooled) · `DIRECT_URL` (direct) · `SESSION_SECRET` ·
`ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` ·
`METERED_API_KEY`/`METERED_DOMAIN` (WebRTC TURN) · (opsiyonel) `TRIAGE_MODEL`.

## Deploy

**Vercel** (serverless) + **Neon Postgres** üzerinde canlı. GitHub `airburakk/telehealth-mvp`
(`main`) → Vercel otomatik deploy. Adım adım kılavuz: [`DEPLOY.md`](./DEPLOY.md).

## Sonraki adımlar (backlog)

Güncel yol haritası vault'ta: `Air/wiki/todo.md`. Öne çıkanlar (altyapı/hukuk gerektirir):
gerçek ödeme + Escrow gateway (Iyzico/Stripe — şu an simülasyon) · gerçek object storage (belgeler
şu an base64-in-DB) · E2EE / sıfır-erişim fazları · gerçek RFC 3161 TSA (şimdilik simüle) ·
e-posta/SMS proaktif bildirim · veri ikametgâhı (data residency) — çok ülkeli pazar girişi için.

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın; güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri (DPA/SCC), AI sağlayıcı
  aktarım güvenceleri ve uygun bölge (AB/TR) seçimi gerekir (bkz. vault `wiki/kavramlar/`).
