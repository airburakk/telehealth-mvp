"use client";

// "Koordinatörle konuş" — hasta rezervasyon/teklif sayfasından koordinatörle görüşme talep eder
// (Sağlık Turizmi FAZ 3). Önceki sürümde ölü buton (onClick/href yok) idi → gerçek talep-bildirimine
// bağlandı: POST /api/bookings/:id/contact-coordinator → notifyRoles(["COORDINATOR"]). i18n: useT.
import { useMemo, useState } from "react";
import { MessageCircle, Loader2, Check } from "lucide-react";
import { useT } from "@/components/useT";

const TEXTS = [
  "Koordinatörle konuş",
  "Talebiniz koordinatöre iletildi — en kısa sürede sizinle iletişime geçecekler.",
  "Gönderilemedi, lütfen tekrar deneyin.",
];

export function CoordinatorContact({ bookingId, lang }: { bookingId: string; lang: string }) {
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi
  const { t } = useT(lang, texts);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function send() {
    setState("busy");
    try {
      const res = await fetch(`/api/bookings/${bookingId}/contact-coordinator`, { method: "POST" });
      if (!res.ok) throw new Error();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex w-full items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
        <Check size={15} className="mt-0.5 shrink-0" /> {t("Talebiniz koordinatöre iletildi — en kısa sürede sizinle iletişime geçecekler.")}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={state === "busy"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-4 py-2.5 text-sm font-medium text-[var(--c-ink)] hover:bg-[var(--c-surface)] disabled:opacity-60"
      >
        {state === "busy" ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} {t("Koordinatörle konuş")}
      </button>
      {state === "error" && <p className="text-center text-xs text-red-300">{t("Gönderilemedi, lütfen tekrar deneyin.")}</p>}
    </>
  );
}
