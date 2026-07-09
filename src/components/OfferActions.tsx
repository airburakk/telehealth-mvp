"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Printer, X } from "lucide-react";
import { useT } from "@/components/useT";

// Hasta teklifi aksiyonları — onayla (Escrow), PDF/yazdır, reddet. i18n: useT (lang OfferView'dan).
// Yazdırırken (print:hidden) bu çubuk gizlenir → temiz PDF belgesi.
const TEXTS = [
  "Teklifi reddetmek istediğinize emin misiniz?",
  "Teklif reddedildi. Koordinatör bilgilendirildi.",
  "Teklifi onayla · Escrow güvencesiyle",
  "PDF / Yazdır",
  "Reddet",
];

export function OfferActions({ bookingId, total, lang = "Türkçe" }: { bookingId: string; total: string; lang?: string }) {
  const router = useRouter();
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi
  const { t } = useT(lang, texts);
  const [busy, setBusy] = useState<null | "approve" | "decline">(null);
  const [declined, setDeclined] = useState(false);

  async function respond(action: "approve" | "decline") {
    if (action === "decline" && !confirm(t("Teklifi reddetmek istediğinize emin misiniz?"))) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (action === "approve" && data.ok) { router.push(`/rezervasyon/${bookingId}`); return; }
      if (action === "decline" && data.ok) { setDeclined(true); router.refresh(); return; }
      setBusy(null);
    } catch { setBusy(null); }
  }

  if (declined) {
    return <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-600">{t("Teklif reddedildi. Koordinatör bilgilendirildi.")}</div>;
  }

  return (
    <div className="print:hidden space-y-2">
      <button
        onClick={() => respond("approve")}
        disabled={!!busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy === "approve" ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        {t("Teklifi onayla · Escrow güvencesiyle")} ({total})
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => window.print()}
          disabled={!!busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Printer size={15} /> {t("PDF / Yazdır")}
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={!!busy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          {busy === "decline" ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} {t("Reddet")}
        </button>
      </div>
    </div>
  );
}
