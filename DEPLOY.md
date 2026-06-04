# Vercel'e Deploy Kılavuzu

Bu uygulama **Vercel** (Next.js) + **Postgres** (Neon veya Vercel Postgres) ile canlıya alınır.
Yerel geliştirme SQLite kullanır; **üretimde Postgres zorunludur** (Vercel'in dosya sistemi
geçicidir, SQLite kalıcı olmaz).

## ✅ Tamamlanan (Adım 1-2)

- Neon Postgres veritabanı bağlandı; şema `postgresql`'e geçirildi (`prisma db push`)
- Tablolar oluşturuldu + demo veri yüklendi (4 kullanıcı, 8 doktor, vakalar, takip, şikayet)
- `.env`: `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) + `SESSION_SECRET` ayarlı (yerelde çalışıyor)
- Repo deploy'a hazır: build'de `prisma generate`, Linux engine, git başlatıldı

## ⏳ Kalan (Adım 3-4 — senin hesabın)

1. **GitHub**: repo oluştur → `git push` (Adım 3)
2. **Vercel**: import → env değişkenleri (`DATABASE_URL` + `SESSION_SECRET`) → Deploy (Adım 4)

> Veritabanı zaten kurulu olduğundan üretimde ayrıca migration/seed gerekmez — aynı Neon DB'sini kullanır.

---

## Adım 1 — Postgres veritabanı oluştur (ücretsiz)

**Seçenek A — Neon (önerilen):**
1. https://neon.tech → ücretsiz hesap → yeni proje
2. Connection string'i kopyala (şuna benzer):
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

**Seçenek B — Vercel Postgres:** Vercel projesini oluşturduktan sonra Storage sekmesinden
ekleyebilirsin; `DATABASE_URL` env değişkenini otomatik bağlar (Adım 4'e geç).

---

## Adım 2 — Şemayı Postgres'e çevir

`prisma/schema.prisma` içinde datasource sağlayıcısını değiştir:

```prisma
datasource db {
  provider = "postgresql"   // önceki: "sqlite"
  url      = env("DATABASE_URL")
}
```

SQLite migration'ları Postgres'te geçerli değildir; sıfırdan üret:

```bash
# Eski (SQLite) migration'ları temizle
rm -rf prisma/migrations          # Windows PS: Remove-Item -Recurse -Force prisma/migrations

# .env içine Neon URL'ini yaz, sonra:
npx prisma migrate dev --name init   # Postgres'e tabloları kurar
npm run db:seed                      # 4 kullanıcı + 8 doktor + demo veri
```

> Yerel geliştirmeye SQLite ile devam etmek istersen: bu değişikliği yapma, sadece deploy
> sırasında geçici olarak uygula. En temiz yol Neon'u hem yerelde hem üretimde kullanmaktır.

---

## Adım 3 — GitHub'a gönder

```bash
git add -A
git commit -m "deploy: postgres + vercel hazırlığı"
# GitHub'da boş bir repo oluştur, sonra:
git remote add origin https://github.com/KULLANICI/telehealth-mvp.git
git branch -M main
git push -u origin main
```

---

## Adım 4 — Vercel'e import et

1. https://vercel.com → **Add New → Project** → GitHub repo'yu seç
2. Framework otomatik **Next.js** algılanır (ayar gerekmez)
3. **Environment Variables** ekle:
   | Anahtar | Değer |
   |---------|-------|
   | `DATABASE_URL` | Neon connection string (Adım 1) |
   | `SESSION_SECRET` | rastgele uzun değer — `openssl rand -base64 32` |
4. **Deploy**

Build sırasında `prisma generate` otomatik çalışır (package.json `build` + `postinstall`).

---

## Adım 5 — Üretim veritabanını hazırla

İlk deploy'dan sonra tabloları ve demo veriyi üretim DB'sine uygula. Yerelden, üretim
URL'iyle tek seferlik:

```bash
# PowerShell
$env:DATABASE_URL="<neon-uretim-url>"; npx prisma migrate deploy
$env:DATABASE_URL="<neon-uretim-url>"; npm run db:seed
```

> Alternatif: Vercel "Build Command"ını `prisma migrate deploy && prisma generate && next build`
> yaparak migration'ı her deploy'da otomatik uygulayabilirsin (seed'i yine bir kez elle çalıştır).

---

## Doğrulama

- Canlı URL'de `/giris` → demo girişleri (parola `1234`): `hasta@` · `doktor@` · `koordinator@` · `kurul@air.test`
- `/` ana sayfa, `/triyaj`, `/doktor`, `/etik-kurul` rol bazlı erişim

## Güvenlik notları (demo)

- Bu bir **demo** sürümüdür: hızlı rol girişi açık, parolalar `1234`. Gerçek kullanımdan önce
  bunları kaldırın, güçlü parola politikası + e-posta doğrulama ekleyin.
- `SESSION_SECRET` üretimde mutlaka güçlü ve gizli olmalı.
- KVKK/GDPR: gerçek hasta verisi işlemeden önce veri işleme sözleşmeleri ve uygun bölge
  (AB/TR) seçimi gerekir (bkz. vault `wiki/platform-mimarisi.md`).
