import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getDoctorBalance, REWARD_KIND_LABEL, REDEMPTION_STATUS_LABEL, REWARD_TERMS_TEXT,
} from "@/lib/rewards";
import { isStudentOnly } from "@/lib/doctor-activation";
import { RewardCatalog } from "./RewardCatalog";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { ArrowLeft, Info, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Puanlarım" };

// Ödül puanları sayfası (v6.88) — Doctorium segment layout'u Aşama-1 kapısını zaten uygular;
// buradaki rol kontrolü derinlik savunmasıdır. Yalnız DOCTOR: puan hesabı doktor kimliğine
// bağlıdır (COORDINATOR/ADMIN gözetimi Doctorium akışını görür, kişisel puan sayfasını değil).
// ⚖️ Koşul metni (REWARD_TERMS_TEXT) kaldırılamaz: puanın parasal değer taşımadığı ve ifanın
// insan onaylı olduğu her görüntülemede açıkça söylenir (vitrin iddia dürüstlüğü disiplini).
export default async function RewardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "DOCTOR") redirect("/doktor/doctorium");
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) redirect("/doktor");
  const doctorId = me.doctorId;
  // v6.95: öğrenci-sınırlı üyeye ödül yüzeyi kapalı (rozet/link zaten çizilmez — URL ile doğrudan
  // gelişe karşı derinlik savunması; akış sayfasına geri gönderilir).
  const d = await db.doctor.findUnique({
    where: { id: doctorId },
    select: { activatedAt: true, studentVerifiedAt: true },
  });
  if (!d || isStudentOnly(d)) redirect("/doktor/doctorium");

  const [balance, items, redemptions, entries] = await Promise.all([
    getDoctorBalance(doctorId),
    db.rewardItem.findMany({
      where: { active: true },
      orderBy: [{ pointsCost: "asc" }, { createdAt: "desc" }],
      select: { id: true, kind: true, title: true, description: true, pointsCost: true },
    }),
    db.rewardRedemption.findMany({
      where: { doctorId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, status: true, pointsCost: true, note: true, adminNote: true, createdAt: true,
        item: { select: { title: true, kind: true } },
      },
    }),
    db.pointEntry.findMany({
      where: { doctorId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, delta: true, reason: true, createdAt: true },
    }),
  ]);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <DoctoriumShell active="oduller" balance={balance} isDoctor>
    {/* px-5 = /doktor içerik boşluğu (hiza kararı 2026-08-14): başlıklar sekmeler arasında aynı x'te. */}
    <div className="max-w-2xl px-5 py-8">
      {/* Masaüstünde dönüş banttadır (Faz 1); bu link yalnız mobil için. */}
      <Link
        href="/doktor/doctorium"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)] md:hidden"
      >
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <Star size={22} className="text-emerald-300" /> Puanlarım
      </h1>

      {/* Bakiye — stat/KPI: Inter bold, kit üstünde (Aura kit disiplini) */}
      <div className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Kullanılabilir puan</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--c-ink)]">{balance}</p>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          Anketleri yanıtladıkça puan birikir; katalogdaki ödüller için talep oluşturabilirsiniz.
        </p>
      </div>

      <RewardCatalog
        balance={balance}
        kindLabel={REWARD_KIND_LABEL}
        statusLabel={REDEMPTION_STATUS_LABEL}
        items={items}
        redemptions={redemptions.map((r) => ({
          id: r.id, status: r.status, pointsCost: r.pointsCost, note: r.note,
          adminNote: r.adminNote, createdAt: iso(r.createdAt),
          itemTitle: r.item.title, itemKind: r.item.kind,
        }))}
      />

      {/* Kazanç/harcama geçmişi — ledger'ın doktor-yüzü özeti */}
      <h2 className="mt-8 text-sm font-semibold text-[var(--c-ink)]">Puan hareketleri</h2>
      <ul className="mt-2 grid gap-1.5">
        {entries.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-5 text-center text-xs text-[var(--c-ink-3)]">
            Henüz puan hareketi yok — Doctorium akışındaki anketleri yanıtlayarak puan kazanabilirsiniz.
          </li>
        )}
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2 text-xs"
          >
            <span className="text-[var(--c-ink-2)]">
              {e.reason === "SURVEY" && "Anket yanıtı"}
              {e.reason === "REDEEM" && "Ödül talebi"}
              {e.reason === "REDEEM_REFUND" && "Talep iadesi"}
              {e.reason === "ADJUST" && "Düzeltme"}
            </span>
            <span className="flex items-center gap-3">
              <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{iso(e.createdAt)}</span>
              <span className={`aura-mono font-semibold tabular-nums ${e.delta >= 0 ? "text-emerald-300" : "text-[var(--c-ink-2)]"}`}>
                {e.delta >= 0 ? `+${e.delta}` : e.delta}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* ⚖️ Program koşulları (TASLAK) — kaldırılamaz bilgilendirme */}
      <p className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        <Info size={14} className="mt-px shrink-0" />
        <span>{REWARD_TERMS_TEXT}</span>
      </p>
    </div>
    </DoctoriumShell>
  );
}
