import type { Metadata } from "next";
import { Newspaper, CalendarClock, Scale, ShieldOff } from "lucide-react";
import { BRANCH_LABELS } from "@/lib/procedures";
import { StudentGateForm } from "@/components/StudentGateForm";

export const dynamic = "force-dynamic";

// v6.95 — Tıp öğrencisi kaydı: vitrin footer'ından gelinen, doktor kaydından AYRI kayıt sayfası
// (kullanıcı kararı 2026-08-14; 2026-08-17'de SALT KAYIT — gömülü giriş formu kaldırıldı, giriş
// /kurumsal-giris'ten). Doktor belgeleri (diploma/MMSS/tabip odası) bu hunide HİÇ görünmez; tek
// belge e-Devlet öğrenci belgesidir (onboarding öğrenci modu).
// noindex: personel/üyelik kapıları arama sonuçlarından ayrık tutulur (kurumsal-giris kararıyla
// tutarlı); indekslemeye açmak ayrı kullanıcı kararı.
export const metadata: Metadata = {
  // Kök layout şablonu "· AURA" ekler → marka tekrarı yazılmaz.
  title: "Tıp Öğrencisi Kaydı",
  description: "Tıp öğrencileri için Doctorium üyeliği — kayıt.",
  robots: { index: false, follow: false },
};

export default function StudentGatePage() {
  const branches = Object.values(BRANCH_LABELS).sort((a, b) => a.localeCompare(b, "tr"));
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md">
        <StudentGateForm branches={branches} />

        {/* Kapsam kutusu — dürüst dil: neyin açık, neyin kapalı olduğu açıkça yazılır
            (vitrin iddia disiplini: ölçüsüz vaat yok, kapalı yüzeyler saklanmaz). */}
        <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
          <div className="text-sm font-semibold text-[var(--c-ink)]">Öğrenci üyelikte neler var?</div>
          <ul className="mt-2 space-y-2 text-xs text-[var(--c-ink-2)]">
            <li className="flex items-start gap-2">
              <Newspaper size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
              <span><strong className="text-[var(--c-ink)]">Branş haber akışı ve akademik içerik</strong> — ilgilendiğiniz branşın gündemi, sizin ritminizde.</span>
            </li>
            <li className="flex items-start gap-2">
              <CalendarClock size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
              <span><strong className="text-[var(--c-ink)]">Kongre takvimi</strong> — bildiri ve erken kayıt tarihleriyle ulusal/uluslararası kongreler.</span>
            </li>
            <li className="flex items-start gap-2">
              <Scale size={14} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
              <span><strong className="text-[var(--c-ink)]">Hukuk, içtihat ve doktrin</strong> — sağlık hukuku mevzuatı, Yargıtay kararları ve hakemli makaleler.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldOff size={14} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
              <span>
                Öğrenci üyelikte <strong className="text-[var(--c-ink)]">sponsorlu içerik, anketler ve ödül puanları gösterilmez</strong>;
                klinik yüzeyler (hasta verisi, vaka havuzları) kapalıdır. Mezun olduğunuzda
                diplomanızla aynı hesaptan doktor üyeliğine geçersiniz.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
