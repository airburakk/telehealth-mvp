// AURA logosu — kullanıcının GERÇEK logosu (public/aura-symbol.png + aura-word-*.png).
// Sembol ve wordmark kullanıcının orijinal görselinden ayıklandı (scripts/extract-logo.py). Elle çizim / font YOK.
// Açık zeminde lacivert wordmark, koyu zeminde beyaz. Landing + iç uygulama Header'ı ortak kullanır.

// Yalnız sembol — kullanıcının gerçek logosu (şeffaf PNG; cyan, her zeminde çalışır).
export function AuraMark({ size = 26 }: { size?: number }) {
  const s = Math.round(size * 1.18);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/aura-symbol.png" alt="" width={s} height={s} style={{ display: "block" }} />;
}

// Dönen AURA sembolü — bekleme göstergesi. Dönüş ekseni, sembolün GÖRSEL merkezi olan
// ortadaki ÜÇGENİN ağırlık merkezine sabitlenir (%53.95 / %56.37 — aura-symbol.png 504×504
// tuvalinde piksel analiziyle ölçüldü; 3 damlanın dönel-simetri merkeziyle ~3px örtüşür).
// Aksi halde kare PNG kendi geometrik merkezinde (%50/%50) döner ve işaret yalpalar.
export function AuraSpinner({ size = 48, durationMs = 2400, className = "" }: { size?: number; durationMs?: number; className?: string }) {
  const s = Math.round(size * 1.18);
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/aura-symbol.png"
      alt=""
      width={s}
      height={s}
      className={`animate-spin ${className}`.trim()}
      style={{ transformOrigin: "53.95% 56.37%", animationDuration: `${durationMs}ms` }}
    />
  );
}

export function PortamedLogo({ size = 24, ink = "#101010" }: { size?: number; ink?: string }) {
  const onDark = ink === "#FFFFFF" || ink === "#fff" || ink === "white";
  const wordH = Math.round(size * 0.6);
  return (
    <span className="inline-flex items-center" style={{ lineHeight: 1 }}>
      <AuraMark size={size} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onDark ? "/aura-word-dark.png" : "/aura-word-light.png"}
        alt="AURA"
        height={wordH}
        style={{ display: "block", height: wordH, width: "auto", marginLeft: Math.round(size * 0.3) }}
      />
    </span>
  );
}
