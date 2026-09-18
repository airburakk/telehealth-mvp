// Entegrasyon — şema-güdümlü KEK rotasyon motoru (lib/kek-rotation) GERÇEK dev DB'de (2026-09-18, tatbikat #1 A1).
// Birim testi sahte Postgres'le SQL biçimlerini kanıtlar; burası gerçek information_schema + gerçek raw SQL +
// gerçek Prisma client'la üç şeyi kanıtlar:
//   A) Tam tarama (dry-run, SALT-OKUR) tüm base tabloları gezer, bizim satırlarımızı İKİ FARKLI tabloda
//      (Case · User.patientHealthHistory) envantersiz bulur; tekil id'si olmayan tablo yok (unrotatable boş).
//   B) apply, rowFilter ile YALNIZ bizim satırlarımızı yeni KEK'e sarar — kontrol satırı (filtre dışı) eski
//      KEK'te kalır; sarılanlar yeni KEK ile açılır, eskiyle açılmaz (gerçek anahtar değişimi).
//   C) Geri rotasyon (yeni → env KEK'i) satırları uygulamanın okuyabildiği hâle döndürür (decryptField).
//
// ⚠️ Paylaşılan dev branch: apply DAİMA rowFilter ile (başka oturumların verisine dokunulmaz); tam tarama
// yalnız dry-run. Cleanup kendi satırlarını siler. Env KEK'i yoksa (CI/yerel) süit atlanır.
import { describe, it, expect, afterAll } from "vitest";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { encryptField, decryptField, kekFromBase64, rewrapEnvelope } from "@/lib/crypto";
import { rotateKek } from "@/lib/kek-rotation";

const TEST_DB = process.env.TEST_DATABASE_URL;
const ENV_KEK_B64 = process.env.DATA_ENCRYPTION_KEK;
const RUN = `itest-kek-${Date.now()}`;

describe.skipIf(!TEST_DB || !ENV_KEK_B64)("entegrasyon: KEK rotasyon motoru (gerçek dev DB, kendi satırları)", () => {
  const OLD = kekFromBase64(ENV_KEK_B64 ?? Buffer.alloc(32).toString("base64"));
  const NEW_B64 = randomBytes(32).toString("base64");
  const NEW = kekFromBase64(NEW_B64);
  const userIds: string[] = [];
  const caseIds: string[] = [];
  let targetCase = "", controlCase = "", userId = "";

  const opens = (v: string, kek: Buffer) => { try { rewrapEnvelope(v, kek, kek); return true; } catch { return false; } };

  afterAll(async () => {
    if (caseIds.length) await db.case.deleteMany({ where: { id: { in: caseIds } } }).catch(() => {});
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    await db.$disconnect();
  });

  it("A) tam tarama (dry-run): envantersiz bulma, iki tabloda; unrotatable boş", async () => {
    const u = await db.user.create({
      data: {
        email: `${RUN}@itest.local`, passwordHash: "itest-nohash", name: `KEK Test ${RUN}`, role: "PATIENT",
        patientHealthHistory: encryptField(JSON.stringify({ chronic: ["itest"], meds: false, smoking: false, majorSurgery: false })),
      },
    });
    userIds.push(u.id); userId = u.id;
    const mk = (tag: string) => db.case.create({
      data: {
        userId: u.id, patientName: encryptField(`Test Hasta ${RUN} ${tag}`), country: "TR", language: "Türkçe",
        symptoms: encryptField(`itest şikâyet ${tag}`), branch: "Kardiyoloji", urgency: 3, reasoning: encryptField(`itest gerekçe ${tag}`),
      },
    });
    const t = await mk("hedef"); const c = await mk("kontrol");
    caseIds.push(t.id, c.id); targetCase = t.id; controlCase = c.id;

    const r = await rotateKek({ db, oldKek: OLD, newKek: NEW }); // dry-run, filtre yok — SALT-OKUR
    expect(r.mode).toBe("dry-run");
    expect(r.complete).toBe(true);
    expect(r.unrotatable).toEqual([]);
    expect(r.scanned.tables).toBeGreaterThan(40);
    const labels = r.columns.map((x) => `${x.table}.${x.column}`);
    for (const l of ["Case.symptoms", "Case.reasoning", "Case.patientName", "User.patientHealthHistory"]) expect(labels).toContain(l);
    expect(r.totals.rewrap).toBeGreaterThanOrEqual(7); // en az bizim 2×3 Case + 1 User alanı
    // dry-run yazmadı: hedef hâlâ env KEK'iyle açılıyor
    const row = await db.case.findUniqueOrThrow({ where: { id: targetCase }, select: { symptoms: true } });
    expect(opens(row.symptoms, OLD)).toBe(true);
  }, 300_000); // tam tarama dev'de ~60 sn; soğuk Neon + CI payı

  it("B) apply + rowFilter: yalnız hedef satırlar yeni KEK'e sarılır; kontrol satırı ve eski anahtar erişimi", async () => {
    const mine = new Set<string | number>([targetCase, userId]);
    // tables: tam tarama A'da kanıtlandı; burada iki tabloyla sınırlamak testi ~60 sn kısaltır (CI zaman aşımı payı).
    const r = await rotateKek({ db, oldKek: OLD, newKek: NEW, apply: true, rowFilter: (_t, id) => mine.has(id), tables: ["Case", "User"] });
    expect(r.mode).toBe("apply");
    expect(r.complete).toBe(true);
    expect(r.totals.foreign).toBe(0);
    expect(r.totals.rewrap).toBe(4); // Case.patientName/symptoms/reasoning (hedef) + User.patientHealthHistory

    const t = await db.case.findUniqueOrThrow({ where: { id: targetCase }, select: { symptoms: true, reasoning: true, patientName: true } });
    for (const v of [t.symptoms, t.reasoning, t.patientName]) {
      expect(opens(v, NEW)).toBe(true);
      expect(opens(v, OLD)).toBe(false); // eski anahtar artık açmaz — rotasyon gerçek
      expect(() => decryptField(v)).toThrow(); // uygulama (env = eski) şu an okuyamaz → runbook "env'i geçir" adımı bunun içindir
    }
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { patientHealthHistory: true } });
    expect(opens(u.patientHealthHistory as string, NEW)).toBe(true);
    const c = await db.case.findUniqueOrThrow({ where: { id: controlCase }, select: { symptoms: true } });
    expect(opens(c.symptoms, OLD)).toBe(true); // filtre dışı → dokunulmadı
    expect(decryptField(c.symptoms)).toBe("itest şikâyet kontrol");
  }, 120_000);

  it("C) geri rotasyon (yeni → env KEK'i): uygulama satırları yeniden okur; ikinci tur already", async () => {
    const mine = new Set<string | number>([targetCase, userId]);
    const back = await rotateKek({ db, oldKek: NEW, newKek: OLD, apply: true, rowFilter: (_t, id) => mine.has(id), tables: ["Case", "User"] });
    expect(back.totals.rewrap).toBe(4);
    const t = await db.case.findUniqueOrThrow({ where: { id: targetCase }, select: { symptoms: true } });
    expect(decryptField(t.symptoms)).toBe("itest şikâyet hedef");
    const again = await rotateKek({ db, oldKek: NEW, newKek: OLD, apply: true, rowFilter: (_t, id) => mine.has(id), tables: ["Case", "User"] });
    expect(again.totals).toMatchObject({ rewrap: 0, already: 4 });
  }, 120_000);
});
