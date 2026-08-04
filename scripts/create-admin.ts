// ADMIN hesabı kurulum aracı (v6.70) — kalıcı araç. Admin self-signup BİLİNÇLİ yok;
// provizyonlama yalnız bu script'le, DB'ye doğrudan yazarak yapılır.
//
// GÜVENLİK KORKULUKLARI (seed-congresses.ts deseni + hesap-özel kurallar):
//   • Prod YALNIZ --prod + ayrı PROD_DATABASE_URL env'i; --prod'suz DATABASE_URL prod
//     parmak izine uyuyorsa DURUR.
//   • Şifre YALNIZ ADMIN_PASSWORD env'inden okunur — argüman/çıktı olarak ASLA geçmez/basılmaz
//     (shell history + log sızıntısı). Yalnız YENİ hesap oluştururken gerekir: prod'da zorunlu +
//     en az 12 karakter; dev'de verilmezse demo deseni "1234" (uyarıyla). --promote şifre İSTEMEZ
//     (şifreye dokunmaz; kontrol bilinçli olarak promote dalından SONRA koşar).
//   • E-posta ZATEN KAYITLIYSA rol sessizce yükseltilmez (yanlış e-postaya yetki kazası) —
//     mevcut rol raporlanır ve durulur; bilinçli yükseltme için --promote şart (şifreye dokunmaz).
//   • emailVerifiedAt damgalanır: e-posta kapısı üretimde zorunlu (v6.61) — elle provizyonlanan
//     hesap doğrulama e-postası bekleyemez; e-postanın doğruluğu koşan kişinin sorumluluğudur.
//
// Kullanım:
//   npx tsx scripts/create-admin.ts --email admin@air.test              → DEV (ADMIN_PASSWORD yoksa "1234")
//   ADMIN_PASSWORD='...' npx tsx scripts/create-admin.ts --prod --email siz@ornek.com
//   ADMIN_PASSWORD boş + --prod → yeni hesapta durur. Rol yükseltme: ... --email x --promote (şifresiz çalışır)
import "dotenv/config";
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const PROD = args.includes("--prod");
const PROMOTE = args.includes("--promote");
const emailIx = args.indexOf("--email");
const email = emailIx >= 0 ? (args[emailIx + 1] ?? "").trim().toLocaleLowerCase("en-US") : "";

async function main() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("⛔ Geçerli bir --email verin (ör. --email admin@air.test).");
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

  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`✅ ${email} zaten ADMIN — değişiklik yok.`);
      return;
    }
    if (!PROMOTE) {
      console.error(
        `⛔ ${email} zaten kayıtlı (rol: ${existing.role}). Sessiz yükseltme yapılmaz — ` +
        `bilinçli yükseltme için --promote ekleyin (şifreye dokunulmaz).`,
      );
      process.exit(1);
    }
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`✅ ${email} rolü ${existing.role} → ADMIN yükseltildi (şifre değişmedi).`);
    return;
  }

  // Şifre yalnız yeni-hesap yolunda gerekir — kontrol BİLİNÇLİ olarak existing/--promote dalından
  // SONRA koşar: promote şifreye dokunmaz, prod'da yükseltme yaparken dolgu şifre istenmemeli.
  let password = process.env.ADMIN_PASSWORD ?? "";
  if (PROD) {
    if (password.length < 12) {
      console.error("⛔ Üretimde ADMIN_PASSWORD zorunlu ve en az 12 karakter olmalı (env ile verin).");
      process.exit(1);
    }
  } else if (!password) {
    password = "1234";
    console.log("⚠️ ADMIN_PASSWORD verilmedi — dev demo şifresi kullanılıyor (1234).");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({
    data: {
      email,
      name: "Platform Yöneticisi",
      role: "ADMIN",
      passwordHash,
      emailVerifiedAt: new Date(), // elle provizyonlama = doğrulanmış (e-posta kapısı v6.61)
    },
  });
  console.log(`✅ ADMIN oluşturuldu: ${email} (şifre çıktıya basılmaz).`);
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
