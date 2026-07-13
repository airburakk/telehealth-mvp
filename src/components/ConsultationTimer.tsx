"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

// Görüşme süre göstergesi — yatay "tüp": süre ilerledikçe dolar, renk eşiklere göre değişir.
// Varsayılan (hasta-doktor görüşmesi): 0–15 dk yeşil · 15–25 dk turuncu · 25 dk+ kırmızı, tüp 30 dk'da dolar.
// FAZ 7 (2026-07-10): eşikler parametrik — partner-konsültasyon 10 dk varyantı (7'de kırmızı) aynı
// bileşeni maxMin/greenMin/orangeMin + labels ile kullanır; buradaki varsayılanlar DEĞİŞMEDİ.
const MAX_MIN = 30; // tüpün tamamen dolduğu süre (25 dk kırmızı eşiğinin üstünde "ne kadar aşıldı" alanı kalsın)
const GREEN_MIN = 15; // bu dakikaya kadar yeşil
const ORANGE_MIN = 25; // bu dakikaya kadar turuncu, sonrası kırmızı

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface TimerLabels { green: string; orange: string; red: string }

// startTime: video bağlantısının kurulduğu epoch (ms). active=false ise süre dondurulur (görüşme bitti).
export function ConsultationTimer({
  startTime, active, maxMin = MAX_MIN, greenMin = GREEN_MIN, orangeMin = ORANGE_MIN, labels,
}: {
  startTime: number; active: boolean;
  maxMin?: number; greenMin?: number; orangeMin?: number; // eşikler (dk) — greenMin===orangeMin → turuncu bölge atlanır
  labels?: TimerLabels; // bölge etiketleri (çevrilmiş geçilebilir); verilmezse TR varsayılanları
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedSec = Math.max(0, Math.floor((now - startTime) / 1000));
  const elapsedMin = elapsedSec / 60;
  const pct = Math.min(100, (elapsedMin / maxMin) * 100);

  const zone = elapsedMin < greenMin ? "green" : elapsedMin < orangeMin ? "orange" : "red";
  const fillClass =
    zone === "green" ? "from-emerald-400 to-emerald-500"
    : zone === "orange" ? "from-orange-400 to-orange-500"
    : "from-red-500 to-red-600";
  // Tema-duyarlı süre/etiket rengi (gündüz koyu ton · gece açık ton → her iki temada okunur;
  // eski sabit -300 tonları gündüz açık kart zemininde kayboluyordu).
  const textClass =
    zone === "green" ? "text-[var(--c-success)]" : zone === "orange" ? "text-[var(--c-warning)]" : "text-[var(--c-danger)]";
  const zoneLabel = labels
    ? labels[zone]
    : zone === "green" ? "İdeal süre" : zone === "orange" ? "Süre uzuyor" : "Süre aşıldı";

  return (
    <div
      role="timer"
      aria-label={`Görüşme süresi ${fmt(elapsedSec)} — ${zoneLabel}`}
      className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        {/* Süre okuması */}
        <div className={`flex shrink-0 items-center gap-1.5 ${textClass}`}>
          <Timer size={16} className={zone === "red" ? "animate-pulse" : ""} />
          <span className="font-mono text-lg font-bold leading-none tabular-nums">{fmt(elapsedSec)}</span>
        </div>

        {/* Tüp — süre ilerledikçe dolar */}
        <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-[var(--c-ink)]/10 ring-1 ring-inset ring-white/10">
          {/* Eşik işaretleri (yeşil→turuncu, turuncu→kırmızı geçişleri) */}
          <span className="absolute inset-y-0 z-10 w-px bg-[var(--c-ink)]/20" style={{ left: `${(greenMin / maxMin) * 100}%` }} />
          {orangeMin > greenMin && (
            <span className="absolute inset-y-0 z-10 w-px bg-[var(--c-ink)]/20" style={{ left: `${(orangeMin / maxMin) * 100}%` }} />
          )}
          {/* Dolum */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${fillClass} transition-[width] duration-1000 ease-linear ${zone === "red" ? "animate-pulse" : ""}`}
            style={{ width: `${pct}%` }}
          >
            {/* Camsı üst yansıma — tüp hissi */}
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-[var(--c-ink)]/25" />
          </div>
        </div>

        {/* Bölge etiketi */}
        <span className={`shrink-0 text-xs font-semibold ${textClass}`}>{zoneLabel}</span>
      </div>
    </div>
  );
}
