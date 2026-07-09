"use client";

// Escrow güven görselleştirmesi (Sağlık Turizmi FAZ 3) — milestone-bazlı ödeme akışı.
// Rezervasyon + teklif hasta-yüzü sayfalarında ortak kullanılır. Amaç: hastaya ödemesinin nasıl
// KORUNDUĞUNU göstermek (güven sinyali) + aynı anda MVP'nin gerçek para transferi yapmadığını
// GÖRÜNÜR biçimde bildirmek (tasarım §5 hukuki park — simülasyon disclaimer'ı zorunlu).
// escrowStatus: PENDING (teklif) → HELD (emanet) → RELEASED (aktarım) / REFUNDED (iade).
import { useMemo } from "react";
import { ShieldCheck, Lock, Wallet, CheckCircle2, RotateCcw, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/components/useT";

const TEXTS = [
  "Ödeme Güvencesi (Escrow)",
  "Ödeme onayı",
  "Paketi onaylayın",
  "Emanette",
  "Ödemeniz platform havuzunda güvende",
  "Hizmet sonrası aktarım",
  "Tedavi tamamlanınca taraflara aktarılır",
  "İade edildi",
  "Etik Kurul kararıyla hastaya iade",
  "Onayladığınızda ödemeniz aşağıdaki güvenli adımlardan geçer.",
  "Ödemeniz şu anda emanette — tedavi tamamlanana dek platform güvencesinde tutulur.",
  "Ödeme, hizmet tamamlandığı için taraflara aktarıldı.",
  "Ödeme, Etik Kurul kararıyla size iade edildi.",
  "Simülasyon — bu bir MVP gösterimidir; gerçek para transferi yapılmaz. Escrow akışı, tam entegrasyonda ödemenizin nasıl korunacağını gösterir.",
  "Sorun halinde iade Etik Kurul kararıyla yapılır.",
];

type StepState = "done" | "active" | "pending";
type Phase = "PENDING" | "HELD" | "RELEASED" | "REFUNDED";
const PHASES: Phase[] = ["PENDING", "HELD", "RELEASED", "REFUNDED"];

export function EscrowMilestones({ status, lang }: { status: string; lang: string }) {
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi ([[uset-unstable-texts-race]])
  const { t } = useT(lang, texts);

  const phase: Phase = PHASES.includes(status as Phase) ? (status as Phase) : "HELD";
  const refunded = phase === "REFUNDED";

  const steps: { key: string; icon: LucideIcon; label: string; desc: string; state: StepState }[] = [
    {
      key: "onay", icon: Wallet, label: t("Ödeme onayı"), desc: t("Paketi onaylayın"),
      state: phase === "PENDING" ? "active" : "done",
    },
    {
      key: "emanet", icon: Lock, label: t("Emanette"), desc: t("Ödemeniz platform havuzunda güvende"),
      state: phase === "PENDING" ? "pending" : phase === "HELD" ? "active" : "done",
    },
    refunded
      ? { key: "iade", icon: RotateCcw, label: t("İade edildi"), desc: t("Etik Kurul kararıyla hastaya iade"), state: "done" }
      : { key: "aktar", icon: CheckCircle2, label: t("Hizmet sonrası aktarım"), desc: t("Tedavi tamamlanınca taraflara aktarılır"), state: phase === "RELEASED" ? "done" : "pending" },
  ];

  const summary =
    refunded ? t("Ödeme, Etik Kurul kararıyla size iade edildi.")
      : phase === "PENDING" ? t("Onayladığınızda ödemeniz aşağıdaki güvenli adımlardan geçer.")
        : phase === "RELEASED" ? t("Ödeme, hizmet tamamlandığı için taraflara aktarıldı.")
          : t("Ödemeniz şu anda emanette — tedavi tamamlanana dek platform güvencesinde tutulur.");

  return (
    <div className="rounded-3xl border border-teal-200 bg-teal-50/50 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
        <ShieldCheck size={16} /> {t("Ödeme Güvencesi (Escrow)")}
      </div>

      {/* milestone stepper */}
      <ol className="mt-4 flex items-stretch gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const done = s.state === "done";
          const active = s.state === "active";
          return (
            <li key={s.key} className="min-w-0 flex-1">
              <div className="flex items-center">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    done
                      ? "bg-emerald-100 text-emerald-700"
                      : active
                        ? "bg-teal-600 text-white ring-4 ring-teal-200"
                        : "bg-white text-slate-300 ring-1 ring-slate-200"
                  }`}
                >
                  <Icon size={16} />
                </span>
                {i < steps.length - 1 && (
                  <span className={`mx-1 h-0.5 flex-1 rounded ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </div>
              <div className="mt-1.5">
                <div className={`text-xs font-semibold ${done ? "text-emerald-800" : active ? "text-teal-800" : "text-slate-400"}`}>{s.label}</div>
                <div className="text-[10px] leading-tight text-slate-400">{s.desc}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        {summary} {t("Sorun halinde iade Etik Kurul kararıyla yapılır.")}
      </p>

      {/* Simülasyon disclaimer — tasarım §5: simüle escrow'da görünür uyarı zorunlu (hukuki park) */}
      <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>{t("Simülasyon — bu bir MVP gösterimidir; gerçek para transferi yapılmaz. Escrow akışı, tam entegrasyonda ödemenizin nasıl korunacağını gösterir.")}</span>
      </div>
    </div>
  );
}
