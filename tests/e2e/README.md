# E2E Testleri (Playwright — T10 Katman 3 + Ray D)

3 demo-kritik akış + erişilebilirlik smoke paketi tarayıcıda uçtan uca doğrulanır:
- `triyaj-kokpit-video.e2e.ts` — hasta triyaj → vaka → doktor kokpit → görüşme odası
- `ikinci-gorus.e2e.ts` — İkinci Görüş başvuru → hasta listesi → koordinatör kuyruğu
- `partner-konsultasyon.e2e.ts` — partner talep → **de-id** → doktor havuzu (isim SIZMAZ)
- `erisilebilirlik.e2e.ts` — **salt-okur** a11y smoke (Ray D): axe taraması (kritik/ciddi = düşer) ·
  tek-h1 · klavye-yalnız · reduced-motion · RTL. WCAG İDDİASI DEĞİLDİR (vault
  `wiki/yonetisim/erisilebilirlik-denetim-checklist.md`). Tek başına:
  `npx playwright test erisilebilirlik`

## ⚠️ Prod'a ASLA çalıştırma

Akış testleri uygulamaya **yazar** (vaka/talep oluşturur) → yalnız dev-branch'e bağlı sunucuya karşı
koş. **Ray B2'den beri (2026-07-16) yerel `.env` zaten Neon `development` branch'indedir** → normal
`npm run dev` yeterli; aşağıdaki `TEST_DATABASE_URL` reçetesi test-branch'e karşı koşmak istersen
hâlâ geçerli.

## Çalıştırma

```powershell
# 1) Dev sunucusunu başlat (ayrı terminal) — yerel .env zaten development branch (Ray B2):
npm run dev                                   # http://localhost:3000
# (İstersen test branch'i: $env:DATABASE_URL = $env:TEST_DATABASE_URL)

# 2) Başka terminalde E2E:
$env:E2E_BASE_URL = "http://localhost:3000"
npm run test:e2e
```

```bash
# Bash eşdeğeri
DATABASE_URL="$TEST_DATABASE_URL" npm run dev &
E2E_BASE_URL="http://localhost:3000" npm run test:e2e
```

## Notlar

- **Demo hesaplar** dev branch'te seed'lidir (parola `1234`); `loginAs(page, "Doktor")` gibi.
- **WebRTC/video**: `playwright.config.ts` sahte medya cihazı + otomatik izin verir. Gerçek 2-cihaz
  P2P el sıkışması E2E'de doğrulanmaz (kırılgan) → yalnız görüşme odasının render'ı doğrulanır.
- **AI çağrıları** (triyaj/SOAP) canlı Claude'a gider → yavaş olabilir; `ANTHROPIC_API_KEY` yoksa
  triyaj kural-tabanlı fallback'e düşer (akış yine çalışır).
- Testler oluşturdukları demo kayıtları bırakabilir (dev branch); periyodik `npm run db:seed`
  (dev branch'e) ile sıfırlanır.
