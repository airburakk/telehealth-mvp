"use client";

// Gece temalı onay diyaloğu — native confirm() yerine (tema tutarlılığı + gömülü tarayıcı/webview'da
// senkron diyalog kilitlenme riski yok; QA gözlemi 2026-07-12). Metinler çağırandan ÇEVRİLMİŞ gelir
// (useT çağıranda). Odak güvenli varsayılan olarak İptal'de; Esc = iptal, zemine tık = iptal.
import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean; // yıkıcı eylem: kırmızı onay + ikaz ikonu
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={busy ? undefined : onCancel} role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161719] p-5 shadow-xl"
      >
        {danger && <AlertTriangle className="text-rose-300" size={22} />}
        <p className={`text-sm leading-relaxed text-white/75 ${danger ? "mt-2.5" : ""}`}>{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-[#1E1F22] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              danger ? "bg-rose-600 text-white hover:bg-rose-500" : "bg-[#28C8D8] text-[#0D0E10] hover:bg-[#1FA9B8]"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
