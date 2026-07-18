// Entegrasyon — hesap silme (deleteAccount) + fiziksel imha (purgeExpired) MEKANİZMASI gerçek dev DB'de
// (denetim 2026-07-18 #14). Bugüne dek yalnız kilidin downstream ETKİSİ test ediliyordu (ownership);
// geri dönüşü olmayan silme/imha akışının kendisi buradaki nöbete bağlanır:
//   A) deleteAccount: tombstone + kişisel alan boşaltma + sessionVersion++ + klinik kilit + idempotency
//   B) purgeExpired: purgeAfter dolmuş vaka (Recovery→CheckIn zinciri DAHİL — FK Restrict fix'i #8)
//      imha edilir; dolmamış korunur; klinik kaydı duran silinmiş hesabın KABUĞU korunur.
//
// ZİNCİR GÜVENLİĞİ (bağ-koruyan imha, 2026-07-18): purgeExpired artık ConsentRecord SİLMEZ —
// kişisel alanları boşaltır + purgedAt damgalar (satır zincir halkası olarak kalır). Bu test bunu
// BİLEREK onam yazarak kanıtlar: purge sonrası zincir ok kalmalı. deleteAccount'un yazdığı audit
// satırlarına cleanup'ta DOKUNULMAZ (audit zinciri append-only — satır silmek zinciri kırar).
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { deleteAccount, purgeExpired, purgeDateFrom, RETENTION_YEARS } from "@/lib/account-deletion";
import { recordConsent, verifyConsentChain } from "@/lib/consent";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const RUN = `itest-del-${Date.now()}`;
const SCOPE = `ITEST_DEL_${Date.now()}`; // gerçek GENERAL_KVKK kovasına karışma

const mkPatient = (tag: string) =>
  db.user.create({
    data: {
      email: `${RUN}-${tag}@itest.local`, passwordHash: "itest-nohash",
      name: `Silme Testi ${tag}`, role: "PATIENT",
      patientCountry: "TR", patientLanguage: "Türkçe", patientPhone: "enc:itest", patientContactPref: "APP",
    },
  });

const mkCase = (userId: string) =>
  db.case.create({
    data: {
      userId, patientName: `Test Hasta ${RUN}`, country: "TR", language: "Türkçe",
      symptoms: "itest şikâyet", branch: "Kardiyoloji", urgency: 3, reasoning: "itest gerekçe",
    },
  });

