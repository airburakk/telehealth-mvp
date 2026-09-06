import type { ComponentType, SVGProps } from "react";

// Doctorium sosyal hesapları — TEK KAYNAK (2026-09-04, kullanıcı isteği). Instagram + X canlı
// hesaplarla doğrulandı: @doctoriumtr / @Doctoriumtr — marka İngilizce yazımını korur (Doctorium,
// "Doktorium" DEĞİL; "doktor" yazım refleksiyle karışmasın). LinkedIn şirket sayfası 2026-09-06'da
// açıldı (kullanıcı verdi: linkedin.com/company/doctoriumtr).
export const DOCTORIUM_SOCIAL_LINKS: readonly { key: string; label: string; href: string }[] = [
  { key: "instagram", label: "Instagram'da Doctorium", href: "https://www.instagram.com/doctoriumtr/" },
  { key: "x", label: "X'te Doctorium", href: "https://x.com/doctoriumtr" },
  { key: "linkedin", label: "LinkedIn'de Doctorium", href: "https://www.linkedin.com/company/doctoriumtr/" },
];

// Üçü de aynı dilde çizilir (yuvarlatılmış kare çerçeve + 1.75 stroke + currentColor) — sitenin
// geri kalanında kullanılan lucide-react ikonlarıyla aynı görsel aile; resmî marka path'lerini
// ezbere kopyalamak yerine bilinçli olarak basit/geometrik tutuldu (yanlış hatırlanan bir bezier
// eğrisi bozuk görünür, düz çizgi+daire bozulmaz).
function IconFrame({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      {children}
    </svg>
  );
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </IconFrame>
  );
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconFrame {...props}>
      <circle cx="7.6" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <line x1="7.6" y1="10.6" x2="7.6" y2="16.8" />
      <path d="M12 16.8v-4A2 2 0 0 1 16 12.8v4" />
    </IconFrame>
  );
}

const SOCIAL_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  instagram: InstagramIcon,
  x: XIcon,
  linkedin: LinkedinIcon,
};

// Varsayılan ikon rengi: sabit marka zümrüdü (dl-emerald) — giriş kapıları + landing V3'te
// kullanılır, kimlik/logo öğeleri gibi HER İKİ kitlede de sabit kalır (globals.css
// .doctorium-footer-portal yorumu: "footer --dl-emerald marka zümrüdünde KALIR").
const FIXED_ICON_CLASS = "transition-colors hover:text-[var(--dl-emerald)]";
// Portal (audience-aware) rengi: --c-accent — .doctorium-scope[data-audience="student"] onu
// korala çevirir, doktorda zümrüt kalır (bkz. globals.css "ÖĞRENCİ PALETİ" bloğu). Bu yüzden
// yalnız DoctoriumFooter'ın `portal` sarmalayıcısının İÇİNDE (data-audience kapsamında) anlamlı —
// giriş/landing'de kitle bilgisi yok, o yüzden onlara TAŞINMAZ.
const AUDIENCE_ICON_CLASS = "text-[var(--c-accent)] transition-colors hover:text-[var(--c-accent-strong)]";

/** Doctorium footer sosyal ikon satırı — TÜM Doctorium footer'larının tek kaynağı (ortak
 *  DoctoriumFooter + landing V3 footer'ı, ikisi de bunu import eder — bkz. [[doctorium-footer.tsx]]).
 *  `audienceAware`: yalnız portal'dan `true` geçilir (kullanıcı isteği 2026-09-06 — "doktorda
 *  zümrüt, studentte koral"); giriş/landing varsayılanı korur. */
export function DoctoriumSocialLinks({
  className = "",
  audienceAware = false,
}: {
  className?: string;
  audienceAware?: boolean;
}) {
  const iconClass = audienceAware ? AUDIENCE_ICON_CLASS : FIXED_ICON_CLASS;
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {DOCTORIUM_SOCIAL_LINKS.map((s) => {
        const Icon = SOCIAL_ICONS[s.key];
        return (
          <a
            key={s.key}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            className={iconClass}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
