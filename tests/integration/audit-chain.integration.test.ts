// Entegrasyon — audit hash-zinciri bütünlük + TAMPER tespiti GERÇEK dev DB'ye karşı.
// v2 mühür (P1 #8): TÜM metadata alanları kapsanır (detail/ip/actorRole/userAgent dahil) → detail
// tamper'ı da yakalanır. Karma zincir: başka ortamın anahtarıyla mühürlü satırlar (yerel↔CI) "unknown-key"
// sayılır, zinciri KIRMAZ (unverifiableSeals sayacı) — bu koşunun kendi yazdıkları kesin doğrulanır.
// Zincir GLOBAL (GENESIS→…): dev branch sağlıklı bir kopyaysa append ok kalır; tamper brokenAt üretir.
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { recordAccess, verifyAccessChain } from "@/lib/audit";
import { sha256 } from "@/lib/timestamp";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const RUN = `itest-audit-${Date.now()}`; // bu koşuya özel resourceId prefix'i (yalnız kendi satırlarımı temizlerim)

describe.skipIf(!TEST_DB)("entegrasyon: audit zinciri bütünlük + tamper (gerçek dev DB)", () => {
  const myIds: string[] = [];
  afterAll(async () => {
    // Kendi eklediğim satırları sil → zincir koşu öncesi haline döner. GÜVENLİK: silme yalnız
    // satırlarım hâlâ zincirin UCUNDAYSA yapılır — paralel bir yazıcı araya girdiyse silmek zinciri
    // KALICI kırar (sonraki satırın prevHash'i boşa düşer); o durumda satırlar bırakılır (zararsız).
    if (!myIds.length) return;
    const tip = await db.accessLog.findFirst({
      where: { entryHash: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (tip && myIds.includes(tip.id)) await db.accessLog.deleteMany({ where: { id: { in: myIds } } });
  });

  it("geçerli append → ok korunur; action VE detail tamper'ları → ok:false + brokenAt", async () => {
    const before = await verifyAccessChain();

    // 3 geçerli kayıt ekle (mühürlü, ardışık).
    const actor = { id: "itest-actor", role: "ADMIN" } as SessionUser;
    for (let i = 0; i < 3; i++) {
      await recordAccess({ actor, action: "DOCUMENT_VIEW", resourceType: "CASE", resourceId: `${RUN}-${i}`, subjectUserId: null, detail: `itest ${i}`, ip: null, userAgent: null });
    }
    const mine = await db.accessLog.findMany({ where: { resourceId: { startsWith: RUN } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    mine.forEach((m) => myIds.push(m.id));
    expect(mine.length).toBe(3);
    // Yeni yazım daima v2 mühürlü ("v2:<kid>:<mac>").
    for (const m of mine) expect(m.entryHash).toMatch(/^v2:[0-9a-f]{8}:[0-9a-f]{64}$/);

    // Geçerli append sonrası zincir hâlâ tutarlı (dev branch sağlıklıysa ok:true).
    const afterAppend = await verifyAccessChain();
    expect(afterAppend.ok).toBe(true);
    expect(afterAppend.count).toBe(before.count + 3);

    // TAMPER 1: ortadaki kaydın `detail`'ini değiştir — v1'de YAKALANAMAZDI (hash'e girmezdi), v2'de girer.
    const mid = mine[1];
    await db.accessLog.update({ where: { id: mid.id }, data: { detail: "TAMPERED-DETAIL" } });
    const brokenDetail = await verifyAccessChain();
    expect(brokenDetail.ok).toBe(false);
    expect(brokenDetail.brokenAt).toBe(mid.id);
    await db.accessLog.update({ where: { id: mid.id }, data: { detail: mid.detail } }); // geri al
    expect((await verifyAccessChain()).ok).toBe(true); // onarım sonrası tutarlı

    // TAMPER 2: DOWNGRADE — v2 satırın mührünü, alanlarından DOĞRU hesaplanmış anahtarsız v1 (legacy
    // sha256) mühürle değiştir. Mühür matematiksel olarak "geçerli" olsa da yürüyüş-sırası kuralı
    // (zincirde v2 görüldükten sonra v1 = downgrade) yakalamalı.
    const dg = mine[1];
    const forgedV1 = sha256([
      dg.actorId ?? "", dg.action, dg.resourceType, dg.resourceId, dg.subjectUserId ?? "",
      dg.createdAt.toISOString(), dg.prevHash!,
    ].join("|"));
    await db.accessLog.update({ where: { id: dg.id }, data: { entryHash: forgedV1 } });
    const brokenDg = await verifyAccessChain();
    expect(brokenDg.ok).toBe(false);
    // İlk ihlal: ya downgrade satırın kendisi ya da (bağ v2 mührüne işaret ettiğinden) sonraki satır.
    expect([dg.id, mine[2].id]).toContain(brokenDg.brokenAt);
    await db.accessLog.update({ where: { id: dg.id }, data: { entryHash: dg.entryHash } }); // geri al
    expect((await verifyAccessChain()).ok).toBe(true);

    // TAMPER 3: son kaydın `action`'ını değiştir (v1'den beri kapsanan alan) → mühür artık tutmaz.
    const victim = mine[mine.length - 1];
    await db.accessLog.update({ where: { id: victim.id }, data: { action: "TAMPERED" } });
    const broken = await verifyAccessChain();
    expect(broken.ok).toBe(false);
    expect(broken.brokenAt).toBe(victim.id); // ilk kırık = benim tamper'ladığım kayıt (baseline sağlıklıydı)
    // Geri al: afterAll cleanup'ı atlanırsa (paralel yazıcı uç-kontrolünü bozarsa) bile zincir tutarlı kalsın.
    await db.accessLog.update({ where: { id: victim.id }, data: { action: victim.action } });
    expect((await verifyAccessChain()).ok).toBe(true);
  });
});
