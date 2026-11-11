"use client";

import { useState } from "react";
import { Button } from "../Button";
import { REPORT_WORKFLOWS, ASM_WORKFLOWS } from "@/lib/family-medicine-workflows";
import { FAMILY_MEDICINE_RESOURCES } from "@/lib/family-medicine";

/** No patient fields, uploads, network requests or persisted checklist answers. */
export function WorkflowWorkbench({ blockers }: { blockers: Record<string, string[]> }) {
  const [kind, setKind] = useState<"report" | "asm">("report");
  const [selectedId, setSelectedId] = useState(REPORT_WORKFLOWS[0].id);
  const [checked, setChecked] = useState<number[]>([]);
  const catalog = kind === "report" ? REPORT_WORKFLOWS : ASM_WORKFLOWS;
  const selected = catalog.find(w => w.id === selectedId) ?? catalog[0];
  function choose(next: "report" | "asm") {
    setKind(next); setSelectedId((next === "report" ? REPORT_WORKFLOWS : ASM_WORKFLOWS)[0].id); setChecked([]);
  }
  return (
    <section aria-labelledby="workflow-workbench" className="mt-8 border-t border-[var(--c-hairline)] pt-6">
      <p className="aura-mono text-[10px] font-bold tracking-[0.14em] text-[var(--c-ink-2)]">TASLAK · İNCELEME BEKLİYOR</p>
      <h2 id="workflow-workbench" className="aura-display mt-2 text-xl font-medium tracking-tight">Rapor ve ASM hazırlık masası</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">Bu bölüm kaynak araştırmasını düzenler. Klinik işlem listesi, denetim sonucu veya rapor düzenleme aracı değildir. Hasta bilgisi girilmez. İşaretler yalnız bu ekran açıkken tutulur ve onay sayılmaz.</p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Hazırlık türü">
        <Button type="button" variant={kind === "report" ? "primary" : "secondary"} aria-pressed={kind === "report"} onClick={() => choose("report")}>Rapor hazırlığı</Button>
        <Button type="button" variant={kind === "asm" ? "primary" : "secondary"} aria-pressed={kind === "asm"} onClick={() => choose("asm")}>ASM kontrol hazırlığı</Button>
      </div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="workflow-topic">İncelenecek başlık</label>
      <select id="workflow-topic" value={selected.id} onChange={e => { setSelectedId(e.target.value); setChecked([]); }} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3 text-sm text-[var(--c-ink)] focus-visible:outline-2 focus-visible:outline-[var(--c-accent)]">
        {catalog.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
      </select>
      <h3 className="mt-5 font-semibold">{selected.title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{selected.summary}</p>
      <h4 className="mt-4 text-sm font-semibold">Kaynak incelemesine hazırlık</h4>
      <ul className="mt-2 space-y-3">
        {selected.preparationQuestions.map((question, index) => <li key={`${selected.id}-${index}`}>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#065f46]" checked={checked.includes(index)} onChange={() => setChecked(current => current.includes(index) ? current.filter(i => i !== index) : [...current, index])} /><span>{question}</span></label>
        </li>)}
      </ul>
      <p role="status" className="mt-3 text-xs text-[var(--c-ink-2)]">{checked.length}/{selected.preparationQuestions.length} hazırlık notu işaretlendi. Klinik veya hukuki onay değildir.</p>
      <button type="button" onClick={() => setChecked([])} className="mt-2 text-sm underline">İşaretleri temizle</button>
      <div className="mt-5 border-t border-[var(--c-hairline)] pt-4">
        <h4 className="text-sm font-semibold">Başvuru kaynakları</h4>
        <ul className="mt-2 space-y-2 text-sm">{selected.sourceIds.map(id => {
          const source = FAMILY_MEDICINE_RESOURCES.find(s => s.id === id);
          return source ? <li key={id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title} ↗<span className="sr-only"> (yeni sekme)</span></a></li> : null;
        })}</ul>
        {selected.sourceGap && <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{selected.sourceGap}</p>}
      </div>
      <details className="mt-5 border-y border-[var(--c-hairline)] py-4">
        <summary className="cursor-pointer text-sm font-semibold">Uygulama neden açılmadı? Editoryal inceleme durumu</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{(blockers[selected.id] ?? ["İnceleme kaydı bulunamadı."]).map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p className="mt-3 text-xs">Bu ekrandaki işaretler yayın engellerini kaldırmaz. Kaynak maddeleri, sürüm, yürürlük ve yetkili inceleme kayıtları tamamlanmadan klinik uygulama açılmaz.</p>
      </details>
    </section>
  );
}
