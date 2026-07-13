"use client";

// Paylaşım görüntüleyici dil seçici — alıcı (yurt dışı doktor, girişsiz) kayıtları kendi dilinde görür.
// Çeviri sunucuda yapıldığı için dil ?lang search param'ı ile taşınır; seçim navigasyonu tetikler.
// useTransition: çeviri sürerken mevcut içerik görünür kalır + seçicide spinner döner (sayfa boşalmaz).
import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";

export function ShareLangSelect({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  return (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--c-ink-2)]" title="Dil / Language">
      {pending ? <Loader2 size={14} className="animate-spin text-[var(--c-accent)]" /> : <Globe size={14} />}
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(() => router.replace(v === "Türkçe" ? pathname : `${pathname}?lang=${encodeURIComponent(v)}`, { scroll: false }));
        }}
        className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2 py-1.5 text-xs font-medium text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)] disabled:opacity-60"
        aria-label="Dil / Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </label>
  );
}
