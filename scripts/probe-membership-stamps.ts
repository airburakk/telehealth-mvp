// Üyelik damgaları sağlık kontrolü — SALT-OKUR sayım (açık işler envanteri §4, 2026-08-29 bulguları).
//
// SORU 1: `verified` (admin onayı) diploma damgasından BAĞIMSIZ mı işliyor?
//         → verified ∧ ¬diplomaVerifiedAt sayısı. Sıfırdan büyükse diploması doğrulanmamış bir
//           doktor hasta havuzuna çıkarılabilmiş demektir (kapı sorusu → 👤 süreç kararı).
// SORU 2: `studentTrack` damgasız öğrenci kaydı var mı? → studentTrack=false ama ünvanı "… Öğr." /
//         studentUniversity dolu / studentVerifiedAt dolu → öğrenci sayısı bu kadar EKSİK raporlanır
//         (staff-membership-lifecycle tuzağı: yeni alan gelince mevcut kayıt migration'da damgalanmalı).
// SORU 3: Landing "ogrenci" yerleşimi (v6.262, 2026-09-10) sinyal üretiyor mu?
//         → LandingEvent placement=ogrenci ∨ name=student_click, gün bazlı + section_view payı.
//
// GÜVENLİK: HİÇBİR ŞEY YAZMAZ · PHI/e-posta/ad İÇERİĞİ BASMAZ (yalnız sayılar) · src/lib/db.ts'i
// import ETMEZ (kod-seviyesi AURA_DB_GUARD'a takılmaz; datasourceUrl açıkça verilir) · varsayılan
// hedef PROD_DATABASE_URL (açık niyet; DATABASE_URL fallback'i BİLİNÇLİ yok — yanlışlıkla dev sayıp
// "prod temiz" sanma riski) · `--dev` bayrağı DATABASE_URL'i (Neon development branch) hedefler.
//
// Kullanım: npx tsx scripts/probe-membership-stamps.ts          → PROD (salt-okur, onaylı niyet)
//           npx tsx scripts/probe-membership-stamps.ts --dev    → dev branch (betik provası)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const useDev = process.argv.includes("--dev");
const url = useDev ? process.env.DATABASE_URL : process.env.PROD_DATABASE_URL;
if (!url) {
  console.error(
    useDev
      ? "✋ DATABASE_URL tanımsız."
      : "✋ PROD_DATABASE_URL tanımsız — prod keşfi açık niyet ister (DATABASE_URL fallback'i bilinçli yok).",
  );
  process.exit(1);
}
const db = new PrismaClient({ datasourceUrl: url });

// lib/doctor-signup.ts STUDENT_TITLE = "Tıp Öğr."; v6.147'den beri bölüme göre türetilir ("Diş Hek. Öğr." vb.)
// → ortak son ek "Öğr." ile yakalanır. scripts/ dizini @/ alias'ı kullanmadığından değer burada tekrarlanır.
const STUDENT_TITLE_SUFFIX = "Öğr.";
const DEMO_EMAIL_SUFFIX = "@air.test";
const LANDING_SINCE = new Date("2026-09-10T00:00:00Z"); // v6.262 (Öğrenciler bölümü) canlıya çıkış günü

type Profile = {
  id: string;
  title: string | null;
  verified: boolean;
  diplomaVerifiedAt: Date | null;
  activatedAt: Date | null;
  studentTrack: boolean;
  studentVerifiedAt: Date | null;
  studentUniversity: string | null;
  trialStartedAt: Date | null;
  doctoriumOptOutAt: Date | null;
};
type Member = { demo: boolean; p: Profile };
type Tally = { all: number; demo: number; real: number };

const tally = (rows: Member[], pred: (p: Profile) => boolean): Tally => {
  const hit = rows.filter((m) => pred(m.p));
  const demo = hit.filter((m) => m.demo).length;
  return { all: hit.length, demo, real: hit.length - demo };
};
const row = (label: string, t: Tally, note = "") =>
  console.log(
    `  ${label.padEnd(40)} ${String(t.all).padStart(4)}   (demo ${String(t.demo).padStart(3)} · gerçek ${String(t.real).padStart(3)})${note ? "   " + note : ""}`,
  );
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const studentTraces = (p: Profile) => ({
  title: !!p.title && p.title.endsWith(STUDENT_TITLE_SUFFIX),
  uni: !!p.studentUniversity,
  stamp: !!p.studentVerifiedAt,
});

