# Entegrasyon Testleri — Neon Dev Branch Kurulumu

Entegrasyon testleri (Katman 2) **gerçek bir veritabanına yazar**. Yerel `.env`
**üretim Neon**'a bağlı olduğundan ([[live-verify-hits-prod-neon]]), bu testler **asla**
prod'a karşı çalıştırılmaz. Bunun yerine ayrı bir **Neon dev branch** kullanılır.

## Neden ayrı branch?

Birim testleri (Katman 1, `tests/unit/`) DB'ye hiç dokunmaz → her zaman güvenli, `npm test`.
Entegrasyon testleri vaka/kullanıcı satırları oluşturup siler → prod veriyi kirletir/bozar.
Neon'un **branching** özelliği prod şemasının izole, yazılabilir bir kopyasını verir.

## Kurulum (senin Neon console'unda — tek seferlik)

1. https://console.neon.tech → ilgili proje → **Branches** sekmesi.
2. **Create branch** → ana (prod) branch'ten türet → ad: `test` (veya `dev`).
   - Şema + veri kopyalanır; prod'dan tamamen izoledir.
3. Yeni branch'in **connection string**'ini kopyala (pooled connection, `?sslmode=require`).
4. Bu makinede ortam değişkeni olarak ver (yerel `.env`'e EKLEME — prod URL'iyle karışmasın):

   ```powershell
   # PowerShell (oturum boyunca)
   $env:TEST_DATABASE_URL = "postgres://...&sslmode=require"
   npm run test:integration
   ```

   ```bash
   # Bash
   TEST_DATABASE_URL="postgres://...&sslmode=require" npm run test:integration
   ```

5. Şema dev branch'te güncel değilse: `DATABASE_URL` + `DIRECT_URL` **birlikte**
   `TEST_DATABASE_URL` değerine set'liyken `npx prisma migrate deploy` (dev branch'e uygular;
   prod'a değil — tek değişken override etmek prod `DIRECT_URL`'e gider, dikkat).
   Dev branch migration geçmişine sahiptir (2026-07-03 baseline resolve edilmiş); hızlı yerel
   deneme için `db push` dev branch'te hâlâ kabul edilebilir ama üretimde yasak (`DEPLOY.md`).

## Çalıştırma

```bash
npm test                  # yalnız birim (DB yok) — her zaman güvenli
npm run test:integration  # entegrasyon — TEST_DATABASE_URL şart; yoksa süitler ATLANIR
```

`TEST_DATABASE_URL` tanımlı değilken `test:integration` çalıştırmak **hata vermez**:
süitler `describe.skipIf` ile atlanır (yeşil kalır). Böylece CI/yerel akış, dev branch
olmadan da kırılmaz.

## ⚠️ Güvenlik

- `TEST_DATABASE_URL`'i `.env`'e **yazma** — yanlışlıkla prod yerine geçebilir.
- Dev branch'i periyodik olarak prod'dan **yeniden türet** (şema kayması olmasın).
- Bu testler veri yazar → **yalnız** dev branch'e bağlıyken çalıştır.
