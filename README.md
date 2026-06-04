# AIR Telehealth — MVP

**🚀 Canlı demo: https://telehealth-mvp-roan.vercel.app** · Demo girişi: `doktor@air.test` / `1234`

Sağlık turizmi platformunun ilk çalışan sürümü (Faz 1). Hasta triyajından doktor
vaka paneline ve video görüşmeye uzanan uçtan uca akışı gösterir.

> Bilgi tabanı (Obsidian vault) `../Air` klasöründedir. Mimari için bkz.
> `Air/output/yazilim-mimarisi.md` ve `Air/wiki/moduller/`.

## Kapsam (bu sürümde çalışan)

| Modül | Durum |
|-------|-------|
| **1. Triyaj** | ✅ Çok adımlı sihirbaz, kural tabanlı AI branş + aciliyet (1-5) |
| **2. Doktor Paneli + Video** | ✅ Vaka kuyruğu, kokpit detay, asimetrik video + not paneli |
| **3. Sağlık Turizmi** | ✅ Tier'lı paket, dinamik fiyat, sigorta, Escrow + split + hasta yolculuğu |
| **4. Post-Op Takip** | ✅ Günlük kontrol, kırmızı bayrak, branş protokolü, doktor izleme |
| **5. Doktor Adaptasyon** | ✅ İtibar, hakediş, kapasite, müsaitlik paneli |
| **6. Doktor Tanıtım** | ✅ Hekim dizini + doğrulanmış profil, yorumlar, akreditasyon |
| **7. Etik Kurul** | ✅ Şikayet, anonim inceleme, karar/yaptırım, Escrow iade |
| **Kimlik doğrulama** | ✅ Roller (hasta/doktor/koordinatör/kurul), bcrypt + JWT + middleware |

## Teknoloji

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**, **lucide-react** ikonlar
- **Prisma 6 + SQLite** (yerel `prisma/dev.db`)

## Çalıştırma

```bash
npm install
npx prisma migrate dev      # şema + dev.db (ilk kez)
npx tsx prisma/seed.ts      # 4 kullanıcı + 8 doktor + 5 vaka + takip + şikayet
npm run dev                 # http://localhost:3000
```

## Roller & Giriş

Uygulama kimlik doğrulama gerektirir (`/giris`). Demo kullanıcıları (parola `1234`):

| Rol | E-posta | Erişim |
|-----|---------|--------|
| Hasta | `hasta@air.test` | Triyaj, paket, takip, şikayet |
| Doktor | `doktor@air.test` | Doktor paneli, video, Post-Op |
| Koordinatör | `koordinator@air.test` | Doktor alanı |
| Etik Kurul | `kurul@air.test` | Etik Kurul paneli |

Rol bazlı erişim `src/middleware.ts` ile zorlanır. Oturum: imzalı JWT (jose) httpOnly cookie; parolalar bcrypt ile hash'lenir. `.env` içinde `SESSION_SECRET` tanımlı olmalıdır.

Veriyi sıfırlayıp yeniden doldurmak için tekrar `npx tsx prisma/seed.ts`.

## Rotalar

| Rota | Açıklama |
|------|----------|
| `/` | Giriş sayfası — tanıtım + rol kartları |
| `/giris` | Kimlik doğrulama (hızlı demo girişi) |
| `/triyaj` · `/triyaj/[id]` | Hasta triyaj sihirbazı + onay |
| `/doktor` · `/doktor/vaka/[id]` | Doktor paneli + vaka kokpiti |
| `/gorusme/[id]` | Video görüşme odası (asimetrik) |
| `/paket/[caseId]` · `/rezervasyon/[id]` | Sağlık turizmi paketi + Escrow rezervasyon |
| `/takip/[caseId]` · `/doktor/takip` | Post-op takip + doktor izleme |
| `/hekimler` · `/hekim/[id]` · `/doktor/profil` | Hekim dizini, profil, doktor paneli |
| `/sikayet/[caseId]` · `/etik-kurul` · `/etik-kurul/[id]` | Etik Kurul başvuru + karar |

### API (route handlers)

| Endpoint | İşlev |
|----------|-------|
| `POST /api/triage/analyze` | Semptom → branş/aciliyet önizleme |
| `GET/POST /api/cases` | Vaka listele / oluştur |
| `GET /api/cases/[id]` | Vaka detayı |
| `POST /api/cases/[id]/consult` | Görüşme başlat (doktor ata) |
| `PATCH /api/consultations/[id]` | Not kaydet / görüşmeyi bitir |

## Proje yapısı

```
src/
  app/
    page.tsx                 # giriş
    triyaj/                  # hasta triyaj akışı
    doktor/                  # doktor paneli + vaka detayı
    gorusme/[id]/            # video görüşme
    api/                     # route handlers
  components/                # Header, CaseQueue, ConsultationRoom, StartConsultButton
  lib/
    db.ts                    # Prisma singleton
    triage.ts                # kural tabanlı triyaj motoru (AI stub)
    constants.ts             # ülke/dil/durum/aciliyet sabitleri
prisma/
  schema.prisma             # Doctor, Case, Consultation
  seed.ts                   # demo veri
```

## Triyaj Motoru (AI stub)

`src/lib/triage.ts` içindeki `analyzeTriage()` semptom metnini anahtar kelimelerle
eşleştirip branş, 1-5 aciliyet skoru, güven yüzdesi ve gerekçe üretir. Kırmızı bayrak
kelimeleri (nefes darlığı, göğüs ağrısı, kanama…) aciliyeti 5'e çıkarır.

> Bu fonksiyon ileride **AI Orchestration Gateway** (LLM/NLP) ile değiştirilecek —
> mimaride tanımlı arayüz aynı kalır.

## Sonraki adımlar

- Vaka koordinatörü onay kuyruğu (aciliyet ≥4)
- Branşa özel dinamik triyaj formları
- WebRTC gerçek görüşme altyapısı (şu an self-view + iskelet)
- Kimlik doğrulama + rol bazlı erişim (şu an demo, auth yok)
- Modül 3: Sağlık turizmi paketi + Escrow
