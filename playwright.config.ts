// Playwright E2E (T10 Katman 3) — 3 demo-kritik akış + erişilebilirlik smoke paketi (Ray D).
// ⚠️ Akış testleri UYGULAMAYA YAZAR (vaka/talep oluşturur) → ASLA prod'a karşı koşma.
// Ray B2'den beri (2026-07-16) yerel `.env` zaten Neon DEVELOPMENT branch'inde → normal
// `npm run dev` sunucusu E2E için güvenlidir (eski TEST_DATABASE_URL reçetesi de çalışır;
// bkz. tests/e2e/README.md). erisilebilirlik.e2e.ts salt-okurdur (giriş yok, veri yazmaz).
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts", // vitest'in *.test.ts'siyle çakışmaz
  fullyParallel: false, // demo verisi paylaşılır → seri güvenli
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // WebRTC/video akışları: getUserMedia otomatik izin + sahte cihaz (izin diyaloğunda asılmaz).
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
