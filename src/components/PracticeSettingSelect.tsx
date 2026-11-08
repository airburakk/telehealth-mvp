"use client";
import { PRACTICE_SETTINGS } from "@/lib/doctorium-practice";

/** Independent, optional Doctorium preference. Never infers a specialty or subscribes the user. */
export function PracticeSettingSelect({ value, onChange, className }: {
  value: string; onChange: (value: string) => void; className?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink-2)]">Çalışma alanınız (isteğe bağlı)</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={className}>
        <option value="">Belirtmek istemiyorum</option>
        {PRACTICE_SETTINGS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <span className="mt-1 block text-xs leading-relaxed text-[var(--c-ink-3)]">Uzmanlık branşınızdan bağımsızdır. Akış, e-posta veya bülten aboneliği açmaz. Daha sonra Özelleştir bölümünden değiştirebilirsiniz.</span>
    </label>
  );
}
