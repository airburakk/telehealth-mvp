// Entegrasyon test setup — HER test dosyasından ÖNCE çalışır (vitest setupFiles).
// .env'i yükler + route handler'ların `db`'sini (lib/db.ts DATABASE_URL'i construct anında okur)
// **dev branch'e** yönlendirir → prod Neon'a ASLA yazılmaz. TEST_DATABASE_URL yoksa DATABASE_URL'e
// dokunmaz (ama tüm entegrasyon süitleri `skipIf` ile atlanır → yine prod'a temas etmez).
import "dotenv/config";

if (process.env.TEST_DATABASE_URL) {
  // lib/db.ts PrismaClient'ı bu değeri construct anında okur → gerçek route handler'lar dev branch'e bağlanır.
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
