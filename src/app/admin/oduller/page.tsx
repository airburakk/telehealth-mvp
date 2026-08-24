import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { REWARD_KIND_LABEL, REDEMPTION_STATUS_LABEL } from "@/lib/rewards";
import { RewardAdmin } from "./RewardAdminForm";
import { ArrowLeft, Gift, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ödül Kataloğu" };

// Ödül kataloğu + talep kuyruğu küratör paneli (v6.88) — /admin/kampanya deseni.
// ⚖️ KALEM GİRİŞİ = VAAT BAŞLANGICI: kongre/kitap AYNİ MENFAATTİR — vergi (arızi kazanç/stopaj)
// + kamu doktoru (657 hediye/ek-menfaat) değerlendirmesi yapılmadan kalem YAYINLAMAYIN (bilgi
// kutusu). Puana parasal değer atfeden metin hiçbir yüzeyde kurulmaz. İLAÇ sponsorlu kalem YOK.
export default async function RewardAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const [items, redemptions] = await Promise.all([
    db.rewardItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, kind: true, title: true, description: true, pointsCost: true,
        active: true, createdAt: true,
        _count: { select: { redemptions: true } },
      },
    }),
    db.rewardRedemption.findMany({
      orderBy: { createdAt: "asc" }, // kuyruk: en eski talep önce karara bağlanır
      where: { status: { in: ["REQUESTED", "APPROVED"] } },
      take: 100,
      select: {
        id: true, status: true, pointsCost: true, note: true, adminNote: true, createdAt: true,
        item: { select: { title: true, kind: true } },
        doctorId: true,
      },
    }),
  ]);

  // Talep sahibi doktor adları (teslimat için) — tek sorguda toplu okunur.
  const doctorIds = [...new Set(redemptions.map((r) => r.doctorId))];
  const doctors = doctorIds.length
    ? await db.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: { id: true, name: true, title: true, city: true },
      })
    : [];
  const docById = new Map(doctors.map((d) => [d.id, d]));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Yönetim
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <Gift size={22} className="text-emerald-300" /> Ödül kataloğu
      </h1>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0 text-amber-300" />
        <span>
          Katalog kalemi girmek doktora <strong className="text-[var(--c-ink)]">ödül vaadi başlatır</strong>. Kongre
          katılımı ve kitap <strong className="text-[var(--c-ink)]">ayni menfaattir</strong>: vergi (arızi kazanç /
          stopaj / GİB özelgesi) ve <strong className="text-[var(--c-ink)]">kamu doktoru (657)</strong> değerlendirmesi
          tamamlanmadan kalem yayınlamayın. Puana parasal değer atfeden ifade kullanmayın
          (&quot;1 puan = ₺X&quot; yasak). İlaç firması sponsorlu kalem girilmez. Teslim (FULFILLED) işareti
          yalnız ifa GERÇEKLEŞTİKTEN sonra konur.
        </span>
      </p>

      <RewardAdmin
        kindLabel={REWARD_KIND_LABEL}
        statusLabel={REDEMPTION_STATUS_LABEL}
        items={items.map((it) => ({
          id: it.id, kind: it.kind, title: it.title, description: it.description,
          pointsCost: it.pointsCost, active: it.active, redemptions: it._count.redemptions,
        }))}
        queue={redemptions.map((r) => {
          const d = docById.get(r.doctorId);
          return {
            id: r.id, status: r.status, pointsCost: r.pointsCost, note: r.note,
            adminNote: r.adminNote, createdAt: iso(r.createdAt),
            itemTitle: r.item.title, itemKind: r.item.kind,
            doctorLabel: d ? `${d.title} ${d.name} · ${d.city}` : "Doktor kaydı bulunamadı",
          };
        })}
      />
    </div>
  );
}
