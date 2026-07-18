// Entegrasyon — hesap silme (deleteAccount) + fiziksel imha (purgeExpired) MEKANİZMASI gerçek dev DB'de
// (denetim 2026-07-18 #14). Bugüne dek yalnız kilidin downstream ETKİSİ test ediliyordu (ownership);
// geri dönüşü olmayan silme/imha akışının kendisi buradaki nöbete bağlanır:
//   A) deleteAccount: tombstone + kişisel alan boşaltma + sessionVersion++ + klinik kilit + idempotency
//   B) purgeExpired: purgeAfter dolmuş vaka (Recovery→CheckIn zinciri DAHİL — FK Restrict fix'i #8)
//      imha edilir; dolmamış korunur; klinik kaydı duran silinmiş hesabın KABUĞU korunur.
//
// ⚠️ ZİNCİR GÜVENLİĞİ: test kullanıcılarına ASLA recordConsent yazılmaz. purgeExpired kabuk imhasında
// ConsentRecord'u FİZİKEN siler; o kayıtlar onam zincirinin ortasındaysa zincir KALICI kırılır
// (append-only prevHash bağı). Aynı nedenle deleteAccount'un yazdığı audit satırlarına da cleanup'ta
// DOKUNULMAZ (audit zinciri append-only — satır silmek zinciri kırar; kalması zararsız).
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { deleteAccount, purgeExpired, purgeDateFrom, RETENTION_YEARS } from "@/lib/account-deletion";
import type { SessionUser } from "@/lib/session";

const TEST_DB = process.env.TEST_DATABASE_URL;
const RUN = `itest-del-${Date.now()}`;

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

// Dev DB'de "consent'li + klinik kaydı olmayan + silinmiş" YABANCI kabuk varsa purgeExpired onların
// ConsentRecord'unu siler → onam zinciri kalıcı kırılır. Böyle kirlilik varsa bu koşuda purge testini
// atlamak zinciri korur (kabuğun kendisi purge'un normal işi; sorun yalnız consent satırlarıdır).
async function chainBreakingShellExists(): Promise<boolean> {
  const shells = await db.user.findMany({ where: { deletedAt: { not: null } }, select: { id: true } });
  for (const s of shells) {
    const [c, so, cr] = await Promise.all([
      db.case.count({ where: { userId: s.id } }),
      db.secondOpinionCase.count({ where: { patientId: s.id } }),
      db.consentRecord.count({ where: { userId: s.id } }),
    ]);
    if (c === 0 && so === 0 && cr > 0) return true;
  }
  return false;
}

describe.skipIf(!TEST_DB)("entegrasyon: hesap silme + fiziksel imha (gerçek dev DB)", () => {
  const userIds: string[] = [];
  const caseIds: string[] = [];

  afterAll(async () => {
    // Kalan her şey id ile silinir (purge'un sildiği zaten yok). FK sırası: CheckIn→Recovery→Case→User.
    await db.checkIn.deleteMany({ where: { recovery: { caseId: { in: caseIds } } } });
    await db.recovery.deleteMany({ where: { caseId: { in: caseIds } } });
    await db.case.deleteMany({ where: { id: { in: caseIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
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

  it("purgeExpired: dolmuş vaka (CheckIn'li) imha + dolmamış korunur + klinik kaydı duran kabuk korunur", async () => {
    if (await chainBreakingShellExists()) {
      console.warn("[itest] dev DB'de consent'li klinik-kayıtsız silinmiş kabuk var — purge testi zincir güvenliği için atlandı.");
      return;
    }

    // u1: vakası DOLMUŞ (backdate) + Recovery→CheckIn zincirli → imha edilmeli (FK fix #8 kanıtı).
    // u2: vakası DOLMAMIŞ → korunmalı; kabuğu da (klinik kayıt durduğu için) korunmalı.
    const u1 = await mkPatient("p1");
    const u2 = await mkPatient("p2");
    userIds.push(u1.id, u2.id);
    const c1 = await mkCase(u1.id);
    const c2 = await mkCase(u2.id);
    caseIds.push(c1.id, c2.id);
    const rec = await db.recovery.create({ data: { caseId: c1.id, branch: "Kardiyoloji" } });
    await db.checkIn.create({ data: { recoveryId: rec.id, pain: 8, feverC: 38.6, severity: "RED" } });

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

    // u2: purgeAfter dolmadı → vaka da kabuk da DURUYOR (kabuk-koruma kapısı).
    expect(await db.case.findUnique({ where: { id: c2.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: u2.id } })).not.toBeNull();
  });
});
