// Sağlık Turizmi Acentesi (AGENCY, S3) demo kullanıcısını İDEMPOTENT oluşturur — FAZ 4 (2026-07-10).
// Mevcut prod verisine dokunmaz (seed.ts reset'inin aksine): yalnız acente@air.test yoksa ekler.
// Çalıştırma: npx tsx scripts/create-agency-user.ts  (DATABASE_URL .env'den)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = "acente@air.test";
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    console.log(`✓ ${email} zaten var (role=${existing.role}) — dokunulmadı.`);
    return;
  }
  const passwordHash = await bcrypt.hash("1234", 10); // demo parolası (diğer *@air.test hesaplarıyla aynı)
  const u = await db.user.create({
    // emailVerifiedAt: operatör eliyle açılan hesap doğrulama zorunluluğundan muaf (v5.6)
    data: { email, name: "Demo Sağlık Turizmi Acentesi", role: "AGENCY", passwordHash, emailVerifiedAt: new Date() },
  });
  console.log(`✓ AGENCY kullanıcısı oluşturuldu: ${email} (id=${u.id})`);
}

main().finally(() => db.$disconnect());
