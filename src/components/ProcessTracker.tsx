import type { ReactNode } from "react";
import { Check, CircleDot, Circle } from "lucide-react";

export type TrackerState = "done" | "active" | "pending";
export interface TrackerItem {
  label: string;
  subStatus: string;
  state: TrackerState;
  icon?: ReactNode;
}

// Gruplu süreç takip göstergesi (hasta-yüzü). Akış-bağımsız: çağıran `items`'ı (faz + güncel
// alt-durum + done/active/pending) hazırlar. SO/Talk to Doctor/Pro Bono aynı bileşeni kullanır.
export function ProcessTracker({ items, dir = "ltr" }: { items: TrackerItem[]; dir?: "ltr" | "rtl" }) {
  return (
    <div dir={dir} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const node =
          it.state === "done" ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={16} /></span>
          ) : it.state === "active" ? (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#14C3D0]/20 text-[#0E8A95]"><CircleDot size={16} /></span>
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-slate-400"><Circle size={16} /></span>
          );
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              {node}
              {!last && <div className={`w-0.5 flex-1 ${it.state === "done" ? "bg-emerald-300" : "bg-slate-200"}`} style={{ minHeight: 14 }} />}
            </div>
            <div className={last ? "" : "pb-3"}>
              <p className={`flex items-center gap-1.5 text-sm font-medium ${it.state === "pending" ? "text-slate-400" : "text-slate-800"}`}>
                {it.icon}
                {it.label}
              </p>
              <p className={`mt-0.5 text-[13px] ${it.state === "active" ? "font-medium text-[#0E8A95]" : "text-slate-500"}`}>{it.subStatus}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
