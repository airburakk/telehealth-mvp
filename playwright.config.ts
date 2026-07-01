// Playwright E2E (T10 Katman 3) — 3 demo-kritik akış.
// ⚠️ Bu testler UYGULAMAYA YAZAR (vaka/talep oluşturur). Yerel `.env` ÜRETİM Neon'a bağlı olduğundan
// E2E, **dev branch'e bağlı bir sunucuya** karşı çalıştırılmalıdır (asla prod'a). Bkz. tests/e2e/README.md:
//   1) DATABASE_URL=$TEST_DATABASE_URL ile dev sunucusu başlat  2) E2E_BASE_URL ver  3) npm run test:e2e
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
