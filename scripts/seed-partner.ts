// M5 Faz 3 — Demo Partner Doktor. partner@air.test (parola 1234) + PartnerDoctor "Dr. Sarah Klein".
// İdempotent: upsert + mevcut "Dr. Sarah Klein…" taleplerini bu partnere bağlar (re-run güvenli).
// Çalıştır: npx tsx scripts/seed-partner.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("1234", 10);

  // PartnerDoctor (email benzersiz → upsert)
  const partner = await db.partnerDoctor.upsert({
    where: { email: "partner@air.test" },
    create: {
      name: "Sarah Klein",
      title: "Dr.",
      country: "AT",
      institution: "Wien Herz-Klinik",
      branch: "Kardiyoloji",
      email: "partner@air.test",
      phone: null,
      verified: true,
    },
    update: { verified: true },
  });

  // Kullanıcı (email benzersiz → upsert) + partnerId bağla
  const user = await db.user.upsert({
    where: { email: "partner@air.test" },
    create: { email: "partner@air.test", name: "Dr. Sarah Klein", role: "PARTNER", passwordHash, partnerId: partner.id },
    update: { role: "PARTNER", partnerId: partner.id },
  });

  // Mevcut seed'deki "Dr. Sarah Klein (Avusturya)" talepleri bu partnere ait → bağla (yanıtlanan dahil görünür)
  const linked = await db.consultationRequest.updateMany({
    where: { requestedByName: { startsWith: "Dr. Sarah Klein" }, requestedByPartnerId: null },
    data: { requestedByPartnerId: partner.id },
  });

  console.log(`Partner: ${partner.id} (${partner.email})`);
  console.log(`User: ${user.id} role=${user.role} partnerId=${user.partnerId}`);
  console.log(`Bağlanan mevcut talep: ${linked.count}`);
  console.log("Giriş: partner@air.test / 1234");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
