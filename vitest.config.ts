// Vitest — BİRİM (unit) katmanı yapılandırması (T10 test piramidi tabanı).
// Yalnız saf-mantık testleri (DB YOK → prod riski sıfır): pricing, journey, deidentify, crypto,
// ownership/authz, rate-limit, postop-access. Entegrasyon testleri ayrı config'tedir
// (vitest.integration.config.ts — Neon dev branch gerektirir).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // tsconfig "@/*" → "./src/*" alias'ının vitest karşılığı.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node", // DOM gerekmez (saf mantık)
    include: ["tests/unit/**/*.test.ts"],
    globals: false, // describe/it/expect explicit import edilir
  },
});
