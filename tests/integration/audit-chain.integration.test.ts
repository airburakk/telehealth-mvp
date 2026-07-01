// Entegrasyon — audit hash-zinciri bütünlük + TAMPER tespiti GERÇEK dev DB'ye karşı.
// NOT: computeEntryHash `detail`'i İÇERMEZ → tamper testi hash'e giren bir alanı (action) değiştirir.
// Zincir GLOBAL (GENESIS→…): dev branch sağlıklı bir kopyaysa append ok kalır; tamper brokenAt üretir.
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { recordAccess, verifyAccessChain } from "@/lib/audit";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const RUN = `itest-audit-${Date.now()}`; // bu koşuya özel resourceId prefix'i (yalnız kendi satırlarımı temizlerim)

describe.skipIf(!TEST_DB)("entegrasyon: audit zinciri bütünlük + tamper (gerçek dev DB)", () => {
  const myIds: string[] = [];
  afterAll(async () => {
    // Kendi eklediğim satırları (zincirin ucundaki) sil → zincir tamper öncesi haline döner.
    if (myIds.length) await db.accessLog.deleteMany({ where: { id: { in: myIds } } });
  });

  it("geçerli append → ok korunur; hash'e giren alan tamper'ı → ok:false + brokenAt", async () => {
    const before = await verifyAccessChain();

    // 3 geçerli kayıt ekle (mühürlü, ardışık).
    const actor = { id: "itest-actor", role: "ADMIN" } as SessionUser;
    for (let i = 0; i < 3; i++) {
      await recordAccess({ actor, action: "DOCUMENT_VIEW", resourceType: "CASE", resourceId: `${RUN}-${i}`, subjectUserId: null, detail: `itest ${i}`, ip: null, userAgent: null });
    }
    const mine = await db.accessLog.findMany({ where: { resourceId: { startsWith: RUN } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    mine.forEach((m) => myIds.push(m.id));
    expect(mine.length).toBe(3);

    // Geçerli append sonrası zincir hâlâ tutarlı (dev branch sağlıklıysa ok:true).
    const afterAppend = await verifyAccessChain();
    expect(afterAppend.ok).toBe(true);
    expect(afterAppend.count).toBe(before.count + 3);

    // TAMPER: son kaydın `action`'ını değiştir (hash'e girer) → mühür artık tutmaz.
    const victim = mine[mine.length - 1];
    await db.accessLog.update({ where: { id: victim.id }, data: { action: "TAMPERED" } });
    const broken = await verifyAccessChain();
    expect(broken.ok).toBe(false);
    expect(broken.brokenAt).toBe(victim.id); // ilk kırık = benim tamper'ladığım kayıt (baseline sağlıklıydı)
  });
});
