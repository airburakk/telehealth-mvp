// Entegrasyon fixture'ları — GERÇEK dev branch'e yazar (setup.ts DATABASE_URL'i dev branch'e yönlendirir).
// Her süit beforeAll'da seedFixture() → afterAll'da cleanupFixture() (oluşturulan satırlar id ile silinir).
// Prod'a ASLA dokunmaz (TEST_DATABASE_URL yoksa süitler skipIf ile hiç çalışmaz).
import { db } from "@/lib/db";
import { AUDIT_CHAIN_LOCK } from "@/lib/audit";
import { CONSENT_CHAIN_LOCK } from "@/lib/consent";
import { ownContiguousTail } from "./chain-tail";

export interface Fixture {
  runId: string;
  patientId: string;
  otherPatientId: string;
  d1UserId: string;
  d1DoctorId: string; // doğrulanmış doktor
  d2UserId: string;
  d2DoctorId: string; // doğrulanmış başka doktor (çapraz-erişim testi)
  unverUserId: string;
  unverDoctorId: string; // doğrulanmamış doktor
  assignedCaseId: string; // patient'a ait, d1'e ATANMIŞ
  unassignedCaseId: string; // patient'a ait, ATANMAMIŞ (kuyruk)
  otherCaseId: string; // otherPatient'a ait
  // Liste kapsamı (kontrol raporu 2026-09-17 K02 — lib/case-access): d1'in KUYRUĞUNDA GÖRÜNMEMESİ gereken üçlü
  d2AssignedCaseId: string; // patient'a ait, d2'ye ATANMIŞ (aynı branş — çapraz-doktor)
  lockedCaseId: string; // patient'a ait, d1'e atanmış ama SİLME-KİLİTLİ (deletionLockedAt)
  docsPendingCaseId: string; // patient'a ait, atanmamış, DOCS_PENDING (havuza düşmez)
  unactUserId: string;
  unactDoctorId: string; // doğrulanmış ama AKTİVASYONSUZ doktor (activatedAt null) — tek değişken izole
  userIds: string[];
  doctorIds: string[];
  caseIds: string[];
}

let seq = 0;

export async function seedFixture(): Promise<Fixture> {
  const runId = `itest_${Date.now()}_${seq++}`;
  const email = (tag: string) => `${runId}_${tag}_${Math.random().toString(36).slice(2, 8)}@itest.local`;

  const mkUser = (role: string, extra: Record<string, unknown> = {}) =>
    db.user.create({ data: { email: email(role), passwordHash: "itest-nohash", name: `${role} ${runId}`, role, ...extra } });

  // 🪤 `activatedAt` HER doktora DOLU verilir — doğrulanmamış olana bile. Sebep: klinik erişim
  // kapısı İKİ şart ister (`ownership.ts` → `!verified || !activated` ⇒ red; `activated` =
  // `hasClinicalAccess` = `!!activatedAt`). Aktivasyon damgası eksik olsaydı:
  //   · pozitif testler ("doğrulanmış doktor kendi branş kuyruğunu görür") YANLIŞ yere kızarırdı
  //     — 2026-08-19'da tam bu oldu, CI 3 push boyunca kırmızı kaldı ve bypass ile geçildi;
  //   · negatif test ("doğrulanmamış doktor erişemez") İKİ şart birden eksik olduğu için
  //     YANLIŞ SEBEPLE yeşil kalırdı — `verified` kapısını hiç sınamazdı.
  // Kural: yeni bir erişim şartı eklenince negatif testte o şartı DOLU ver, tek değişkeni izole et.
  const mkDoctor = (tag: string, verified: boolean, activatedAt: Date | null = new Date()) =>
    db.doctor.create({
      data: {
        name: `${tag} ${runId}`, title: "Op. Dr.", branch: "Kardiyoloji", city: "İstanbul",
        languages: "Türkçe", verified, activatedAt,
      },
    });

  const mkCase = (userId: string | null, doctorId: string | null, extra: Record<string, unknown> = {}) =>
    db.case.create({
      data: {
        userId, doctorId,
        patientName: `Test Hasta ${runId}`, country: "TR", language: "Türkçe",
        symptoms: "test şikâyet", branch: "Kardiyoloji", urgency: 3, reasoning: "test gerekçe",
        ...extra,
      },
    });

  const patient = await mkUser("PATIENT");
  const otherPatient = await mkUser("PATIENT");
  const d1 = await mkDoctor("D1", true);
  const d1User = await mkUser("DOCTOR", { doctorId: d1.id });
  const d2 = await mkDoctor("D2", true);
  const d2User = await mkUser("DOCTOR", { doctorId: d2.id });
  const unver = await mkDoctor("DU", false);
  const unverUser = await mkUser("DOCTOR", { doctorId: unver.id });
  const unact = await mkDoctor("DA", true, null); // verified ama activatedAt null
  const unactUser = await mkUser("DOCTOR", { doctorId: unact.id });

  const assigned = await mkCase(patient.id, d1.id);
  const unassigned = await mkCase(patient.id, null);
  const other = await mkCase(otherPatient.id, null);
  const d2Assigned = await mkCase(patient.id, d2.id);
  const locked = await mkCase(patient.id, d1.id, { deletionLockedAt: new Date() });
  const docsPending = await mkCase(patient.id, null, { status: "DOCS_PENDING" });

  return {
    runId,
    patientId: patient.id, otherPatientId: otherPatient.id,
    d1UserId: d1User.id, d1DoctorId: d1.id,
    d2UserId: d2User.id, d2DoctorId: d2.id,
    unverUserId: unverUser.id, unverDoctorId: unver.id,
    assignedCaseId: assigned.id, unassignedCaseId: unassigned.id, otherCaseId: other.id,
    d2AssignedCaseId: d2Assigned.id, lockedCaseId: locked.id, docsPendingCaseId: docsPending.id,
    unactUserId: unactUser.id, unactDoctorId: unact.id,
    userIds: [patient.id, otherPatient.id, d1User.id, d2User.id, unverUser.id, unactUser.id],
    doctorIds: [d1.id, d2.id, unver.id, unact.id],
    caseIds: [assigned.id, unassigned.id, other.id, d2Assigned.id, locked.id, docsPending.id],
  };
}

