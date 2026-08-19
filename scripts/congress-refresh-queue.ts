// Kongre tazeleme KUYRUĞU (v6.62) — hangi kongrelerin bu hafta kontrol edilmesi gerektiğini
// KADEMEYE göre listeler. Araştırmayı kendisi YAPMAZ (web araması ajan işi); bu araç, tazeleme
// ajanına verilecek "iş listesini" üretir ve önceliklendirir.
//
// NEDEN KADEMELİ: 113 kongreyi her hafta taramak hem israf hem kurum sitelerine saygısızlık.
// Veri gerçeği farklı ritimler gösteriyor:
//   🔴 SICAK   — kritik tarihi (bildiri/erken kayıt) ≤90 gün içinde → HAFTALIK.
//                Gerekçe: bu tarihler UZATILIYOR (TOD bildiri tarihini 6 Temmuz'a uzatmıştı;
//                EAO son tarihi 12 Mayıs'a uzattı) — haftalık tarama yakalar, aylık kaçırır.
//   🟡 BEKLEYEN — sonraki edisyonu duyurulmamış (confidence=kismi / tarihi geçmiş) → AYLIK.
//   ⚪ TARİHSİZ — kaynakta VAR ama DB'ye hiç girmemiş (nextStart yok) → AYLIK.
//                🪤 v6.121'de bulundu: bu kuyruk yalnız DB'den okuyordu, seed ise `startDate`
//                zorunlu olduğu için tarihsiz satırları ATLIYOR — yani kaynaktaki 47 gerçek
//                kongre HİÇBİR kademede görünmüyordu, kimse onlara bakmıyordu. Kuyruk artık
//                seed KAYNAĞINI da okuyor; tarih duyurulunca kayıt DB'ye kendiliğinden girer.
//                Dernekler duyuruyu aylar önce yapar; haftalık bakmak boşa gider.
//   🟢 SOĞUK   — tarihi kesin, kritik tarih >90 gün → 3 AYLIK. Yer/tarih nadiren değişir.
//   ⚫ GEÇMİŞ  — başlangıcı geçmiş → arşivlenir + bir SONRAKİ edisyon arama kuyruğuna girer
//                (döngü kendi kendini besler: geçen kongre, gelecek kongrenin ipucudur).
//
// Kullanım:
//   npx tsx scripts/congress-refresh-queue.ts            → bu hafta bakılacaklar (özet)
//   npx tsx scripts/congress-refresh-queue.ts --json     → ajana verilecek makine-okunur liste
//   npx tsx scripts/congress-refresh-queue.ts --hepsi    → kademeye bakmadan tüm kayıtlar
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const AS_JSON = args.includes("--json");
const ALL = args.includes("--hepsi");

const DAY = 86400000;
const HOT_WINDOW_DAYS = 90; // kritik tarihe kalan gün eşiği
const TIER_INTERVAL_DAYS = { sicak: 7, bekleyen: 30, tarihsiz: 30, soguk: 90, gecmis: 30 } as const;

type Tier = keyof typeof TIER_INTERVAL_DAYS;

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

