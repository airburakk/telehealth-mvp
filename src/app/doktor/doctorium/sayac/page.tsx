import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  effectiveBranches, personalFeedPage, moduleFeed, localizeTitles, savedArticleIds,
  todayModuleCounts, trDayStart, parseViewPrefs,
  FM_TO_MODULES, PULSE_LABELS, SECTOR_SOURCE_SCOPES,
  type FeedItem,
} from "@/lib/doctorium";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { ArticleCard } from "../ArticleCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sayaç" };

/**
 * SAYAÇ SAYFASI (v6.162, kullanıcı isteğinin NİHAİ biçimi — dördüncü tur: "sayaçta neye
 * tıklarsam bana AYRI BİR SAYFADA sadece tıkladığım sayıdaki içeriği göster"): Akışım'daki
 * PulseStrip rakamı artık ne sekmeye gider ne akışı yerinde süzer — bu sayfayı açar ve
 * YALNIZ sayacın saydığı içerikleri listeler.
 *
 *  · Taze mod (?n=1 — "BUGÜN AKIŞA DÜŞEN"): o modülün BUGÜN eklenen kayıtları
 *    (createdAt ≥ trDayStart, sayaçla aynı eksen; sayaç modülü branşsız saydığı için liste de
 *    branşsız — sayı ile liste birebir örtüşür). Etkinlik/Kariyer bu modda sayılamaz
 *    (todayModuleCounts yalnız haber tablolarını sayar) → bileşim moduna düşer.
 *  · Bileşim modu ("AKIŞINDA"): akışın ilk partisindeki o modül kartlarının AYNISI —
 *    personalFeedPage tek modülle çağrılır; modül kotası ilk partiyle aynı olduğundan küme
 *    sayaçtaki sayıyla birebir örtüşür. Sonsuz kaydırma BİLİNÇLİ YOK: sayfanın vaadi
 *    "tıkladığın sayıdaki içerik", açık uçlu liste değil.
 *
 * ?fm= yerinde-süzme (v6.161) altyapısı URL özelliği olarak yaşamaya devam eder; görünür
 * yüzeydeki sayaç bağlantıları artık buraya gelir. Layout (../layout.tsx) Aşama-1 kapısını
 * kurar; buradaki rol kontrolü derinlik savunmasıdır (proje kuralı).
 */
export default async function SayacPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; n?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const key = sp.m && FM_TO_MODULES[sp.m] ? sp.m : null;
  if (!key) redirect("/doktor/doctorium");

  const doctor =
    user.role === "DOCTOR"
      ? await db.user
          .findUnique({ where: { id: user.id }, select: { doctorId: true } })
          .then((me) =>
            me?.doctorId
              ? db.doctor.findUnique({
                  where: { id: me.doctorId },
                  select: { id: true, branch: true, newsBranches: true, doctoriumViewPrefs: true },
                })
              : null,
          )
      : null;
  const branches = effectiveBranches(doctor?.newsBranches, doctor?.branch);
  // Sektörel kaynak tercihi burada da işler (Akışım'la aynı sözleşme — sayaç da süzülmüş akışı sayar).
  const srcScope = parseViewPrefs(doctor?.doctoriumViewPrefs).sektorel.source;
  const sektorelSources = srcScope ? SECTOR_SOURCE_SCOPES[srcScope] : undefined;

  // Taze mod yalnız haber modüllerinde (sayaçla aynı sınır); etkinlik/kariyer bileşime düşer.
  const NEWS_DB_MODULE: Record<string, "akademik" | "sektorel" | "ilac" | "mevzuat"> = {
    akademik: "akademik", sektorel: "sektorel", ilac: "ilac", mevzuat: "mevzuat",
  };
  const fresh = sp.n === "1" && key in NEWS_DB_MODULE;

  let items: FeedItem[] = fresh
    ? await moduleFeed(NEWS_DB_MODULE[key], [], {
        // limit 100: sayaç 99+ tavanıyla gösterir — backfill günü bile liste sayıyı kapsar.
        createdSince: trDayStart(), limit: 100,
        sources: key === "sektorel" ? sektorelSources : undefined,
      })
    : (await personalFeedPage(branches, FM_TO_MODULES[key], {}, 40, { sektorelSources })).items;
  if (items.length) items = await localizeTitles(items);

  const savedIds = user.role === "DOCTOR" && doctor ? await savedArticleIds(doctor.id) : null;
  const counts = await todayModuleCounts();
  const label = PULSE_LABELS[key];

  return (
    <DoctoriumShell active="akis" counts={counts}>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/doktor/doctorium"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
        >
          <ArrowLeft size={15} /> Akışım
        </Link>

        <div className="mt-5">
          <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-emerald-300">
            {fresh ? "BUGÜN AKIŞA DÜŞEN" : "AKIŞINDA"}
          </div>
          <h1 className="aura-display mt-1 text-2xl font-bold tracking-tight text-[var(--c-ink)]">
            {items.length} {label}
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--c-ink-2)]">
            {fresh
              ? "Sayacın saydığı, bugün akışına eklenen kayıtlar — hepsi bu kadar."
              : "Sayacın saydığı, akışındaki kayıtlar — hepsi bu kadar."}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
            Bu görünümde şu an içerik yok. Akış her gece güncellenir.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-[minmax(0,1fr)]">
            {items.map((it, i) => (
              <ArticleCard
                key={it.id}
                item={it}
                saved={savedIds ? savedIds.has(it.id) : null}
                weight={i === 0 ? "lead" : "mid"}
              />
            ))}
          </ul>
        )}
      </div>
    </DoctoriumShell>
  );
}
