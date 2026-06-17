"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake, Loader2, Users } from "lucide-react";

// Pro Bono bekleme odası — eşleşene kadar poll eder; eşleşince görüşme odasına yönlendirir.
function WaitingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const caseId = sp.get("caseId");
  const [pos, setPos] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("WAITING");

  useEffect(() => {
    if (!caseId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pro-bono/waiting?caseId=${caseId}`);
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        if (d.status === "MATCHED" && d.consultationId) {
          router.push(`/gorusme/${d.consultationId}`);
          return;
        }
        setStatus(d.status ?? "WAITING");
        if (d.status === "WAITING") setPos(typeof d.queuePos === "number" ? d.queuePos : null);
      } catch {
        /* ağ hatası — sonraki tick tekrar dener */
      }
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [caseId, router]);

  if (!caseId) {
    return <p className="text-sm text-slate-500">Geçersiz başvuru. Lütfen tekrar başvurun.</p>;
  }

  const ended = status !== "WAITING" && status !== "MATCHED";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#14C3D0]/10 text-[#0E8A95]">
        <HeartHandshake size={30} />
      </span>
      {ended ? (
        <>
          <h1 className="mt-5 text-xl font-bold text-[#101010]">Bu başvuru artık beklemede değil</h1>
          <p className="mt-2 text-sm text-slate-500">Durum: {status}. Vakalarınızdan takip edebilirsiniz.</p>
        </>
      ) : (
        <>
          <h1 className="mt-5 text-xl font-bold text-[#101010]">Gönüllü hekim aranıyor…</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Başvurunuz alındı. Müsait bir gönüllü hekimle eşleştiğinizde görüşme otomatik başlayacak — bu sayfayı açık tutun.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
            <Loader2 size={16} className="animate-spin text-[#14C3D0]" />
            {pos ? <span><Users size={13} className="mb-0.5 mr-1 inline" />Kuyruktaki sıranız: <b className="text-[#101010]">{pos}</b></span> : "Eşleşme bekleniyor"}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProBonoWaitingPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Suspense fallback={<div className="text-center text-sm text-slate-400">Yükleniyor…</div>}>
        <WaitingInner />
      </Suspense>
    </div>
  );
}