async function main() {
  console.log(`── Hedef: ${useDev ? "DEV (DATABASE_URL)" : "PROD (PROD_DATABASE_URL)"} · salt-okur ──\n`);

  // Üye kümesi — /admin/uyeler ile AYNI yol: User(DOCTOR, silinmemiş, doctorId dolu) → Doctor.
  // Ham Doctor.count() seed/havuz satırlarını da sayar (hesapsız profil) → yalnız bağlam için gösterilir.
  const doctorUsers = await db.user.findMany({
    where: { role: "DOCTOR", deletedAt: null, doctorId: { not: null } },
    select: { id: true, doctorId: true },
  });
  // Demo ayrımı: e-posta içeriği belleğe/çıktıya alınmaz — yalnız id kümesi.
  const demoIds = new Set(
    (await db.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_SUFFIX } }, select: { id: true } })).map((u) => u.id),
  );
  const orphanDoctorUsers = await db.user.count({ where: { role: "DOCTOR", deletedAt: null, doctorId: null } });
  const rawDoctorRows = await db.doctor.count();

  const ids = doctorUsers.flatMap((u) => (u.doctorId ? [u.doctorId] : []));
  const profiles: Profile[] = ids.length
    ? await db.doctor.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, title: true, verified: true, diplomaVerifiedAt: true, activatedAt: true,
          studentTrack: true, studentVerifiedAt: true, studentUniversity: true,
          trialStartedAt: true, doctoriumOptOutAt: true,
        },
      })
    : [];
  const byDoctorId = new Map(profiles.map((p) => [p.id, p]));
  const members: Member[] = [];
  for (const u of doctorUsers) {
    const p = u.doctorId ? byDoctorId.get(u.doctorId) : undefined;
    if (p) members.push({ demo: demoIds.has(u.id), p });
  }
  const doctors = members.filter((m) => !m.p.studentTrack);
  const students = members.filter((m) => m.p.studentTrack);

  console.log(
    `── Üyeler (User→Doctor yolu) · ham Doctor satırı ${rawDoctorRows} · hesapsız profil ${rawDoctorRows - profiles.length} · doctorId'siz DOCTOR hesabı ${orphanDoctorUsers} ──`,
  );
  row("Doktor (studentTrack=false)", tally(doctors, () => true));
  row("Öğrenci (studentTrack=true)", tally(students, () => true));

  console.log("\n── SORU 1 · verified ↔ diplomaVerifiedAt (bağımsız eksenler mi?) ──");
  row("Diploması doğrulanmış (Aşama 1)", tally(doctors, (p) => !!p.diplomaVerifiedAt));
  row("Admin onaylı (verified=true)", tally(doctors, (p) => p.verified));
  row("Klinik aktif (activatedAt)", tally(doctors, (p) => !!p.activatedAt));
  row("⚠️ A: verified ∧ diploma YOK", tally(doctors, (p) => p.verified && !p.diplomaVerifiedAt), "→ >0 ise onay kapısı diplomaya bağlı DEĞİL");
  row("B: diploma VAR ∧ verified değil", tally(doctors, (p) => !!p.diplomaVerifiedAt && !p.verified), "→ onay bekleyen (normal akış)");
  row("⚠️ C: activatedAt ∧ diploma YOK", tally(doctors, (p) => !!p.activatedAt && !p.diplomaVerifiedAt), "→ klinik kapı diplomasız açılmış");
  row("Deneme yolu (trialStartedAt)", tally(doctors, (p) => !!p.trialStartedAt));
  row("Doctorium'dan çıkmış (optOut)", tally(doctors, (p) => !!p.doctoriumOptOutAt));

  console.log("\n── SORU 2 · studentTrack=false ama öğrenci izi taşıyan kayıt ──");
  const unstamped = doctors.filter((m) => {
    const s = studentTraces(m.p);
    return s.title || s.uni || s.stamp;
  });
  row("Damgasız öğrenci adayı (herhangi iz)", tally(unstamped, () => true), "→ öğrenci sayısı bu kadar EKSİK raporlanır");
  row("  · ünvanı \"… Öğr.\"", tally(unstamped, (p) => studentTraces(p).title));
  row("  · studentUniversity dolu", tally(unstamped, (p) => studentTraces(p).uni));
  row("  · studentVerifiedAt dolu", tally(unstamped, (p) => studentTraces(p).stamp));
  row("Öğrenci · e-posta doğrulanmış", tally(students, (p) => !!p.studentVerifiedAt));
  row("Öğrenci · üniversitesi boş", tally(students, (p) => !p.studentUniversity), "→ v6.147 öncesi kayıt izi");

  console.log(`\n── SORU 3 · Landing 'ogrenci' yerleşimi (LandingEvent, ${LANDING_SINCE.toISOString().slice(0, 10)}'dan beri) ──`);
  const events = await db.landingEvent.findMany({
    where: { day: { gte: LANDING_SINCE }, OR: [{ placement: "ogrenci" }, { name: "student_click" }] },
    select: { day: true, name: true, placement: true, count: true },
    orderBy: [{ day: "asc" }, { name: "asc" }],
  });
  if (!events.length) console.log("  (kayıt yok — henüz sinyal gelmemiş ya da beacon bu yerleşimi göndermiyor)");
  for (const e of events) {
    console.log(`  ${e.day.toISOString().slice(0, 10)}  ${e.name.padEnd(26)} ${e.placement.padEnd(10)} ${String(e.count).padStart(5)}`);
  }
  // Bağlam: aynı dönemde section_view yerleşim dağılımı → ogrenci'nin payı; landing_view = ziyaret tabanı.
  const sections = await db.landingEvent.groupBy({
    by: ["placement"],
    where: { day: { gte: LANDING_SINCE }, name: "section_view" },
    _sum: { count: true },
    orderBy: { _sum: { count: "desc" } },
  });
  const sectionTotal = sections.reduce((acc, g) => acc + (g._sum.count ?? 0), 0);
  const landingViews = await db.landingEvent.aggregate({
    where: { day: { gte: LANDING_SINCE }, name: "landing_view" },
    _sum: { count: true },
  });
  console.log(`\n  landing_view toplam: ${landingViews._sum.count ?? 0} · section_view toplam: ${sectionTotal}`);
  for (const g of sections) {
    const n = g._sum.count ?? 0;
    console.log(`    ${g.placement.padEnd(14)} ${String(n).padStart(5)}  ${pct(n, sectionTotal)}`);
  }
}

main()
  .catch((e) => {
    console.error("HATA:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
