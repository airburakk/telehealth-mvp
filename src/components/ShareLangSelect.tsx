"use client";

// Paylaşım görüntüleyici dil seçici — alıcı (yurt dışı hekim, girişsiz) kayıtları kendi dilinde görür.
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
    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500" title="Dil / Language">
      {pending ? <Loader2 size={14} className="animate-spin text-[#14C3D0]" /> : <Globe size={14} />}
      <select
        value={current}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          start(() => router.replace(v === "Türkçe" ? pathname : `${pathname}?lang=${encodeURIComponent(v)}`, { scroll: false }));
        }}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#14C3D0] disabled:opacity-60"
        aria-label="Dil / Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </label>
  );
}
