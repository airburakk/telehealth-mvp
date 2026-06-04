import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PackageBuilder } from "@/components/PackageBuilder";
import { ArrowLeft, Luggage } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PackagePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href={`/doktor/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0f2a4a]">
        <ArrowLeft size={16} /> Vaka detayı
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f2a4a] text-white"><Luggage size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#0f2a4a]">Sağlık Turizmi Paketi</h1>
          <p className="text-sm text-slate-500">{c.patientName} · {c.branch} tedavisi için uçtan uca paket oluşturun.</p>
        </div>
      </div>

      <div className="mt-7">
        <PackageBuilder caseId={c.id} patientName={c.patientName} branch={c.branch} country={c.country} />
      </div>
    </div>
  );
}
