// PUSH ÖNCESİ ÜRETİM KAPISI (2026-08-20) — kalıcı korkuluk.
//
// NEDEN VAR: 2026-08-20'de v6.132 migration'ı yalnız DEV'e uygulanmışken kod push'landı.
// Push, Vercel'de otomatik dağıtım tetikler → üretim kodu var olmayan kolonu okudu →
// `/doktor` ve `/doktor/doctorium` P2022 ile çöktü (~4 dk kesinti). Kural DEPLOY.md'de
// zaten yazılıydı ("yeni nullable kolon = migration-önce") ama "migration-önce" COMMIT
// sırası sanıldı; oysa UYGULAMA sırası demek. Belgeye uyarı yazmak korumaz — bu betik korur.
//
// NE YAPAR: üretim veritabanında BEKLEYEN migration var mı diye bakar. Varsa çıkış kodu 1
// döner ve `.githooks/pre-push` push'u durdurur.
//
// FAIL-CLOSED: veritabanına ulaşılamazsa da engeller (bir kez yeniden dener). Neon soğuk
// başlangıcı gerçek bir durum — ama "doğrulayamadım" ile "temiz" aynı şey değildir.
//
// ACİL ATLATMA:  SKIP_PREFLIGHT=1 git push        (bilinçli tercih; sebebini bil)
//
// 🪤 .env'i ASLA regex ile okuma: /DATABASE_URL="?([^"\n]+)/ deseni dosyada önce gelen
//    PROD_DATABASE_URL satırına da uyar ve yanlış hedefi doğru sanırsın (olay günü oldu).
//    dotenv kullan ve hedefi ekrana yazdır.

import "dotenv/config";
import { spawnSync } from "node:child_process";

const RESET = "\x1b[0m", RED = "\x1b[31m", YEL = "\x1b[33m", GRN = "\x1b[32m", DIM = "\x1b[2m";

if (process.env.SKIP_PREFLIGHT === "1") {
  console.log(`${YEL}⚠ preflight ATLANDI (SKIP_PREFLIGHT=1) — üretim migration kontrolü yapılmadı.${RESET}`);
  process.exit(0);
}

const url = process.env.PROD_DATABASE_URL;
const direct = process.env.PROD_DIRECT_URL;

if (!url || !direct) {
  // Üretim bilgisi olmayan bir kopyada (CI, yeni geliştirici) kapı anlamsız — engelleme.
  console.log(`${DIM}preflight: PROD_DATABASE_URL/PROD_DIRECT_URL yok — üretim kontrolü atlandı.${RESET}`);
  process.exit(0);
}

/** Hedefi İNSANA göster: yanlış veritabanına bakıp "temiz" demek en tehlikeli sonuç. */
function endpointOf(u) {
  const m = /@([^/]+)\//.exec(u);
  return m ? m[1].split(".")[0] : "(çözülemedi)";
}
console.log(`${DIM}preflight → üretim hedefi: ${endpointOf(url)} (pooler) · ${endpointOf(direct)} (direct)${RESET}`);

const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: direct };

function status() {
  return spawnSync("npx", ["prisma", "migrate", "status"], {
    shell: true, encoding: "utf8", env,
  });
}

let r = status();
let out = `${r.stdout ?? ""}${r.stderr ?? ""}`;

// Neon soğuk başlangıcı: ilk çağrı P1001 verip ikincisi geçebiliyor (olay günü aynen oldu).
if (/P1001|Can't reach database server/i.test(out)) {
  console.log(`${DIM}preflight: veritabanı uyanmıyor olabilir, bir kez daha deneniyor…${RESET}`);
  r = status();
  out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

const unreachable = /P1001|Can't reach database server/i.test(out);
const pending = /have not yet been applied|following migration/i.test(out);
const upToDate = /Database schema is up to date/i.test(out);

if (unreachable) {
  console.error(`\n${RED}⛔ PUSH DURDURULDU — üretim veritabanına ulaşılamadı.${RESET}`);
  console.error(`   Bekleyen migration olup olmadığı DOĞRULANAMADI; "bilinmiyor" ile "temiz" aynı şey değil.`);
  console.error(`   Bağlantı düzelince tekrar dene. Bilinçli olarak atlamak için:  ${DIM}SKIP_PREFLIGHT=1 git push${RESET}\n`);
  process.exit(1);
}

if (pending) {
  const list = out.split("\n").filter((l) => /^\s*\d{14}_/.test(l)).map((l) => l.trim());
  console.error(`\n${RED}⛔ PUSH DURDURULDU — üretimde BEKLEYEN migration var.${RESET}`);
  for (const m of list) console.error(`   • ${m}`);
  console.error(`\n   Push = Vercel'de otomatik dağıtım. Yeni kolonu okuyan kod, kolonu olmayan`);
  console.error(`   üretime giderse P2022 ile çöker (2026-08-20 kesintisi tam olarak buydu).`);
  console.error(`\n   ${GRN}Doğru sıra:${RESET}`);
  console.error(`     1) node scripts/apply-prod-migration.mjs   ${DIM}# üretime uygula (bilinçli işlem)${RESET}`);
  console.error(`     2) git push                                ${DIM}# kod sonra${RESET}`);
  console.error(`\n   Migration'dan bağımsız bir push olduğuna EMİNSEN: ${DIM}SKIP_PREFLIGHT=1 git push${RESET}\n`);
  process.exit(1);
}

if (!upToDate) {
  console.error(`\n${RED}⛔ PUSH DURDURULDU — migrate status çıktısı yorumlanamadı.${RESET}`);
  console.error(out.split("\n").slice(-12).join("\n"));
  console.error(`\n   Atlatma: ${DIM}SKIP_PREFLIGHT=1 git push${RESET}\n`);
  process.exit(1);
}

console.log(`${GRN}✓ preflight: üretim şeması güncel — bekleyen migration yok.${RESET}`);
process.exit(0);
