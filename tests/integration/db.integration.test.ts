// ENTEGRASYON İSKELETİ (T10 Katman 2) — GERÇEK DB'ye karşı çalışır.
// ⚠️ Yerel `.env` ÜRETİM Neon'a bağlıdır → bu süit ASLA prod'a karşı koşmaz.
//    `TEST_DATABASE_URL` (ayrı Neon dev branch) tanımlı DEĞİLSE → süit ATLANIR (yeşil kalır).
//    Kurulum: tests/integration/README.md
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("entegrasyon: Neon dev branch + vaka erişim modeli", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // Dev branch'e ayrı client — varsayılan db (prod) ASLA kullanılmaz.
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DB! } } });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("dev branch'e bağlanır ve sorgu çalıştırır (bağlantı sağlık kontrolü)", async () => {
    const n = await prisma.user.count();
    expect(n).toBeGreaterThanOrEqual(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TODO (dev branch hazır + seed'lendikten sonra doldurulacak):
  //
  // canCaseBeAccessedBy / route handler'larını GERÇEK satırlara karşı doğrula:
  //   1. Seed: 1 hasta (P), 1 doğrulanmış hekim (D1), 1 başka hekim (D2),
  //      P'ye ait 1 vaka (doctorId=D1), 1 atanmamış vaka (doctorId=null).
  //   2. Beklenen authz matrisi (T1/T2 canlı E2E'siyle birebir):
  //        kimliksiz GET /api/cases            → 401
  //        hasta P  → kendi vakası             → 200 ; başka hasta vakası → 403
  //        hekim D1 → atanmış/atanmamış vaka   → 200
  //        hekim D2 → D1'e atanmış vaka        → 403
  //        AI rotaları çapraz-hekim            → 403
  //   3. Her testten sonra seed'i geri sar (transaction rollback veya truncate).
  //
  // Route handler'ları import edilip mock session (getCurrentUser) ile çağrılır;
  // gerçek DB dev branch'tedir → prod'a sıfır temas.
  // ─────────────────────────────────────────────────────────────────────────
});