// FK sırası: önce Case (Doctor+User'a bağlı), sonra User, sonra Doctor.
export async function cleanupFixture(f: Fixture): Promise<void> {
  await db.case.deleteMany({ where: { id: { in: f.caseIds } } });
  await db.user.deleteMany({ where: { id: { in: f.userIds } } });
  await db.doctor.deleteMany({ where: { id: { in: f.doctorIds } } });
}

// Hash-zinciri testlerinin temizliği — YAZICI KİLİDİ ALTINDA, yalnız bitişik kendi kuyruğu (chain-tail.ts).
// Neden kilit: recordAccess/recordConsent uç okuması + insert'i advisory xact-lock altında yapar; temizlik aynı
// kilidi almazsa "uç benimse sil" kontrolü ile silme arasına yabancı bir append girer (2026-10-04: iki CI koşusu
// aynı test branch'inde üst üste bindi → yetim satırlar → zincir KALICI kırık, her entegrasyon koşusu kırmızı).
// Kilit alınınca kontrol+silme atomiktir, yazıcılar bekler; transaction bitince kilit kendiliğinden bırakılır
// (Neon/PgBouncer transaction-pooling güvenli — lib ile aynı desen). Dönüş: silinen satır sayısı.
export async function deleteOwnChainTail(chain: "audit" | "consent", ids: readonly string[]): Promise<number> {
  if (!ids.length) return 0;
  const mine = new Set(ids);
  const [a, b] = chain === "audit" ? AUDIT_CHAIN_LOCK : CONSENT_CHAIN_LOCK;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${a}::int4, ${b}::int4)`;
    const tipFirst =
      chain === "audit"
        ? await tx.accessLog.findMany({ where: { entryHash: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: ids.length, select: { id: true } })
        : await tx.consentRecord.findMany({ where: { entryHash: { not: null } }, orderBy: [{ grantedAt: "desc" }, { id: "desc" }], take: ids.length, select: { id: true } });
    const tail = ownContiguousTail(tipFirst, mine);
    if (!tail.length) return 0;
    const res = chain === "audit" ? await tx.accessLog.deleteMany({ where: { id: { in: tail } } }) : await tx.consentRecord.deleteMany({ where: { id: { in: tail } } });
    return res.count;
  });
}
