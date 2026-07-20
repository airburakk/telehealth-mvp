"use client";

import { useState } from "react";
import DicomViewer from "@/components/DicomViewer";
import { ScanLine } from "lucide-react";

// Havuz DICOM görüntüleme düğmesi (v6.32) — server-render'lı talep kartlarına gömülen client leaf.
// src = auth'lu ham-DICOM endpoint'i (yalnız tag-strip'li anonim dosyayı akıtır); mevcut DicomViewer açar.
// Metinler kullanıcı onaylı (2026-07-20).
export function ConsultDicomButton({ requestId, docId, label = "Görüntüle (DICOM)" }: { requestId: string; docId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40 hover:text-[var(--c-ink)]"
      >
        <ScanLine size={13} className="text-[var(--c-accent)]" /> {label}
      </button>
      <DicomViewer open={open} src={open ? `/api/consultation-requests/${requestId}/documents/${docId}/raw` : undefined} onClose={() => setOpen(false)} />
    </>
  );
}
