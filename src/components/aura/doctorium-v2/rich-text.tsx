import { Fragment } from "react";
import { DoctoriumInline, DoctoriumOnEmerald } from "@/components/aura/doctorium-brand";

// "{Doctorium}" yer tutucusunu marka lockup'ına çevirir (content.ts sözleşmesi). Marka kuralı:
// "Doctorium" geçen HER metinde Doctor ink + ium zümrüt; zümrüt zeminli CTA'da Doctor BEYAZ
// (DoctoriumOnEmerald). 🪤 Çıktı TEK inline span'e sarılır — flex ebeveynde parçalar ayrı item
// olup aradaki boşluk düşerdi ([[aura-wordtext-flex-bosluk]]).
export function Rich({ text, onEmerald = false }: { text: string; onEmerald?: boolean }) {
  const parts = text.split("{Doctorium}");
  if (parts.length === 1) return <>{text}</>;
  return (
    <span>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (onEmerald ? <DoctoriumOnEmerald /> : <DoctoriumInline />)}
          {p}
        </Fragment>
      ))}
    </span>
  );
}

/** Düz metin (aria-label, title gibi yerler için) — yer tutucu marka adına çevrilir. */
export function plain(text: string): string {
  return text.replaceAll("{Doctorium}", "Doctorium");
}
