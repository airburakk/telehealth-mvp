# Vercel'e Deploy Kılavuzu

Bu uygulama **Vercel** (Next.js) + **Neon Postgres** üzerinde **canlıda** çalışır:
**https://telehealth-mvp-roan.vercel.app** · GitHub `airburakk/telehealth-mvp` (`main`) →
Vercel otomatik deploy.

> **Durum:** kurulum tamamlandı. Şema zaten `postgresql` (`prisma/schema.prisma`); yerel ve
> üretim **aynı** Neon DB'sini kullanır (SQLite kullanılmaz). Bu belge, sıfırdan benzer bir
> kurulum yapmak veya ortam değişkenlerini yönetmek için referanstır.

## Akış (özet)

1. **Neon** Postgres veritabanı (pooled + direct connection string).
2. **`.env`** doldur (aşağıdaki tablo) → `npx prisma db push` → `npm run db:seed`.
3. **GitHub**'a push → **Vercel**'de import → env değişkenleri → Deploy (otomatik).
4. Sonraki her `git push origin main` → Vercel otomatik yeniden deploy.

---

## Adım 1 — Neon Postgres (ücretsiz)

1. https://neon.tech → ücretsiz hesap → yeni proje
2. İki connection string al:
   - **Pooled** (`-pooler` içerir) → `DATABASE_URL` (uygulama çalışma zamanı)
   - **Direct** (havuzsuz) → `DIRECT_URL` (migration / `db push`; yalnız CLI)

## Adım 2 — Şema + demo veri

Şema zaten Postgres olduğu için sağlayıcı değiştirmeye gerek yok:

```bash
npx prisma db push     # şemayı Neon'a uygula
npm run db:seed        # demo veri: kullanıcılar + 30 hekim + 20 vaka + takip + şikayet
```

> Şema additive değişiklikler genelde `prisma db push` ile uygulanır (bu repo migration
> klasörü yerine push kullanır). Üretimde migration tercih edersen `npm run db:migrate`
> (`prisma migrate deploy`).

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
| `DIRECT_URL` | ✅ | Neon **direct** connection string (migration / db push) |
| `SESSION_SECRET` | ✅ | JWT imzalama — `openssl rand -base64 32` |
| `DATA_ENCRYPTION_KEK` | ✅ | At-rest alan şifreleme KEK'i (E2EE Faz 1) — **AKTİF** (2026-06-23 üretimde set + backfill yapıldı → klinik veri artık şifreli; **silmek/değiştirmek prod'u bozar**). `openssl rand -base64 32`. **Yerel + üretim AYNI değer** (aynı Neon DB!). ⚠️ Kayıp = veri kaybı (escrow/yedek) |
| `ANTHROPIC_API_KEY` | ⛅ | Claude (triyaj/SOAP/epikriz/çeviri/vision). Yoksa triyaj kural tabanlıya düşer |
| `GEMINI_API_KEY` | ⛅ | Gemini Live tercüman. Yoksa canlı tercüme dormant |
| `METERED_API_KEY` | ⛅ | WebRTC TURN relay (cross-network video). Yoksa STUN/OpenRelay fallback |
| `METERED_DOMAIN` | ⛅ | Metered hesap alan adı (yukarıdakiyle birlikte) |
| `VAPID_PUBLIC_KEY` | ⛅ | Web Push — `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ⛅ | Web Push gizli anahtar |
| `VAPID_SUBJECT` | ⛅ | `mailto:...` |
| `TRIAGE_MODEL` | ➖ | Opsiyonel — triyaj modeli (varsayılan `claude-sonnet-4-6`) |

> ✅ zorunlu · ⛅ özellik için gerekli (yoksa fallback) · ➖ opsiyonel.
> **Yeni env eklenince Vercel'de redeploy gerekir** (boş commit ile tetiklenir). Vercel env'lerini
> panelden **kullanıcı** ekler (asistanın erişimi yok).

---

## Doğrulama

- Canlı URL'de `/giris` → demo girişleri (parola `1234`): `hasta@` · `doktor@` · `koordinator@` · `kurul@air.test`
- `/` landing · `/triyaj` · `/doktor` · `/operasyon` · `/etik-kurul` → rol bazlı erişim
- Giriş sonrası `/onam` KVKK kapısı bir kez görünür

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın, güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı; tüm API anahtarları yalnız sunucuda.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri (DPA/SCC) + uygun bölge
  (AB/TR) + AI sağlayıcı aktarım güvenceleri gerekir (bkz. vault `wiki/kavramlar/` + `wiki/platform-mimarisi.md`).
