import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Plane, ArrowLeft } from "lucide-react";
import { TourismOutreachForm } from "@/components/TourismOutreachForm";

// Doktor sağlık turizmi havuzu (2026-07-14): branşına düşen tourism-Case'ler (status NEW).
// Doktor tanıtım mesajı + opsiyonel video randevu teklifi gönderir (TourismOutreachForm → API).
// PHI (patientName/symptoms) burada gösterilmez — ilk temas öncesi özet; doktor tam bilgi için
// "Vaka detayı"na (/doktor/vaka/[id], kendi BOLA/decrypt kapısıyla) gider.
export default async function DoctorTourismPoolPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/kurumsal-giris");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { id: true, branch: true } })
    : null;
  if (!doctor) redirect("/doktor");

  const cases = await db.case.findMany({
    where: { branch: doctor.branch, tourismPlan: { not: null }, status: "NEW" },
    select: { id: true, country: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const outreaches = cases.length
    ? await db.tourismOutreach.findMany({
        where: { doctorId: doctor.id, caseId: { in: cases.map((c) => c.id) } },
        select: { caseId: true, status: true, proposedAt: true },
      })
    : [];
  const byCase = new Map<string, { status: string; proposedAt: string | null }[]>();
  for (const o of outreaches) {
    const arr = byCase.get(o.caseId) ?? [];
    arr.push({ status: o.status, proposedAt: o.proposedAt ? o.proposedAt.toISOString() : null });
    byCase.set(o.caseId, arr);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana sayfa
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-xl font-bold text-[var(--c-ink)]">
        <Plane size={20} className="text-[var(--c-accent-strong)]" /> Sağlık Turizmi Havuzu
      </h1>
      <p className="mt-1 text-sm text-[var(--c-ink-2)]">
        {doctor.branch} branşınıza düşen yurtdışı hasta talepleri. Tanıtım mesajı ve video görüşme randevu teklifi
        gönderebilirsiniz. Hasta gelen teklifler arasından birini seçer; görüşme sonrası tedavi kararı → acente
        süreci aynen işler.
      </p>

      {cases.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--c-hairline)] p-6 text-center text-sm text-[var(--c-ink-2)]">
          Şu an branşınızda bekleyen sağlık turizmi talebi yok.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {cases.map((c) => (
            <li key={c.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-[var(--c-ink)]">Sağlık turizmi talebi · {c.country}</div>
                  <div className="text-xs text-[var(--c-ink-3)]">
                    {new Date(c.createdAt).toLocaleDateString("tr-TR")} · #{c.id.slice(0, 8)}
                  </div>
                </div>
                <Link href={`/doktor/vaka/${c.id}`} className="shrink-0 text-xs font-medium text-[var(--c-accent-strong)] hover:underline">
                  Vaka detayı →
                </Link>
              </div>
              <TourismOutreachForm caseId={c.id} previous={byCase.get(c.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
