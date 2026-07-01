// Entegrasyon — dev branch bağlantı sağlık kontrolü (smoke). Asıl yetki/audit testleri:
//   cases-authz.integration.test.ts · ai-idor.integration.test.ts · audit-chain.integration.test.ts
// setup.ts DATABASE_URL'i dev branch'e yönlendirir → paylaşılan `db` dev branch'e bağlanır (prod'a DEĞİL).
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("entegrasyon: dev branch bağlantısı (smoke)", () => {
  it("paylaşılan db dev branch'e bağlanır ve sorgu çalıştırır", async () => {
    const n = await db.user.count();
    expect(n).toBeGreaterThanOrEqual(0);
  });
});
