import type { ReactNode } from "react";
import { AuraMark } from "@/components/PortamedLogo";

// Aura UI kiti — boş durum: kitteki tek "marka anı" (Doz 1 sözleşmesi gereği ışıma yok,
// yalnız AURA sembolü + display tipografi). Braille BURADA KULLANILMAZ — marka kuralı:
// Braille yalnız AURA wordmark'ının altında yaşar ([[aura-braille-under-wordmark]]).
export function EmptyState({
  title,
  sub,
  action,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-6 py-14 text-center ${className}`}>
      <AuraMark size={40} className="mx-auto opacity-70" />
      <div className="aura-display mt-5 text-lg font-medium tracking-tight text-[var(--c-ink)]">{title}</div>
      {sub && <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--c-ink-2)]">{sub}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
