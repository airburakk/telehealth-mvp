import { PrismaClient } from "@prisma/client";

// ── Ortam ayrımı guard'ı (Ray B1, launch-gate 3 — 2026-07-16) ────────────────────────────────
// Yerel .env üretim Neon'una işaret edebiliyor; bu blok kazara dev/script yazımını görünür kılar.
// Parmak izi (host adı parçası, sır değil) public repo'ya gömülmez → .env `PROD_DB_FINGERPRINT`.
// Tanımsızsa guard sessizdir — yerel kurulumda tanımlamak ZORUNLU adımdır (DEPLOY.md ortam ayrımı).
// `AURA_DB_GUARD=block` → üretim-dışı ortamdan prod'a bağlantı HATA fırlatır (tam ayrım
// tamamlanınca varsayılan bu olacak); aksi halde yüksek sesle uyarır. Vercel'de (NODE_ENV=production
// veya VERCEL=1) guard devre dışı — üretimin kendi DB'sine bağlanması normaldir.
const prodFp = process.env.PROD_DB_FINGERPRINT;
const isProdRuntime = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
if (prodFp && !isProdRuntime && (process.env.DATABASE_URL ?? "").includes(prodFp)) {
  const guardMsg =
    `⚠️⚠️ DB GUARD: ÜRETİM veritabanına üretim-dışı ortamdan bağlanıyorsunuz (${prodFp}). ` +
    "Yazma işlemleri GERÇEK ortama gider. Geliştirme için Neon dev branch kullanın (DEPLOY.md " +
    "— Ortam ayrımı). Sert engel için AURA_DB_GUARD=block.";
  if (process.env.AURA_DB_GUARD === "block") throw new Error(guardMsg);
  console.error(guardMsg);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
