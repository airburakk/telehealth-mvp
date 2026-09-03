// TEST/DEMO doktor hesabı oluşturma aracı — YALNIZ DEV. create-admin.ts'in prod-koruma deseni
// birebir taşındı, ancak burada --prod YOK (bilinçli): sahte/demo bir doktorun gerçek üretim
// hekim kayıtlarına karışmasını yapısal olarak engeller.
//
// Doctorium (Aşama 1) erişimini AÇAR (Doctor.diplomaVerifiedAt damgalanır — v6.124 kapısı,
// bkz. lib/doctor-activation.ts hasDoctoriumAccess), gerçek e-Devlet/incelemeci onayını
// SİMÜLE EDER. Klinik (Aşama 2 / AURA) erişime BİLİNÇLİ dokunulmaz — activatedAt null kalır,
// hesap yalnız Doctorium'u doktor gözünden görebilir.
//
// Kullanım:
//   npx tsx scripts/create-test-doctor.ts --email test.doktor@example.com
//   (opsiyonel) --name "Test Doktor" --title "Uzm. Dr." --branch Dahiliye --city İstanbul
//   Şifre DOCTOR_PASSWORD env'inden okunur; verilmezse demo şifresi "Test1234!" kullanılır.
//   Temizlik: npx tsx scripts/create-test-doctor.ts --email x@y.com --delete
//   (User + Doctor + varsa ConsentRecord siler; audit/erişim izlerine DOKUNMAZ — değiştirilemez zincir.)
import "dotenv/config";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const DELETE = args.includes("--delete");
function argVal(flag: string): string | undefined {
  const ix = args.indexOf(flag);
  return ix >= 0 ? args[ix + 1] : undefined;
}

const email = (argVal("--email") ?? "").trim().toLocaleLowerCase("en-US");
const nameFromEmail = email.split("@")[0]
  ?.split(/[.\-_]/)
  .filter(Boolean)
  .map((p) => p.charAt(0).toLocaleUpperCase("tr-TR") + p.slice(1))
  .join(" ") || "Test Doktor";

const name = argVal("--name") ?? nameFromEmail;
const title = argVal("--title") ?? "Uzm. Dr.";
const branch = argVal("--branch") ?? "Dahiliye";
const city = argVal("--city") ?? "İstanbul";
const languages = argVal("--languages") ?? "Türkçe,İngilizce";

async function main() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("⛔ Geçerli bir --email verin (ör. --email ad@ornek.com).");
    process.exit(1);
  }

  // Prod fingerprint korkuluğu (create-admin.ts ile aynı desen) — --prod BİLİNÇLİ olarak yok.
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
    console.error("⛔ DATABASE_URL üretime işaret ediyor. Bu araç yalnız DEV içindir — durduruldu.");
    process.exit(1);
  }
  console.log("🎯 HEDEF: DEV (test/demo doktor hesabı)");

  const { db } = await import("../src/lib/db");

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true, doctorId: true } });

  if (DELETE) {
    if (!existing) {
      console.log(`ℹ️ ${email} zaten yok — silinecek bir şey kalmamış.`);
      return;
    }
    if (existing.role !== "DOCTOR") {
      console.error(`⛔ ${email} DOCTOR değil (rol: ${existing.role}) — bu araç yalnız test doktor hesabı siler.`);
      process.exit(1);
    }
    await db.$transaction(async (tx) => {
      await tx.consentRecord.deleteMany({ where: { userId: existing.id } });
      await tx.user.delete({ where: { id: existing.id } });
      if (existing.doctorId) await tx.doctor.delete({ where: { id: existing.doctorId } }).catch(() => {});
    });
    console.log(`🗑️ ${email} + bağlı Doctor profili + KVKK onam kaydı silindi (DEV).`);
    console.log("   Audit/erişim izlerine dokunulmadı (değiştirilemez zincir).");
    return;
  }

  if (existing) {
    if (existing.role !== "DOCTOR" || !existing.doctorId) {
      console.error(`⛔ ${email} zaten kayıtlı ama DOCTOR değil (rol: ${existing.role}). Elle çözün.`);
      process.exit(1);
    }
    await db.doctor.update({ where: { id: existing.doctorId }, data: { diplomaVerifiedAt: new Date() } });
    console.log(`✅ ${email} zaten DOCTOR — diplomaVerifiedAt (yeniden) damgalandı, Doctorium açık.`);
    console.log("   Şifre değiştirilmedi (yalnız yeni hesapta belirlenir).");
    return;
  }

  let password = process.env.DOCTOR_PASSWORD ?? "";
  if (!password) {
    password = "Test1234!";
    console.log("⚠️ DOCTOR_PASSWORD verilmedi — dev demo şifresi kullanılıyor.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({
      data: {
        name,
        title,
        branch,
        city,
        languages,
        verified: false, // yalnız Doctorium (Aşama 1) demo'su — genel dizinde görünmesin
        diplomaVerifiedAt: new Date(), // Aşama 1 kapısını simüle-açar (hasDoctoriumAccess)
      },
    });
    return tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        // v6.187 — parola BURADA belirlendiği için damgalanır: damgasız hesap "Hesabım → Şifre"
        // panelinde OAuth varyantını ("Google ile giriş yapıyorsunuz") görürdü.
        passwordSetAt: new Date(),
        role: "DOCTOR",
        doctorId: doctor.id,
        emailVerifiedAt: new Date(), // elle provizyonlama = doğrulanmış (create-admin.ts deseni)
      },
    });
  });

  console.log(`✅ Test doktor hesabı oluşturuldu: ${email} (User ${user.id})`);
  console.log(`   Ad: ${name} · ${title} · ${branch} / ${city}`);
  console.log(`   Şifre: ${password}`);
  console.log("   Giriş: /giris → Doktor sekmesi (yalnız DEV ortamında geçerli).");
  console.log("   Kapsam: yalnız Doctorium (Aşama 1) — klinik/AURA (Aşama 2) erişimi KAPALI (activatedAt boş).");
}

main().then(
  async () => { const { db } = await import("../src/lib/db"); await db.$disconnect(); },
  async (e) => {
    console.error("HATA:", e instanceof Error ? e.message : e);
    try { const { db } = await import("../src/lib/db"); await db.$disconnect(); } catch { /* kapanışta yut */ }
    process.exit(1);
  },
);