async function main() {
  const { db } = await import("../src/lib/db");
  const now = new Date();

  const rows = await db.medicalCongress.findMany({
    where: { source: "curated" }, // elle girilen kayıtlar küratörün sorumluluğunda, döngüye girmez
    select: {
      id: true, title: true, url: true, startDate: true, abstractDeadline: true,
      earlyBirdDeadline: true, confidence: true, verifiedAt: true, organizer: true, scope: true,
    },
    orderBy: { startDate: "asc" },
  });

  const queue: {
    tier: Tier; id: string; title: string; url: string | null; organizer: string | null;
    reason: string; lastVerifiedDaysAgo: number | null; ask: string;
  }[] = [];

  for (const c of rows) {
    const startIn = daysBetween(c.startDate, now);
    const critical = [c.abstractDeadline, c.earlyBirdDeadline]
      .filter((d): d is Date => !!d)
      .map((d) => daysBetween(d, now))
      .filter((n) => n >= 0);
    const nearestCritical = critical.length ? Math.min(...critical) : null;

    let tier: Tier;
    let reason: string;
    let ask: string;
    if (startIn < 0) {
      tier = "gecmis";
      reason = `başlangıç ${-startIn} gün önce geçti`;
      ask = "Bir SONRAKİ edisyonun tarihi/yeri duyuruldu mu? Duyurulduysa yeni kayıt olarak ver.";
    } else if (nearestCritical !== null && nearestCritical <= HOT_WINDOW_DAYS) {
      tier = "sicak";
      reason = `kritik tarihe ${nearestCritical} gün`;
      ask = "Bildiri/erken kayıt tarihi UZATILDI mı? Ücretler yayımlandı mı? Tarih/yer değişti mi?";
    } else if (c.confidence === "kismi") {
      tier = "bekleyen";
      reason = "kayıt kısmi — edisyon/veri eksik";
      ask = "Eksik alanlar (tarih, şehir, kongre sitesi, bildiri/kayıt takvimi) artık ilan edildi mi?";
    } else {
      tier = "soguk";
      reason = `başlangıca ${startIn} gün`;
      ask = "Tarih/yer değişti mi? Bildiri ve kayıt takvimi açıldı mı?";
    }

    const lastVerifiedDaysAgo = c.verifiedAt ? daysBetween(now, c.verifiedAt) : null;
    const due = ALL || lastVerifiedDaysAgo === null || lastVerifiedDaysAgo >= TIER_INTERVAL_DAYS[tier];
    if (due) {
      queue.push({
        tier, id: c.id, title: c.title, url: c.url, organizer: c.organizer,
        reason, lastVerifiedDaysAgo, ask,
      });
    }
  }

  // ── ⚪ TARİHSİZ: seed KAYNAĞINDA olup DB'ye hiç girmemiş kayıtlar ────────────────────────
  // Bunlar `startDate` zorunlu olduğu için seed tarafından atlanır; DB'yi okuyan sorgu onları
  // ASLA göremez. Kaynağı ayrıca okumazsak gerçek ve düzenli kongreler sessizce takipsiz kalır.
  const kaynak = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data", "congresses.json"), "utf-8"),
  ) as { name: string; edition?: string | null; organizer?: string | null; officialUrl?: string | null; nextStart?: string | null; verifiedAt?: string | null }[];
  const tarihsizGorulen = new Set<string>();
  for (const r of kaynak) {
    if (r.nextStart) continue;
    const ad = `${r.edition ? `${r.edition} ` : ""}${r.name}`.trim();
    if (tarihsizGorulen.has(ad)) continue; // çok-branşlı satırlar aynı kongredir
    tarihsizGorulen.add(ad);
    queue.push({
      tier: "tarihsiz",
      id: `kaynak:${r.name}`,
      title: ad,
      url: r.officialUrl ?? null,
      organizer: r.organizer ?? null,
      reason: "sonraki edisyon DUYURULMAMIŞ — kaynakta var, DB'de yok",
      lastVerifiedDaysAgo: r.verifiedAt ? daysBetween(now, new Date(`${r.verifiedAt}T00:00:00Z`)) : null,
      ask: "Sonraki edisyonun tarihi ilan edildi mi? İlan edildiyse nextStart/nextEnd + bildiri ve erken kayıt tarihleri.",
    });
  }

  const order: Tier[] = ["sicak", "gecmis", "bekleyen", "tarihsiz", "soguk"];
  queue.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));

  if (AS_JSON) {
    console.log(JSON.stringify(queue, null, 1));
    await db.$disconnect();
    return;
  }

  const icon: Record<Tier, string> = { sicak: "🔴", gecmis: "⚫", bekleyen: "🟡", tarihsiz: "⚪", soguk: "🟢" };
  const counts = order.map((t) => `${icon[t]} ${t}: ${queue.filter((q) => q.tier === t).length}`);
  console.log(`\n📋 Tazeleme kuyruğu — ${queue.length} kayıt bakım istiyor (DB ${rows.length} · kaynakta tarihsiz ${tarihsizGorulen.size})`);
  console.log(`   ${counts.join(" · ")}\n`);
  for (const t of order) {
    const group = queue.filter((q) => q.tier === t);
    if (!group.length) continue;
    console.log(`${icon[t]} ${t.toUpperCase()} (her ${TIER_INTERVAL_DAYS[t]} günde bir)`);
    for (const q of group) {
      const age = q.lastVerifiedDaysAgo === null ? "hiç" : `${q.lastVerifiedDaysAgo}g önce`;
      console.log(`   · ${q.title.slice(0, 62)}`);
      console.log(`     ${q.reason} · son doğrulama ${age}${q.url ? ` · ${q.url}` : ""}`);
    }
    console.log("");
  }
  console.log("Sıradaki adım: bu listeyi tazeleme ajanına ver (--json). Ajan RESMÎ kaynaktan");
  console.log("doğrular, DEĞİŞEN alanları raporlar; bulunamayan alan BOŞ kalır (uydurma yok).");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
