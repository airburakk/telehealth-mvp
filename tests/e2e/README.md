# E2E Testleri (Playwright — T10 Katman 3)

3 demo-kritik akış tarayıcıda uçtan uca doğrulanır:
- `triyaj-kokpit-video.e2e.ts` — hasta triyaj → vaka → doktor kokpit → görüşme odası
- `ikinci-gorus.e2e.ts` — İkinci Görüş başvuru → hasta listesi → koordinatör kuyruğu
- `partner-konsultasyon.e2e.ts` — partner talep → **de-id** → doktor havuzu (isim SIZMAZ)

## ⚠️ Prod'a ASLA çalıştırma

E2E uygulamaya **yazar** (vaka/talep oluşturur). Yerel `.env` **üretim Neon**'a bağlıdır → E2E
yalnız **dev branch'e bağlı bir sunucuya** karşı koşulmalıdır.

## Çalıştırma

```powershell
# 1) Dev sunucusunu DEV BRANCH'e bağlı başlat (ayrı terminal):
$env:DATABASE_URL = $env:TEST_DATABASE_URL   # Neon dev branch (bkz. tests/integration/README.md)
npm run dev                                   # http://localhost:3000

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
