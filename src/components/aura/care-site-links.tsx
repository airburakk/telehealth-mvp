"use client";

import { useLang } from "@/lib/aura-landing/i18n";
import { MODULES, type ModuleKey } from "@/lib/aura-modules/catalog";
import { moduleName } from "@/lib/aura-modules/copy";

// Hizmet kartının dışında, iki vitrinde de aynı site bağlantıları gösterilir.
// 👤 karar 2026-10-02: üç modül (İkinci Görüş · Sağlık Turizmi · Medikal Estetik) YALNIZ kendi alan adlarında yaşar
// (aurasecondopinion.com · auramedicaltourism.com · auramedicalaesthetics.com — ayrı Vercel projeleri, 21.09.2026'dan
// beri canlı). AURA sitesinde /care sayfası YOKTUR (v6.304'te eklenmişti, v6.305'te kaldırıldı); bu kart, footer "Aura
// World" ve v2/entry-paths doğrudan o alan adlarına gider. Buraya /care iç yolu GERİ EKLENMEZ.
export function CareSiteLinks({ service }: { service: string }) {
  const { lang } = useLang();
  const sites: ModuleKey[] = service === "so" ? ["second-opinion"] : service === "tourism" ? ["medical-tourism", "medical-aesthetics"] : [];
  if (!sites.length) return null;
  const label = { tr: "Özel Sitesi", en: "Dedicated Website", de: "Eigene Website", fr: "Site dédié", ru: "Специализированный сайт", ar: "الموقع المتخصص", fa: "وب‌سایت اختصاصی", az: "Xüsusi Saytı", bg: "Специализиран сайт" }[lang];
  return (
    <div className="space-y-3" data-care-sites={service}>
      {sites.map(key => (
        <a key={key} href={`https://${MODULES[key].domain}`} className="block rounded-[16px] border border-[var(--aura-accent)]/30 bg-[var(--aura-panel)] p-4 transition-colors hover:border-[var(--aura-accent)] focus-visible:outline-2 focus-visible:outline-[var(--aura-accent)]">
          <span className="block text-sm font-semibold text-[var(--aura-ink)]">{moduleName(lang, key)} {label}</span>
          <span className="mt-2 block break-all text-xs text-[var(--aura-accent)] underline underline-offset-4">{MODULES[key].domain}</span>
        </a>
      ))}
    </div>
  );
}
