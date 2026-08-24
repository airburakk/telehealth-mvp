import { Newspaper, CalendarClock, Scale, ShieldOff } from "lucide-react";

// Öğrenci üyelik kapsam kutusu — /ogrenci (AURA) + /doctorium/ogrenci ORTAK (2026-08-24,
// ayrışma Faz B'de bileşenleştirildi; iki sayfada kopya kutu = kaçınılmaz drift,
// chrome-routes.ts'in başındaki ders). Dürüst dil: neyin açık, neyin kapalı olduğu açıkça
// yazılır (vitrin iddia disiplini — ölçüsüz vaat yok, kapalı yüzeyler saklanmaz).
// Server bileşeni: "use client" formlardan bilinçli AYRI dosya (client modülünden statik
// içerik export'u client-reference üretir — [[rsc-client-module-data-export]]).
export function StudentScopeCard() {
  return (
    <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
      <div className="text-sm font-semibold text-[var(--c-ink)]">Öğrenci üyelikte neler var?</div>
      <ul className="mt-2 space-y-2 text-xs text-[var(--c-ink-2)]">
        <li className="flex items-start gap-2">
          <Newspaper size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
          <span><strong className="text-[var(--c-ink)]">Branş haber akışı ve akademik içerik</strong> — ilgilendiğiniz branşın gündemi, sizin ritminizde.</span>
        </li>
        <li className="flex items-start gap-2">
          <CalendarClock size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
          <span><strong className="text-[var(--c-ink)]">Etkinlik takvimi</strong> — bildiri ve erken kayıt tarihleriyle kongre, sempozyum ve kurslar.</span>
        </li>
        <li className="flex items-start gap-2">
          <Scale size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
          <span><strong className="text-[var(--c-ink)]">Hukuk, içtihat ve doktrin</strong> — sağlık hukuku mevzuatı, Yargıtay kararları ve hakemli makaleler.</span>
        </li>
        <li className="flex items-start gap-2">
          <ShieldOff size={14} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
          <span>
            Öğrenci üyelikte <strong className="text-[var(--c-ink)]">sponsorlu içerik, anketler ve ödül puanları gösterilmez</strong>;
            klinik yüzeyler kapalıdır. Mezun olduğunuzda diplomanızla aynı hesaptan doktor
            üyeliğine geçersiniz.
          </span>
        </li>
      </ul>
    </div>
  );
}
