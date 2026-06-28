"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

// Admin/Etik Kurul — hekimi doğrula (verified:true). Başarıda liste tazelenir (hekim listeden düşer).
export function VerifyButton({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function verify() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/doctors/${doctorId}/verify`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Doğrulanamadı.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={verify}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Doğrula
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
