// Vitest — ENTEGRASYON katmanı yapılandırması (T10 piramidin 2. katmanı).
// ⚠️ Bu testler GERÇEK bir veritabanına yazar. `DATABASE_URL`'e ASLA güvenilmez — geçmişte
// yerel `.env` üretim Neon'una işaret etti (ortam ayrımı sonrası dev'e döndü, ama bu süit o
// varsayıma yaslanMAZ). Süit YALNIZ ayrı bir **Neon dev branch** connection string'i olan
// `TEST_DATABASE_URL` ile koşar (bkz. tests/integration/README.md).
// `TEST_DATABASE_URL` tanımsızsa süitler kendini ATLAR → komut hiçbir DB'ye dokunmadan yeşil kalır.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"], // .env yükle + DATABASE_URL → dev branch (import'lardan ÖNCE)
    globals: false,
    fileParallelism: false, // DB testleri seri çalışır (paylaşılan durum + audit zinciri)
    testTimeout: 30_000, // ağ + dev branch gecikmesi için pay
  },
});
