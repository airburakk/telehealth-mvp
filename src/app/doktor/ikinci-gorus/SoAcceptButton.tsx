"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

// İkinci Görüş — hoca "Kabul et": OFFERED dosyayı kabul/claim eder (atomik; ilk kabul eden alır).
export function SoAcceptButton({ caseId, open }: { caseId: string; open?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/second-opinion/cases/${caseId}/accept`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kabul edilemedi.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata.");
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-end">
      <button
        onClick={accept}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#28C8D8] px-4 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {open ? "Kabul et (açık)" : "Kabul et"}
      </button>
      {err && <p className="mt-1 max-w-[200px] text-xs text-red-600">{err}</p>}
    </div>
  );
}
