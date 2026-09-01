"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

// Admin/Etik Kurul — doktoru doğrula (verified:true). Başarıda liste tazelenir (doktor listeden düşer).
//
// `diplomaVerified` (v6.196): onay artık diploma damgasına BAĞLI. Düğme burada devre dışı kalır ve
// GEREKÇESİNİ yazar — admin körlemesine tıklayıp API hatası görmesin. ⚠️ Asıl kapı API'dedir
// (verify/route.ts); burası yalnız ikinci katman + açıklama.
export function VerifyButton({ doctorId, diplomaVerified }: { doctorId: string; diplomaVerified: boolean }) {
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
        disabled={loading || !diplomaVerified}
        title={diplomaVerified ? undefined : "Önce DIPLOMA belgesini kabul edin"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Doğrula
      </button>
      {!diplomaVerified && (
        <span className="max-w-[15rem] text-right text-[11px] leading-snug text-amber-300">
          Diploma doğrulanmadan onaylanamaz — önce DIPLOMA belgesini inceleyip kabul edin.
        </span>
      )}
      {err && <span className="text-xs text-red-300">{err}</span>}
    </div>
  );
}
