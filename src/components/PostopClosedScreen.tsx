import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

// Post-op takip tamamlanmış vakada (E2EE Faz 2A) klinik personele gösterilen ekran — klinik veri YOK.
// Kontrol raporu 2026-09-17 K03: doktor detayından (doktor/vaka/[id]) buraya çıkarıldı; hasta vaka
// merkezi (/vaka/[caseId]) de personel için AYNI ekranı çizer — kapanış kuralı sayfa bazında tekrar yazılmaz.
export function PostopClosedScreen({ backHref = "/doktor", backLabel = "Vaka kuyruğu" }: { backHref?: string; backLabel?: string }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> {backLabel}
      </Link>
      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]"><Lock size={26} /></span>
        <h1 className="aura-display mt-4 text-lg font-medium tracking-tight text-[var(--c-ink)]">Post-op takip tamamlandı</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--c-ink-2)]">
          Bu vakanın post-op takip süreci kapandığı için klinik kayıtlara erişim hastaya devredilmiştir.
          Doktor/personel artık bu vakanın klinik içeriğini görüntüleyemez. Erişim olayları değiştirilemez denetim
          kaydında zaman damgalıdır.
        </p>
      </div>
    </div>
  );
}
