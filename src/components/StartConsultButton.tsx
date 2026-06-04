"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Loader2 } from "lucide-react";

export function StartConsultButton({ caseId, label = "Görüşmeyi Başlat" }: { caseId: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/consult`, { method: "POST" });
      const data = await res.json();
      if (data.consultationId) router.push(`/gorusme/${data.consultationId}`);
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {loading ? <Loader2 size={17} className="animate-spin" /> : <Video size={17} />}
      {label}
    </button>
  );
}
