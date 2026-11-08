import { FamilyMedicineSourceStatus } from "@/components/FamilyMedicineSourceStatus";
import { WorkflowWorkbench } from "./WorkflowWorkbench";
import { REPORT_WORKFLOWS, ASM_WORKFLOWS, workflowPublicationGate } from "@/lib/family-medicine-workflows";
import Link from "next/link";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { FAMILY_MEDICINE_RESOURCES, FAMILY_MEDICINE_ENTRY_POINTS, familyMedicineSourceReviewLabels } from "@/lib/family-medicine";

export const metadata = { title: "Aile Hekimliği" };

// The parent Doctorium layout enforces membership and role access.
export default function FamilyMedicinePage() {
  const blockers = Object.fromEntries([...REPORT_WORKFLOWS, ...ASM_WORKFLOWS].map(w => [w.id, workflowPublicationGate(w, new Date()).blockers]));
  return (
    <DoctoriumShell active="akis" counts={{}}>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-xs font-semibold tracking-widest text-[var(--c-accent)]">BİRİNCİ BASAMAK</p>
        <h1 className="aura-display mt-2 text-3xl font-medium">Aile Hekimliği çalışma alanı</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--c-ink-2)]">Günlük işinizde güvenilir kaynağa daha kısa yoldan ulaşın. Uzmanlığınızdan bağımsız olarak birinci basamakta çalışıyorsanız bu alanı kullanabilirsiniz.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link href="/doktor/doctorium/tercihler" className="rounded-xl bg-[var(--c-accent)] px-4 py-2 font-semibold text-[var(--c-bg)]">Çalışma alanımı ve akışımı özelleştir</Link>
          <Link href="/doktor/doctorium" className="rounded-xl border border-[var(--c-hairline)] px-4 py-2">Akışıma dön</Link>
        </div>
        <section aria-labelledby="workspace-tools" className="mt-8">
          <h2 id="workspace-tools" className="text-xl font-semibold">Çalışma masanız</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FAMILY_MEDICINE_ENTRY_POINTS.map(item => (
              <Link key={item.href} href={item.href} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 hover:border-[var(--c-accent)]">
                <h3 className="font-semibold">{item.title} →</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-2)]">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
        <WorkflowWorkbench blockers={blockers} />
        <FamilyMedicineSourceStatus />
        <section aria-labelledby="source-shelf" className="mt-8">
          <h2 id="source-shelf" className="text-xl font-semibold">Hızlı kaynak rafı</h2>
          <p className="mt-2 text-sm text-[var(--c-ink-2)]">Bu raf kaynak bağlantıları sunar; klinik olarak onaylanmış işlem kartı veya güncellik garantisi değildir. Her kaynağın sürümünü ve yürürlük tarihini uygulama öncesi kontrol edin. Teknik bağlantı kontrolü yalnız erişilebilirliği gösterir; güncellik veya klinik editör onayı anlamına gelmez.</p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {FAMILY_MEDICINE_RESOURCES.map(item => {
              const review = familyMedicineSourceReviewLabels(item.review);
              return (
              <li key={item.id} className="rounded-2xl border border-[var(--c-hairline)] p-5">
                <p className="text-xs text-[var(--c-accent)]">{item.kind} · {item.publisher}</p>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-2)]">{item.description}</p>
                <dl className="mt-3 space-y-1 border-t border-[var(--c-hairline)] pt-3 text-xs leading-relaxed text-[var(--c-ink-2)]">
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
        <aside className="mt-8 rounded-2xl border border-[var(--c-hairline)] p-5 text-sm leading-relaxed text-[var(--c-ink-2)]">
          <h2 className="font-semibold text-[var(--c-ink)]">Güvenli kullanım</h2>
          <p className="mt-2">Hasta adı, kimlik numarası veya sağlık dosyası paylaşmayın. Bu alan AHBS/HYP sistemlerinin, resmî kayıtların veya klinik kararın yerine geçmez. Rapor ve ASM hazırlık masası yalnız kaynak inceleme taslağıdır. Klinik işlem kartları hekim ve mevzuat incelemesi tamamlanmadan kullanıma sunulmaz.</p>
        </aside>
      </div>
    </DoctoriumShell>
  );
}