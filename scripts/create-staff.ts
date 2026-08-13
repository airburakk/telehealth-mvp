// Koordinatör / Etik Kurul hesabı kurulum aracı (2026-08-12) — create-admin.ts'in personel türevi.
// Bu iki rol BİLİNÇLİ olarak başvuru ALMAZ (kullanıcı kararı: yüksek yetki → yalnız davet):
// Koordinatör tüm vaka+finans görür, Etik Kurul /admin'e girer — self-signup yüzeyi açılmaz.
// Hesap staffVerifiedAt DAMGALI açılır (davet = doğrulanmış; /kayit/durum kapısına takılmaz).
//
// GÜVENLİK KORKULUKLARI (create-admin.ts ile aynı):
//   • Prod YALNIZ --prod + PROD_DATABASE_URL; --prod'suz prod parmak izi → DURUR.
//   • Şifre YALNIZ STAFF_PASSWORD env'i — argüman/çıktı değil. Prod'da ≥12; dev'de yoksa "1234".
//   • Kayıtlı e-posta sessizce yükseltilmez — --promote şart (şifreye dokunmaz).
//   • emailVerifiedAt damgalanır (e-posta kapısı üretimde zorunlu; elle provizyon doğrulanmış sayılır).
//
// Kullanım:
//   npx tsx scripts/create-staff.ts --role COORDINATOR --email ops@ornek.com --name "Ad Soyad"
//   STAFF_PASSWORD='...' npx tsx scripts/create-staff.ts --prod --role ETHICS --email kurul@ornek.com --name "Ad Soyad"
//   Rol yükseltme: ... --role ETHICS --email x --promote (şifresiz çalışır)
import "dotenv/config";
import bcrypt from "bcryptjs";

const INVITE_ROLES = ["COORDINATOR", "ETHICS"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];

const args = process.argv.slice(2);
const PROD = args.includes("--prod");
const PROMOTE = args.includes("--promote");
const val = (flag: string) => {
  const ix = args.indexOf(flag);
  return ix >= 0 ? (args[ix + 1] ?? "").trim() : "";
};
const email = val("--email").toLocaleLowerCase("en-US");
const role = val("--role").toLocaleUpperCase("en-US") as InviteRole;
const name = val("--name");

async function main() {
  if (!INVITE_ROLES.includes(role)) {
    console.error(`⛔ --role ${INVITE_ROLES.join(" | ")} olmalı. (Partner/Acente/Sağlık Uzmanı başvuruyla gelir: /kayit/*)`);
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("⛔ Geçerli bir --email verin.");
    process.exit(1);
  }

  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log("🎯 HEDEF: ÜRETİM");
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; durduruldu.");
      process.exit(1);
    }
    console.log("🎯 HEDEF: DEV");
  }

  // Dinamik import: db.ts env'i modül yüklenirken okur (yukarıdaki ayarlar önce bitmeli).
  const { db } = await import("../src/lib/db");

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, staffVerifiedAt: true },
  });
  if (existing) {
    if (existing.role === role) {
      if (!existing.staffVerifiedAt) {
        await db.user.update({ where: { id: existing.id }, data: { staffVerifiedAt: new Date() } });
        console.log(`✅ ${email} zaten ${role} — eksik doğrulama damgası tamamlandı.`);
      } else {
        console.log(`✅ ${email} zaten ${role} — değişiklik yok.`);
      }
      return;
    }
    if (!PROMOTE) {
      console.error(
        `⛔ ${email} zaten kayıtlı (rol: ${existing.role}). Sessiz yükseltme yapılmaz — ` +
        `bilinçli değişiklik için --promote ekleyin (şifreye dokunulmaz).`,
      );
      process.exit(1);
    }
    await db.user.update({
      where: { id: existing.id },
      data: { role, staffVerifiedAt: existing.staffVerifiedAt ?? new Date() },
    });
    console.log(`✅ ${email} rolü ${existing.role} → ${role} yükseltildi (şifre değişmedi).`);
    return;
  }

  if (name.length < 2) {
    console.error('⛔ Yeni hesap için --name verin (ör. --name "Ayşe Yılmaz").');
    process.exit(1);
  }

  // Şifre yalnız yeni-hesap yolunda gerekir (create-admin deseni: kontrol promote dalından SONRA).
  let password = process.env.STAFF_PASSWORD ?? "";
  if (PROD) {
    if (password.length < 12) {
      console.error("⛔ Üretimde STAFF_PASSWORD zorunlu ve en az 12 karakter olmalı (env ile verin).");
      process.exit(1);
    }
  } else if (!password) {
    password = "1234";
    console.log("⚠️ STAFF_PASSWORD verilmedi — dev demo şifresi kullanılıyor (1234).");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({
    data: {
      email,
      name,
      role,
      passwordHash,
      emailVerifiedAt: new Date(), // elle provizyonlama = doğrulanmış (e-posta kapısı v6.61)
      staffVerifiedAt: new Date(), // davet = insan onayı yerine geçer (başvuru kuyruğuna düşmez)
    },
  });
  console.log(`✅ ${role} oluşturuldu: ${email} (şifre çıktıya basılmaz).`);
  console.log("   Giriş: /kurumsal-giris → e-posta + belirlediğiniz şifre. İlk girişte KVKK onam ekranı normaldir.");
}

main().then(
  async () => { const { db } = await import("../src/lib/db"); await db.$disconnect(); },
  async (e) => {
    console.error("HATA:", e instanceof Error ? e.message : e);
    try { const { db } = await import("../src/lib/db"); await db.$disconnect(); } catch { /* kapanışta yut */ }
    process.exit(1);
  },
);
