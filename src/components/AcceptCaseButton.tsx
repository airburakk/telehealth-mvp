"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Loader2 } from "lucide-react";

// Vakayı üstlen (K06 1C-a): havuzdaki kimliksiz önizlemeden tam dosyaya geçiş. Sunucu reddi (403 yetki/branş · 409
// başkası üstlendi/durum) GÖRÜNÜR hata metnidir; başarıda sayfa yeniden çizilir (force-dynamic → tam görünüm).
export function AcceptCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/accept`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.accepted) {
        router.refresh();
        return;
      }
      setError(typeof data.error === "string" ? data.error : "Vaka üstlenilemedi. Lütfen tekrar deneyin.");
    } catch {
      setError("Bağlantı hatası — vaka üstlenilemedi.");
    }
    setLoading(false);
  }

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        onClick={accept}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? <Loader2 size={17} className="animate-spin" /> : <UserCheck size={17} />}
        Vakayı üstlen
      </button>
      {error && <p role="alert" className="max-w-xs text-xs leading-relaxed text-[var(--c-danger)]">{error}</p>}
    </div>
  );
}
