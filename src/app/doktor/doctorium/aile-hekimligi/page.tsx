import { FamilyMedicineSourceStatus } from "@/components/FamilyMedicineSourceStatus";
import { WorkflowWorkbench } from "./WorkflowWorkbench";
import { REPORT_WORKFLOWS, ASM_WORKFLOWS, workflowPublicationGate } from "@/lib/family-medicine-workflows";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { ButtonLink } from "../Button";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { FAMILY_MEDICINE_RESOURCES, FAMILY_MEDICINE_ENTRY_POINTS, familyMedicineSourceReviewLabels } from "@/lib/family-medicine";

export const metadata = { title: "Aile Hekimliği" };

// The parent Doctorium layout enforces membership and role access.
export default function FamilyMedicinePage() {
  const blockers = Object.fromEntries([...REPORT_WORKFLOWS, ...ASM_WORKFLOWS].map(w => [w.id, workflowPublicationGate(w, new Date()).blockers]));
  return (
    <DoctoriumShell active="akis" counts={{}}>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/doktor/doctorium" className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"><ArrowLeft size={15} aria-hidden="true" /> Akışıma dön</Link>
        <p className="doctorium-module-eyebrow aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-accent)]">BİRİNCİ BASAMAK</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <h1 className="aura-display min-w-0 flex-1 basis-[26rem] text-3xl font-medium tracking-tight text-[var(--c-ink)]">Aile Hekimliği çalışma alanı</h1>
          <ButtonLink href="/doktor/doctorium/tercihler" variant="secondary" size="sm" className="shrink-0"><SlidersHorizontal size={16} aria-hidden="true" /> Özelleştir</ButtonLink>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--c-ink-2)]">Günlük işinizde güvenilir kaynağa daha kısa yoldan ulaşın. Uzmanlığınızdan bağımsız olarak birinci basamakta çalışıyorsanız bu alanı kullanabilirsiniz.</p>
        <section aria-labelledby="workspace-tools" className="mt-8">
          <h2 id="workspace-tools" className="aura-mono flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--c-ink-3)] after:h-px after:flex-1 after:bg-[var(--c-hairline)]">Çalışma masanız</h2>
          <div className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {FAMILY_MEDICINE_ENTRY_POINTS.map(item => (
              <Link key={item.href} href={item.href} className="group border-b border-[var(--c-hairline)] py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--c-accent)]">
                <h3 className="aura-display flex items-center justify-between gap-3 text-[17px] font-semibold tracking-[-0.018em] group-hover:text-[var(--c-accent)]">{item.title}<ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-[var(--c-ink-3)]" /></h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <WorkflowWorkbench blockers={blockers} />
        <FamilyMedicineSourceStatus />
        <section aria-labelledby="source-shelf" className="mt-8">
          <h2 id="source-shelf" className="aura-display text-xl font-medium tracking-tight">Hızlı kaynak rafı</h2>
          <p className="mt-2 text-sm text-[var(--c-ink-2)]">Bu raf kaynak bağlantıları sunar; klinik olarak onaylanmış işlem kartı veya güncellik garantisi değildir. Her kaynağın sürümünü ve yürürlük tarihini uygulama öncesi kontrol edin. Teknik bağlantı kontrolü yalnız erişilebilirliği gösterir; güncellik veya klinik editör onayı anlamına gelmez.</p>
          <ul className="mt-4 divide-y divide-[var(--c-hairline)]">
            {FAMILY_MEDICINE_RESOURCES.map(item => {
              const review = familyMedicineSourceReviewLabels(item.review);
              return (
              <li key={item.id} className="py-6">
                <p className="aura-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--c-accent)]">{item.kind} · {item.publisher}</p>
                <h3 className="aura-display mt-2 text-[17px] font-semibold leading-[1.32] tracking-[-0.018em]">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{item.description}</p>
                <dl className="mt-3 space-y-1 text-xs leading-relaxed text-[var(--c-ink-2)]">
                  <div><dt className="inline font-semibold">Kaynak sürümü: </dt><dd className="inline">{review.version}</dd></div>
                  <div><dt className="inline font-semibold">Son teknik bağlantı kontrolü: </dt><dd className="inline">{review.technical}</dd></div>
                  <div><dt className="inline font-semibold">Klinik editör incelemesi: </dt><dd className="inline">{review.clinical}</dd></div>
                </dl>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">Kaynağı aç <span className="sr-only">(yeni sekme)</span> ↗</a>
              </li>
              );
            })}
          </ul>
        </section>
        <aside className="mt-8 border-t border-[var(--c-hairline)] pt-5 text-[13px] leading-relaxed text-[var(--c-ink-2)]">
          <h2 className="font-semibold text-[var(--c-ink)]">Güvenli kullanım</h2>
          <p className="mt-2">Hasta adı, kimlik numarası veya sağlık dosyası paylaşmayın. Bu alan AHBS/HYP sistemlerinin, resmî kayıtların veya klinik kararın yerine geçmez. Rapor ve ASM hazırlık masası yalnız kaynak inceleme taslağıdır. Klinik işlem kartları hekim ve mevzuat incelemesi tamamlanmadan kullanıma sunulmaz.</p>
        </aside>
      </div>
    </DoctoriumShell>
  );
}