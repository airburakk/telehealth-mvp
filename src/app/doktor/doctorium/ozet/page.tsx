import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Newspaper, Settings2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDoctorBalance } from "@/lib/rewards";
import { isStudentOnly } from "@/lib/doctor-activation";
import { todayModuleCounts } from "@/lib/doctorium";
import { DIGEST_NAME, formatTrDate, type DigestSnapshot } from "@/lib/daily-digest";
import { DoctoriumShell } from "../DoctoriumSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Doctorium Post" };

/**
 * DOCTORIUM POST — günlük özet ("sabah gazetesi") sayfası (2026-08-24).
 * Tasarım: vault output/doctorium-gunluk-ozet-tasarimi-2026-08-24.md §5.
 *
 * Baskı DailyDigest ANLIK GÖRÜNTÜSÜNDEN okunur, akıştan yeniden hesaplanmaz — e-posta ile web
 * aynı baskıyı gösterir (gün içi yeni ingest baskıyı değiştirmez). ?d=YYYY-MM-DD arşiv günü
 * seçer (son 7 baskı listelenir). Bildirim zili ve e-postadaki "portalda okuyun" buraya gelir.
 *
 * Erişim: segment layout'u DOCTOR/COORDINATOR/ADMIN kapısını uygular; baskı Doctor satırına
 * bağlı olduğu için ayrıca doktor profili şartı var (tercihler sayfasıyla aynı desen).
 */
export default async function OzetPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) redirect("/doktor/doctorium");

  const doctor = await db.doctor.findUnique({
    where: { id: me.doctorId },
    select: { digestChannel: true, activatedAt: true, studentVerifiedAt: true },
  });
  if (!doctor) redirect("/doktor");
  const balance = isStudentOnly(doctor) ? null : await getDoctorBalance(me.doctorId);

  const sp = await searchParams;
  const recent = await db.dailyDigest.findMany({
    where: { doctorId: me.doctorId },
    orderBy: { createdAt: "desc" },
    take: 7,
    select: { day: true, itemCount: true, itemsJson: true, createdAt: true },
  });
  const wanted = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : null;
  const current = (wanted ? recent.find((r) => r.day === wanted) : recent[0]) ?? null;

  let snapshot: DigestSnapshot | null = null;
  if (current) {
    try {
      snapshot = JSON.parse(current.itemsJson) as DigestSnapshot;
    } catch {
      snapshot = null; // bozuk anlık görüntü — boş durumla aynı muamele (baskı çökertmez)
    }
  }

  return (
    <DoctoriumShell active={null} balance={balance} isDoctor counts={await todayModuleCounts()}>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link
          href="/doktor/doctorium"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
        >
          <ArrowLeft size={15} /> Akışıma dön
        </Link>

        {/* Masthead — tipografik gazete başlığı (e-posta baskısıyla aynı ses) */}
        <header className="mt-6 border-b-[3px] border-double border-[var(--c-ink)] pb-4 text-center">
          <h1 className="aura-display text-[34px] font-bold tracking-[0.14em] text-[var(--c-ink)]">
            DOCTORIUM <span className="text-emerald-400">POST</span>
          </h1>
          <p className="aura-mono mt-1.5 text-[11px] tracking-[0.16em] text-[var(--c-ink-3)] uppercase">
            {current ? formatTrDate(current.day) : "Kişisel sabah özetiniz"}
            {current ? ` · ${current.itemCount} başlık` : ""}
          </p>
        </header>

        {/* Arşiv şeridi — son baskılar */}
        {recent.length > 1 && (
          <nav aria-label="Önceki baskılar" className="mt-4 flex flex-wrap justify-center gap-2">
            {recent.map((r) => (
              <Link
                key={r.day}
                href={r.day === recent[0].day ? "/doktor/doctorium/ozet" : `/doktor/doctorium/ozet?d=${r.day}`}
                className={`aura-mono rounded-full border px-2.5 py-1 text-[10.5px] tracking-wider ${
                  current?.day === r.day
                    ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                    : "border-[var(--c-hairline)] text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"
                }`}
              >
                {formatTrDate(r.day)}
              </Link>
            ))}
          </nav>
        )}

        {!current || !snapshot ? (
          <div className="mt-10 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-8 text-center">
            <Newspaper size={26} className="mx-auto text-[var(--c-ink-3)]" aria-hidden />
            {doctor.digestChannel ? (
              <>
                <h2 className="mt-3 text-[16px] font-semibold text-[var(--c-ink)]">İlk baskınız hazırlanıyor</h2>
                <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">
                  {DIGEST_NAME} her sabah, gece akışınıza düşen başlıklardan derlenir. Aboneliğiniz
                  açık — ilk baskınız bir sonraki sabah burada olacak. İçeriği olmayan sakin
                  günlerde baskı çıkmaz.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-[16px] font-semibold text-[var(--c-ink)]">{DIGEST_NAME}&apos;a abone değilsiniz</h2>
                <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">
                  Her sabah, akış tercihlerinize göre derlenen kişisel bir özet: gece akışınıza
                  düşen başlıklar bölüm bölüm tek sayfada. Aboneliği Akış Tercihleri sayfasından
                  açabilirsiniz.
                </p>
                <Link
                  href="/doktor/doctorium/tercihler"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-500/10 px-3.5 py-2 text-[13px] font-semibold text-emerald-300 hover:bg-emerald-500/15"
                >
                  <Settings2 size={14} /> Akış Tercihleri&apos;ne git
                </Link>
              </>
            )}
          </div>
        ) : (
          <article className="mt-2">
            {snapshot.sections.map((s) => (
              <section key={s.key} className="mt-8">
                <h2 className="aura-mono border-b border-[var(--c-hairline)] pb-1.5 text-[11px] font-bold tracking-[0.22em] text-emerald-300 uppercase">
                  {s.label}
                </h2>
                <div>
                  {s.items.map((it) => (
                    <div key={it.id} className="border-b border-[var(--c-hairline)] py-4 last:border-b-0">
                      <Link
                        href={`/doktor/doctorium/${it.id}`}
                        className="aura-display block text-[18px] leading-snug font-semibold text-[var(--c-ink)] hover:underline hover:underline-offset-[3px]"
                      >
                        {it.title}
                      </Link>
                      <div className="aura-mono mt-1 text-[10.5px] tracking-wider text-[var(--c-ink-3)] uppercase">
                        {it.sourceName}
                      </div>
                      {it.summary && (
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">{it.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {snapshot.overflow > 0 && (
              <p className="mt-8 text-center">
                <Link
                  href="/doktor/doctorium?n=1"
                  className="text-[13.5px] font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  Bu baskıya sığmayan {snapshot.overflow} başlık daha akışınızda →
                </Link>
              </p>
            )}

            <footer className="mt-10 border-t border-[var(--c-hairline)] pt-4 text-center">
              <p className="text-[11.5px] leading-relaxed text-[var(--c-ink-3)]">
                Bu baskı akış tercihlerinize göre derlendi · sponsorlu içerik ve anketler baskıya
                girmez · <Link href="/doktor/doctorium/tercihler" className="text-emerald-300/90 hover:text-emerald-200">tercihleri yönet</Link>
              </p>
            </footer>
          </article>
        )}
      </div>
    </DoctoriumShell>
  );
}
