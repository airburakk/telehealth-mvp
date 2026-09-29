"use client";

import { useLang } from "@/lib/aura-landing/i18n";
import type { ModuleKey } from "@/lib/aura-modules/catalog";
import { moduleCopy } from "@/lib/aura-modules/copy";

// Hizmet kartının dışında, iki vitrinde de aynı site bağlantıları gösterilir.
// 2026-09-30 (yayın): üç alan adı henüz Vercel'e bağlı DEĞİL → kart /care/<modül> iç yoluna gider ve kanonik adresi
// yazar. Alan adları bağlanınca `https://${MODULES[key].domain}` + `MODULES[key].domain` geri alınır (footer "Aura
// World" ve v2/entry-paths aynı kararı taşır; next.config host yönlendirmeleri o gün kendiliğinden devreye girer).
export function CareSiteLinks({ service }: { service: string }) {
  const { lang } = useLang();
  const sites: ModuleKey[] = service === "so" ? ["second-opinion"] : service === "tourism" ? ["medical-tourism", "medical-aesthetics"] : [];
  if (!sites.length) return null;
  const label = { tr: "Özel Sitesi", en: "Dedicated Website", de: "Eigene Website", fr: "Site dédié", ru: "Специализированный сайт", ar: "الموقع المتخصص", fa: "وب‌سایت اختصاصی", az: "Xüsusi Saytı", bg: "Специализиран сайт" }[lang];
  return (
    <div className="space-y-3" data-care-sites={service}>
      {sites.map(key => (
        <a key={key} href={`/care/${key}`} className="block rounded-[16px] border border-[var(--aura-accent)]/30 bg-[var(--aura-panel)] p-4 transition-colors hover:border-[var(--aura-accent)] focus-visible:outline-2 focus-visible:outline-[var(--aura-accent)]">
          <span className="block text-sm font-semibold text-[var(--aura-ink)]">{moduleCopy(lang, key).name} {label}</span>
          <span className="mt-2 block break-all text-xs text-[var(--aura-accent)] underline underline-offset-4">{`auraglobalcare.com/care/${key}`}</span>
        </a>
      ))}
    </div>
  );
}
