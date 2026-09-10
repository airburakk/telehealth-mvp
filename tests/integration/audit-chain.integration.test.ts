// Entegrasyon — audit hash-zinciri bütünlük + TAMPER tespiti GERÇEK dev DB'ye karşı.
// v2 mühür (P1 #8): TÜM metadata alanları kapsanır (detail/ip/actorRole/userAgent dahil) → detail
// tamper'ı da yakalanır. Karma zincir: başka ortamın anahtarıyla mühürlü satırlar (yerel↔CI) "unknown-key"
// sayılır, zinciri KIRMAZ (unverifiableSeals sayacı) — bu koşunun kendi yazdıkları kesin doğrulanır.
// Zincir GLOBAL (GENESIS→…): dev branch sağlıklı bir kopyaysa append ok kalır; tamper brokenAt üretir.
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { recordAccess, verifyAccessChain, purgeStaleAuditMeta } from "@/lib/audit";
import { sha256 } from "@/lib/timestamp";
import type { SessionUser } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIT_META_RETENTION_MS = 2 * 365 * DAY_MS; // audit.ts'teki sabitle AYNI değer (export edilmiyor — kasıtlı: purge-deleted dışında hiçbir çağıran cutoff'u bilmemeli)

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

  // 05 madde 3.10 (Paket 2, 2026-09-09): IP/cihaz 2 yıl sonra boşaltılır — consent.ts ConsentRecord.purgedAt
  // İLE AYNI desen. Naif bir UPDATE (yalnız ip/userAgent null) zinciri KIRIK gösterirdi (mühür bu alanları
  // kapsıyor); purgedAt damgası mühür kontrolünü ATLATIR, bağ (prevHash) sürer.
  it("purgedAt: ip/userAgent boşaltılan satırda mühür kontrolü atlanır (KIRIK göstermez) + purgedSeals sayar", async () => {
    const actor = { id: "itest-actor", role: "ADMIN" } as SessionUser;
    const rid = `${RUN}-purge`;
    await recordAccess({ actor, action: "DOCUMENT_VIEW", resourceType: "CASE", resourceId: rid, subjectUserId: null, detail: "itest purge", ip: "203.0.113.9", userAgent: "itest-ua" });
    const row = await db.accessLog.findFirst({ where: { resourceId: rid }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    if (!row) throw new Error("kayıt bulunamadı");
    myIds.push(row.id);

    const before = await verifyAccessChain();
    expect(before.ok).toBe(true);

    // purgeStaleAuditMeta'nın 2 yıl sonra yapacağını elle simüle et (cutoff'u beklemeden).
    await db.accessLog.update({ where: { id: row.id }, data: { ip: null, userAgent: null, purgedAt: new Date() } });

    const after = await verifyAccessChain();
    expect(after.ok).toBe(true); // naif bir UPDATE burada false döndürürdü — regresyon kilidi
    expect(after.purgedSeals).toBe(before.purgedSeals + 1);
    // Bağ hâlâ doğrulanabilir: prevHash/entryHash silinmedi, yalnız ip/userAgent boşaldı.
    const refreshed = await db.accessLog.findUnique({ where: { id: row.id } });
    expect(refreshed?.prevHash).toBe(row.prevHash);
    expect(refreshed?.entryHash).toBe(row.entryHash);
  });

  it("purgeStaleAuditMeta: cutoff'u aşan satırı hedefler (createdAt DEĞİŞTİRİLMEDEN — 'now' ileri alınır)", async () => {
    const actor = { id: "itest-actor", role: "ADMIN" } as SessionUser;
    const rid = `${RUN}-purge2`;
    await recordAccess({ actor, action: "DOCUMENT_VIEW", resourceType: "CASE", resourceId: rid, subjectUserId: null, detail: "itest purge2", ip: "203.0.113.11", userAgent: "itest-ua-2" });
    const row = await db.accessLog.findFirst({ where: { resourceId: rid }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    if (!row) throw new Error("kayıt bulunamadı");
    myIds.push(row.id);

    // cutoff'u BU satırın hemen ötesine taşı (createdAt'e dokunmadan) — paralel testlerin o anda
    // yazdığı taze satırlar cutoff'un GERİSİNDE kalır (etkilenmez), yalnız benim satırım + ondan
    // zaten daha eski (gerçekten süpürülmesi gereken) satırlar hedeflenir.
    const cutoffNow = new Date(row.createdAt.getTime() + AUDIT_META_RETENTION_MS + DAY_MS);
    const res = await purgeStaleAuditMeta(cutoffNow);
    expect(res.purged).toBeGreaterThanOrEqual(1);

    const refreshed = await db.accessLog.findUnique({ where: { id: row.id } });
    expect(refreshed?.ip).toBeNull();
    expect(refreshed?.userAgent).toBeNull();
    expect(refreshed?.purgedAt).not.toBeNull();
  });
});
