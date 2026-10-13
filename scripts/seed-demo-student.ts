// Demo TIP ÖĞRENCİSİ hesabı — YALNIZ DEV/yerel (2026-10-10, YouTube tanıtım videosu ekran kayıtları için).
// prisma/seed.ts her şeyi silip yeniden kurduğu için öğrenci hesabı ayrı ve TEKRAR KOŞULABİLİR betikte tutulur.
// Gerçek kayıt yolunu kullanır (createDoctorAccount — signup-student ile aynı alanlar), ardından üniversite
// e-postası tıklanmış gibi studentVerifiedAt + emailVerifiedAt damgalanır.
//
// Demo kimlik (seed.ts'teki diğer demo hesaplarla aynı düzen): ogrenci@air.test / 1234
//
// Çalıştırma: npx tsx --env-file=.env scripts/seed-demo-student.ts
// Korkuluk: VERCEL_ENV=production ya da PROD_* bağlantısıyla koşmaz; DATABASE_URL Neon DEV dalı olmalı.
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createDoctorAccount, studentTitleFor } from "@/lib/doctor-signup";

const EMAIL = "ogrenci@air.test";
const DEV_HOST_PREFIX = "ep-falling-morning"; // Neon DEV dalı (yerel .env)

async function main() {
  const host = (process.env.DATABASE_URL || "").replace(/.*@([^/]+)\/.*/, "$1");
  if (process.env.VERCEL_ENV === "production" || !host.startsWith(DEV_HOST_PREFIX)) {
    throw new Error(`Yalnız DEV veritabanında koşar (bulunan host: ${host || "yok"})`);
  }

  let user = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true, doctorId: true } });
  if (!user) {
    user = await createDoctorAccount({
      name: "Demo Öğrenci",
      email: EMAIL,
      passwordHash: await hashPassword("1234"),
      title: studentTitleFor("tip"),
      branch: "", // öğrencinin branşı yok (Google yolu gibi boş geçer)
      city: "Ankara",
      languages: "Türkçe",
      phone: null,
      studentTrack: true,
      studentUniversity: "Hacettepe Üniversitesi",
      studentDepartment: "tip",
      passwordSet: true,
    });
    console.log("Oluşturuldu:", EMAIL);
  } else {
    console.log("Zaten var:", EMAIL);
  }

  const now = new Date();
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } });
  await db.doctor.update({ where: { id: user.doctorId! }, data: { studentVerifiedAt: now } });
  console.log("Damgalandı: emailVerifiedAt + studentVerifiedAt");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
