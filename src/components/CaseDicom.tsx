"use client";

import { useState } from "react";
import DicomViewer from "@/components/DicomViewer";
import { ScanLine, FileImage } from "lucide-react";

export interface DicomStudy { url: string; label: string; modality: string }

export function CaseDicom({ studies }: { studies: DicomStudy[] }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | undefined>(undefined);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <ScanLine size={15} /> Radyoloji (DICOM)
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {studies.map((s) => (
          <li key={s.url}>
            <button
              onClick={() => { setSrc(s.url); setOpen(true); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 hover:border-teal-400 hover:bg-teal-50/50"
            >
              <span className="inline-flex items-center gap-2"><FileImage size={16} className="text-teal-600" /> {s.label}</span>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{s.modality}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-400">
        Görüntüleyicide: pencere/seviye (sürükle), yakınlaştır, kesit gezinme (tekerlek), renk tersle. Sıkıştırmasız BT/MR.
      </p>
      <DicomViewer open={open} src={src} onClose={() => setOpen(false)} />
    </div>
  );
}
