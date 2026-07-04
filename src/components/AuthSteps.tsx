// İki-adım hasta başlangıç çerçevesi göstergesi: Giriş → Yol seçimi.
// /giris (active=0) ve /basla (active=1) üstünde ortak → login ile yol seçimi tek akış gibi hissettirir.
// Pure/presentational (hook yok) → hem sunucu (/giris) hem istemci (/basla BaslaCards) render edebilir.
// Etiketler caller'dan gelir (çağıran kendi dil bağlamında çevirir).
export function AuthSteps({ active, labels }: { active: 0 | 1; labels: readonly [string, string] }) {
  return (
    <ol aria-label="Başlangıç adımları" className="mb-6 flex items-center justify-center gap-2 text-xs">
      {labels.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
              i === active
                ? "bg-[#14C3D0] text-[#101010]"
                : i < active
                  ? "bg-[#14C3D0]/20 text-[#0E8A95]"
                  : "bg-slate-100 text-slate-400"
            }`}
            aria-current={i === active ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={i === active ? "font-semibold text-[#101010]" : "text-slate-400"}>{s}</span>
          {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
        </li>
      ))}
    </ol>
  );
}
