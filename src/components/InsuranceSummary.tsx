import { formatUSD, type InsuranceQuote, type InsuranceLevel } from "@/lib/pricing";
import { ShieldCheck } from "lucide-react";

// M3 — Booking.insuranceDetail (JSON InsuranceQuote) → 3 kademeli sigorta teminat özeti.
// Teklif + rezervasyon sayfalarında ortak kullanılır. Endikatif (bağlayıcı primi sigortacı belirler).
const LEVEL_LABEL: Record<InsuranceLevel, string> = {
  1: "Zorunlu Sağlık Turizmi Sigortası",
  2: "+ Operasyon Teminat Poliçesi",
  3: "+ Malpraktis & Komplikasyon Teminatı",
};

export function InsuranceSummary({ detailJson }: { detailJson: string | null }) {
  if (!detailJson) return null;
  let q: InsuranceQuote;
  try { q = JSON.parse(detailJson) as InsuranceQuote; } catch { return null; }
  if (!q || typeof q.level !== "number") return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <ShieldCheck size={14} /> Sigorta Teminatı · Seviye {q.level} — {LEVEL_LABEL[q.level]}
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <Row k="Zorunlu sağlık turizmi sigortası" v={formatUSD(q.p1)} />
        {q.level >= 2 && (
          <Row k={`Operasyon teminat poliçesi · taban ${formatUSD(q.coverageBase)}`} v={`+${formatUSD(q.p2)}`} />
        )}
        {q.level >= 3 && (
          <>
            <Row k={`Malpraktis & komplikasyon · hedef ${formatUSD(q.targetCoverage)}`} v={q.p3 > 0 ? `+${formatUSD(q.p3)}` : "ek prim yok"} />
            <p className="text-[11px] leading-relaxed text-slate-400">
              {q.gap === 0
                ? `Hekimin mevcut MMSS poliçesi (${formatUSD(q.doctorCoverage)}) hedef teminatı karşılıyor → ek malpraktis primi yok.`
                : `Hekimin mevcut MMSS poliçesi ${formatUSD(q.doctorCoverage)} karşılıyor; kalan ${formatUSD(q.gap)} boşluk ek teminatla kapatıldı.`}
            </p>
          </>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold">
        <span className="text-slate-700">Sigorta toplam</span>
        <span className="text-slate-900">{formatUSD(q.total)}</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
        Primler tahminidir; bağlayıcı poliçe bedelini ve teminat şartlarını sigorta şirketi belirler.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-600">{k}</span>
      <span className="shrink-0 font-medium text-slate-800">{v}</span>
    </div>
  );
}
