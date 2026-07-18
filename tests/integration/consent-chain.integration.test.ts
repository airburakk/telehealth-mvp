// Entegrasyon — ONAM hash-zinciri bütünlük + TAMPER tespiti GERÇEK dev DB'ye karşı
// (audit-chain.integration.test.ts'in birebir eşleniği — denetim 2026-07-18 #13).
// verifyConsentChain audit ile aynı kuralları taşır: bağ (prevHash) + mühür (v2 HMAC / v1 legacy)
// + yürüyüş-sırası downgrade kuralı. KVKK açık-onamın hukuki ispat zinciri: bir regresyon
// kurcalamayı sessizce "ok:true" yapmasın diye buradaki üç tamper senaryosu nöbet tutar.
// ConsentRecord.userId FK DEĞİL (düz kolon) → uydurma test userId yeterli, User satırı gerekmez.
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { recordConsent, verifyConsentChain } from "@/lib/consent";
import { sha256 } from "@/lib/timestamp";

const TEST_DB = process.env.TEST_DATABASE_URL;
const RUN = `itest-consent-${Date.now()}`; // bu koşuya özel userId (yalnız kendi satırlarımı temizlerim)
const SCOPE = `ITEST_${Date.now()}`; // gerçek GENERAL_KVKK kovasına karışma (zincir yine GLOBAL tektir)

describe.skipIf(!TEST_DB)("entegrasyon: onam zinciri bütünlük + tamper (gerçek dev DB)", () => {
  const myIds: string[] = [];
  afterAll(async () => {
    // Kendi eklediğim satırları sil → zincir koşu öncesi haline döner. GÜVENLİK: silme yalnız
    // satırlarım hâlâ zincirin UCUNDAYSA yapılır — paralel bir yazıcı araya girdiyse silmek zinciri
    // KALICI kırar (sonraki kaydın prevHash'i boşa düşer); o durumda satırlar bırakılır (zararsız).
    if (!myIds.length) return;
    const tip = await db.consentRecord.findFirst({
      where: { entryHash: { not: null } },
      orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (tip && myIds.includes(tip.id)) await db.consentRecord.deleteMany({ where: { id: { in: myIds } } });
  });

  it("geçerli append → ok korunur; alan tamper + downgrade → ok:false + brokenAt; idempotency", async () => {
    const before = await verifyConsentChain();

    // 3 geçerli onam kaydı (aynı kullanıcı, artan sürüm — mühürlü, ardışık).
    for (let v = 1; v <= 3; v++) {
      await recordConsent(RUN, "203.0.113.7", "itest-agent", { scope: SCOPE, version: v, text: `itest metin v${v}` });
    }
    const mine = await db.consentRecord.findMany({ where: { userId: RUN }, orderBy: [{ grantedAt: "asc" }, { id: "asc" }] });
    mine.forEach((m) => myIds.push(m.id));
    expect(mine.length).toBe(3);
    // Yeni yazım daima v2 mühürlü + metin hash'i dolu.
    for (const m of mine) {
      expect(m.entryHash).toMatch(/^v2:[0-9a-f]{8}:[0-9a-f]{64}$/);
      expect(m.textHash).toBe(sha256(`itest metin v${m.version}`));
    }

    // İdempotency: aynı (userId, scope, version) ikinci çağrı sessiz no-op — kayıt çoğalmaz.
    await recordConsent(RUN, "203.0.113.7", "itest-agent", { scope: SCOPE, version: 3, text: "itest metin v3" });
    expect(await db.consentRecord.count({ where: { userId: RUN } })).toBe(3);

    // Geçerli append sonrası zincir hâlâ tutarlı (dev branch sağlıklıysa ok:true).
    const afterAppend = await verifyConsentChain();
    expect(afterAppend.ok).toBe(true);
    expect(afterAppend.count).toBe(before.count + 3);

    // TAMPER 1: ortadaki kaydın `textHash`'i değiştir (onaylanan METNİ değiştirme girişimi) → v2 mühür tutmaz.
    const mid = mine[1];
    await db.consentRecord.update({ where: { id: mid.id }, data: { textHash: sha256("TAMPERED-METIN") } });
    const brokenText = await verifyConsentChain();
    expect(brokenText.ok).toBe(false);
    expect(brokenText.brokenAt).toBe(mid.id);
    await db.consentRecord.update({ where: { id: mid.id }, data: { textHash: mid.textHash } }); // geri al
    expect((await verifyConsentChain()).ok).toBe(true); // onarım sonrası tutarlı

    // TAMPER 2: DOWNGRADE — v2 satırın mührünü, alanlarından DOĞRU hesaplanmış anahtarsız v1 (legacy
    // sha256) mühürle değiştir. Mühür matematiksel "geçerli" olsa da yürüyüş-sırası kuralı
    // (zincirde v2 görüldükten sonra v1 = downgrade) yakalamalı.
    const dg = mine[1];
    const forgedV1 = sha256([
      dg.userId, dg.scope, String(dg.version), dg.textHash,
      dg.ip ?? "", dg.userAgent ?? "", dg.grantedAt.toISOString(), dg.prevHash!,
    ].join("|"));
    await db.consentRecord.update({ where: { id: dg.id }, data: { entryHash: forgedV1 } });
    const brokenDg = await verifyConsentChain();
    expect(brokenDg.ok).toBe(false);
    // İlk ihlal: ya downgrade satırın kendisi ya da (bağ v2 mührüne işaret ettiğinden) sonraki satır.
    expect([dg.id, mine[2].id]).toContain(brokenDg.brokenAt);
    await db.consentRecord.update({ where: { id: dg.id }, data: { entryHash: dg.entryHash } }); // geri al
    expect((await verifyConsentChain()).ok).toBe(true);

    // TAMPER 3: son kaydın `ip`'sini değiştir (v2 kanonik kapsamındaki metadata alanı) → mühür tutmaz.
    const victim = mine[mine.length - 1];
    await db.consentRecord.update({ where: { id: victim.id }, data: { ip: "198.51.100.99" } });
    const broken = await verifyConsentChain();
    expect(broken.ok).toBe(false);
    expect(broken.brokenAt).toBe(victim.id);
    // Geri al: afterAll cleanup'ı atlanırsa (paralel yazıcı uç-kontrolünü bozarsa) bile zincir tutarlı kalsın.
    await db.consentRecord.update({ where: { id: victim.id }, data: { ip: victim.ip } });
    expect((await verifyConsentChain()).ok).toBe(true);
  });
});
