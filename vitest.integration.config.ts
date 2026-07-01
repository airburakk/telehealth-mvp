// Vitest — ENTEGRASYON katmanı yapılandırması (T10 piramidin 2. katmanı).
// ⚠️ Bu testler GERÇEK bir veritabanına yazar. Yerel `.env` ÜRETİM Neon'a bağlıdır → bu süit
// ASLA prod'a karşı çalıştırılmamalıdır. Bunun yerine ayrı bir **Neon dev branch** connection
// string'i `TEST_DATABASE_URL` ile verilir (bkz. tests/integration/README.md).
// `TEST_DATABASE_URL` tanımsızsa süitler kendini ATLAR → komut prod'a dokunmadan yeşil kalır.
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
