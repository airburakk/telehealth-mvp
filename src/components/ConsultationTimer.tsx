"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

// Görüşme süre göstergesi — yatay "tüp": süre ilerledikçe dolar, renk eşiklere göre değişir.
// 0–15 dk yeşil · 15–25 dk turuncu · 25 dk+ kırmızı. Doktor görünümünde, video bağlanır bağlanmaz devreye girer.
const MAX_MIN = 30; // tüpün tamamen dolduğu süre (25 dk kırmızı eşiğinin üstünde "ne kadar aşıldı" alanı kalsın)
const GREEN_MIN = 15; // bu dakikaya kadar yeşil
const ORANGE_MIN = 25; // bu dakikaya kadar turuncu, sonrası kırmızı

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// startTime: video bağlantısının kurulduğu epoch (ms). active=false ise süre dondurulur (görüşme bitti).
export function ConsultationTimer({ startTime, active }: { startTime: number; active: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedSec = Math.max(0, Math.floor((now - startTime) / 1000));
  const elapsedMin = elapsedSec / 60;
  const pct = Math.min(100, (elapsedMin / MAX_MIN) * 100);

  const zone = elapsedMin < GREEN_MIN ? "green" : elapsedMin < ORANGE_MIN ? "orange" : "red";
  const fillClass =
    zone === "green" ? "from-emerald-400 to-emerald-500"
    : zone === "orange" ? "from-orange-400 to-orange-500"
    : "from-red-500 to-red-600";
  const textClass =
    zone === "green" ? "text-emerald-600" : zone === "orange" ? "text-orange-600" : "text-red-600";
  const zoneLabel =
    zone === "green" ? "İdeal süre" : zone === "orange" ? "Süre uzuyor" : "Süre aşıldı";

  return (
    <div
      role="timer"
      aria-label={`Görüşme süresi ${fmt(elapsedSec)} — ${zoneLabel}`}
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        {/* Süre okuması */}
        <div className={`flex shrink-0 items-center gap-1.5 ${textClass}`}>
          <Timer size={16} className={zone === "red" ? "animate-pulse" : ""} />
          <span className="font-mono text-lg font-bold leading-none tabular-nums">{fmt(elapsedSec)}</span>
        </div>

        {/* Tüp — süre ilerledikçe dolar */}
        <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
          {/* Eşik işaretleri (15 dk, 25 dk) */}
          <span className="absolute inset-y-0 z-10 w-px bg-slate-300/70" style={{ left: `${(GREEN_MIN / MAX_MIN) * 100}%` }} />
          <span className="absolute inset-y-0 z-10 w-px bg-slate-300/70" style={{ left: `${(ORANGE_MIN / MAX_MIN) * 100}%` }} />
          {/* Dolum */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${fillClass} transition-[width] duration-1000 ease-linear ${zone === "red" ? "animate-pulse" : ""}`}
            style={{ width: `${pct}%` }}
          >
            {/* Camsı üst yansıma — tüp hissi */}
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/25" />
          </div>
        </div>

        {/* Bölge etiketi */}
        <span className={`shrink-0 text-xs font-semibold ${textClass}`}>{zoneLabel}</span>
      </div>
    </div>
  );
}
