import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SO_DURATION_COPY, SO_FEE_USD } from "@/lib/second-opinion";
import { Stethoscope, Clock, Video } from "lucide-react";
import { SoApplyForm } from "./SoApplyForm";

export const dynamic = "force-dynamic";

// Second Opinion Ön Değerlendirme (§12.1) — ikinci görüş başvurusunun ilk adımı.
// Mevcut genel /triyaj'dan AYRI (paralel akış kararı). Süre metni tek kaynaktan (§12.2/§12.3).
export default async function SecondOpinionApplyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/basvur");
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect("/");

  const C = SO_DURATION_COPY.tr;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#0E8A95]">
        <Stethoscope size={15} /> İkinci Görüş
      </span>
      <h1 className="mt-4 text-3xl font-bold text-[#101010]">Second Opinion Ön Değerlendirme</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        Mevcut tanınıza ilişkin belgelerinizi yükleyin; alanında uzman bir hekim dosyanızı bağımsız
        olarak değerlendirsin. Süreç yazılı bir ikinci görüş ve ardından bir video görüşmeyle tamamlanır.
      </p>

      {/* §12.2 — "Ortalama süre" yerine süre bilgilendirmesi (tek kaynak: lib/second-opinion) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock size={14} /> {C.reportLabel}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#101010]">{C.reportValue}</div>
        </div>
        <div className="rounded-2xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0E8A95]">
            <Video size={14} /> Video görüşme
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{C.video}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Ücret: <strong className="text-[#101010]">{SO_FEE_USD} USD</strong> — peşin ve tek ödeme.
        Yazılı rapor ve video görüşme dahildir.
      </div>

      <SoApplyForm />
    </div>
  );
}
