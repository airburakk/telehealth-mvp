"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Loader2 } from "lucide-react";

// Görüşmeyi Başlat — sunucu reddi (403 yetki · 409 durum/yarış) artık GÖRÜNÜR hata metnidir; eskiden
// sessizce eski hâle dönüyordu (kontrol raporu 2026-09-19 D03).
export function StartConsultButton({ caseId, label = "Görüşmeyi Başlat" }: { caseId: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/consult`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.consultationId) {
        router.push(`/gorusme/${data.consultationId}`);
        return;
      }
      setError(typeof data.error === "string" ? data.error : "Görüşme başlatılamadı. Lütfen tekrar deneyin.");
    } catch {
      setError("Bağlantı hatası — görüşme başlatılamadı.");
    }
    setLoading(false);
  }

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? <Loader2 size={17} className="animate-spin" /> : <Video size={17} />}
        {label}
      </button>
      {error && <p role="alert" className="max-w-xs text-xs leading-relaxed text-[var(--c-danger)]">{error}</p>}
    </div>
  );
}
