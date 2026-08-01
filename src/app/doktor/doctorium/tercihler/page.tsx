import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OPTIONS, parseBranchPrefs, slugForLabel } from "@/lib/doctorium";
import { BranchPicker } from "./BranchPicker";
import { ArrowLeft, SlidersHorizontal, Info } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium branş tercihleri (Modül A). Yalnız DOCTOR — personelin kendi branşı yok, akışı genel.
export default async function DoctoriumPrefsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "DOCTOR") redirect("/doktor/doctorium");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true, newsBranches: true } })
    : null;
  if (!doctor) redirect("/doktor");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <SlidersHorizontal size={22} className="text-emerald-300" /> Branş tercihleri
      </h1>
      <p className="mt-1 text-sm text-[var(--c-ink-2)]">
        Akışınızda hangi branşların yayınlarını görmek istediğinizi seçin. Birden fazla seçebilirsiniz.
      </p>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        Hiç seçim yapmazsanız akışınız kendi branşınıza ({doctor.branch}) göre oluşur. Mevzuat
        kalemleri branş ayrımı olmaksızın herkeste görünür.
      </p>

      <BranchPicker
        options={BRANCH_OPTIONS}
        initial={parseBranchPrefs(doctor.newsBranches)}
        ownSlug={slugForLabel(doctor.branch)}
      />
    </div>
  );
}
