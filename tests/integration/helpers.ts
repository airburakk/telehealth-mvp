// Entegrasyon fixture'ları — GERÇEK dev branch'e yazar (setup.ts DATABASE_URL'i dev branch'e yönlendirir).
// Her süit beforeAll'da seedFixture() → afterAll'da cleanupFixture() (oluşturulan satırlar id ile silinir).
// Prod'a ASLA dokunmaz (TEST_DATABASE_URL yoksa süitler skipIf ile hiç çalışmaz).
import { db } from "@/lib/db";

export interface Fixture {
  runId: string;
  patientId: string;
  otherPatientId: string;
  d1UserId: string;
  d1DoctorId: string; // doğrulanmış hekim
  d2UserId: string;
  d2DoctorId: string; // doğrulanmış başka hekim (çapraz-erişim testi)
  unverUserId: string;
  unverDoctorId: string; // doğrulanmamış hekim
  assignedCaseId: string; // patient'a ait, d1'e ATANMIŞ
  unassignedCaseId: string; // patient'a ait, ATANMAMIŞ (kuyruk)
  otherCaseId: string; // otherPatient'a ait
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

  const mkDoctor = (tag: string, verified: boolean) =>
    db.doctor.create({ data: { name: `${tag} ${runId}`, title: "Op. Dr.", branch: "Kardiyoloji", city: "İstanbul", languages: "Türkçe", verified } });

  const mkCase = (userId: string | null, doctorId: string | null) =>
    db.case.create({
      data: {
        userId, doctorId,
        patientName: `Test Hasta ${runId}`, country: "TR", language: "Türkçe",
        symptoms: "test şikâyet", branch: "Kardiyoloji", urgency: 3, reasoning: "test gerekçe",
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

  const assigned = await mkCase(patient.id, d1.id);
  const unassigned = await mkCase(patient.id, null);
  const other = await mkCase(otherPatient.id, null);

  return {
    runId,
    patientId: patient.id, otherPatientId: otherPatient.id,
    d1UserId: d1User.id, d1DoctorId: d1.id,
    d2UserId: d2User.id, d2DoctorId: d2.id,
    unverUserId: unverUser.id, unverDoctorId: unver.id,
    assignedCaseId: assigned.id, unassignedCaseId: unassigned.id, otherCaseId: other.id,
    userIds: [patient.id, otherPatient.id, d1User.id, d2User.id, unverUser.id],
    doctorIds: [d1.id, d2.id, unver.id],
    caseIds: [assigned.id, unassigned.id, other.id],
  };
}

// FK sırası: önce Case (Doctor+User'a bağlı), sonra User, sonra Doctor.
export async function cleanupFixture(f: Fixture): Promise<void> {
  await db.case.deleteMany({ where: { id: { in: f.caseIds } } });
  await db.user.deleteMany({ where: { id: { in: f.userIds } } });
  await db.doctor.deleteMany({ where: { id: { in: f.doctorIds } } });
}