describe.skipIf(!TEST_DB)("entegrasyon: hesap silme + fiziksel imha (gerçek dev DB)", () => {
  const userIds: string[] = [];
  const caseIds: string[] = [];

  afterAll(async () => {
    // Kalan her şey id ile silinir (purge'un sildiği zaten yok). FK sırası: CheckIn→Recovery→Case→User.
    await db.checkIn.deleteMany({ where: { recovery: { caseId: { in: caseIds } } } });
    await db.recovery.deleteMany({ where: { caseId: { in: caseIds } } });
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    // Purged onam stub'ları: YALNIZ zincirin ucundaysa silinir (audit testi deseni) — ortadaysa
    // silmek zinciri kırar, bırakılır (anonim halka, zararsız).
    const mine = await db.consentRecord.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    if (mine.length) {
      const tip = await db.consentRecord.findFirst({
        where: { entryHash: { not: null } },
        orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (tip && mine.some((m) => m.id === tip.id)) {
        await db.consentRecord.deleteMany({ where: { id: { in: mine.map((m) => m.id) } } });
      }
    }
  });

  it("deleteAccount: tombstone + kişisel alanlar boşalır + sessionVersion artar + klinik kilit + idempotent", async () => {
    const u = await mkPatient("a");
    userIds.push(u.id);
    const c1 = await mkCase(u.id);
    const c2 = await mkCase(u.id);
    caseIds.push(c1.id, c2.id);

    const t0 = new Date();
    const actor = { id: u.id, role: "PATIENT" } as SessionUser;
    const r = await deleteAccount(actor, "203.0.113.7", "itest-agent");
    expect(r.ok).toBe(true);
    expect(r.alreadyDeleted).toBeUndefined();
    expect(r.lockedCases).toBe(2);
    expect(r.lockedSoCases).toBe(0);

    // Kişisel katman GERÇEKTEN gitti: tombstone e-posta + ad + parola çöpe + profil alanları null.
    const after = await db.user.findUnique({ where: { id: u.id } });
    expect(after).not.toBeNull();
    expect(after!.deletedAt).not.toBeNull();
    expect(after!.email).toBe(`deleted-${u.id}@deleted.invalid`);
    expect(after!.name).toBe("Silinmiş kullanıcı");
    expect(after!.passwordHash.startsWith("deleted:")).toBe(true);
    expect(after!.patientCountry).toBeNull();
    expect(after!.patientPhone).toBeNull();
    expect(after!.sessionVersion).toBe(u.sessionVersion + 1); // dolaşımdaki tüm JWT'ler düşer

    // Klinik katman: kilit + imha tarihi (silme anı + RETENTION_YEARS).
    for (const cid of [c1.id, c2.id]) {
      const cc = await db.case.findUnique({ where: { id: cid }, select: { deletionLockedAt: true, purgeAfter: true } });
      expect(cc!.deletionLockedAt).not.toBeNull();
      expect(cc!.purgeAfter!.getFullYear()).toBe(purgeDateFrom(t0).getFullYear());
      expect(cc!.purgeAfter!.getFullYear() - t0.getFullYear()).toBe(RETENTION_YEARS);
    }

    // İdempotency: ikinci çağrı no-op (çift tıklama / yeniden deneme güvenli) — kilit damgası değişmez.
    const lockedAt = (await db.case.findUnique({ where: { id: c1.id }, select: { deletionLockedAt: true } }))!.deletionLockedAt;
    const again = await deleteAccount(actor);
    expect(again).toEqual({ ok: true, alreadyDeleted: true, lockedCases: 0, lockedSoCases: 0 });
    const lockedAt2 = (await db.case.findUnique({ where: { id: c1.id }, select: { deletionLockedAt: true } }))!.deletionLockedAt;
    expect(lockedAt2!.getTime()).toBe(lockedAt!.getTime());
  });

  it("purgeExpired: dolmuş vaka (CheckIn'li) imha + dolmamış korunur + kabuk korunur + ONAM ZİNCİRİ KIRILMAZ", async () => {
    // u1: vakası DOLMUŞ (backdate) + Recovery→CheckIn zincirli → imha edilmeli (FK fix #8 kanıtı)
    //     + ONAMLI → kabuk purge'unda bağ-koruyan boşaltma kanıtı (satır kalır, kişisel alanlar gider).
    // u2: vakası DOLMAMIŞ → korunmalı; kabuğu da (klinik kayıt durduğu için) korunmalı.
    const u1 = await mkPatient("p1");
    const u2 = await mkPatient("p2");
    userIds.push(u1.id, u2.id);
    const c1 = await mkCase(u1.id);
    const c2 = await mkCase(u2.id);
    caseIds.push(c1.id, c2.id);
    const rec = await db.recovery.create({ data: { caseId: c1.id, branch: "Kardiyoloji" } });
    await db.checkIn.create({ data: { recoveryId: rec.id, pain: 8, feverC: 38.6, severity: "RED" } });
    await recordConsent(u1.id, "203.0.113.9", "itest-agent", { scope: SCOPE, version: 1, text: "itest silme onam metni" });

    const chainBefore = await verifyConsentChain();
    expect(chainBefore.ok).toBe(true); // zemin sağlıklı olmalı ki purge-sonrası iddia anlamlı olsun

    await deleteAccount({ id: u1.id, role: "PATIENT" } as SessionUser);
    await deleteAccount({ id: u2.id, role: "PATIENT" } as SessionUser);
    // u1'in vakasının saklama süresi DOLMUŞ olsun (testte backdate — üretimde 20 yıl sonra cron bulur).
    await db.case.update({ where: { id: c1.id }, data: { purgeAfter: new Date(Date.now() - 60_000) } });

    const r = await purgeExpired();
    expect(r.failed).toBe(0); // CheckIn'li vaka FK Restrict'e TAKILMADAN imha edildi (#8 fix'i)
    expect(r.purgedCases).toBeGreaterThanOrEqual(1);

    // u1: vaka + Recovery + CheckIn fiziken gitti; klinik kaydı kalmayan kabuk da gitti.
    expect(await db.case.findUnique({ where: { id: c1.id } })).toBeNull();
    expect(await db.recovery.findUnique({ where: { id: rec.id } })).toBeNull();
    expect(await db.checkIn.count({ where: { recoveryId: rec.id } })).toBe(0);
    expect(await db.user.findUnique({ where: { id: u1.id } })).toBeNull();

    // BAĞ-KORUYAN BOŞALTMA: onam satırı DURUYOR, kişisel alanlar İMHA, purgedAt damgalı, mühür alanları yerinde.
    const stub = await db.consentRecord.findUnique({ where: { userId_scope_version: { userId: u1.id, scope: SCOPE, version: 1 } } });
    expect(stub).not.toBeNull();
    expect(stub!.purgedAt).not.toBeNull();
    expect(stub!.ip).toBeNull();
    expect(stub!.userAgent).toBeNull();
    expect(stub!.entryHash).not.toBeNull(); // zincir halkası korunur
    expect(stub!.textHash).not.toBeNull(); // hangi metnin onaylandığının kanıtı kişisel veri değil — kalır

    // ZİNCİR KIRILMADI: purge sonrası küresel doğrulama ok + purged sayacı görünür.
    const chainAfter = await verifyConsentChain();
    expect(chainAfter.ok).toBe(true);
    expect(chainAfter.purgedSeals).toBeGreaterThanOrEqual(1);

    // u2: purgeAfter dolmadı → vaka da kabuk da DURUYOR (kabuk-koruma kapısı).
    expect(await db.case.findUnique({ where: { id: c2.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: u2.id } })).not.toBeNull();
  });
});
