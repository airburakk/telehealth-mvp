"use client";

import Link from "next/link";
import { AuraWordText } from "@/components/aura/aura-word";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { AuraMark, AuraWordSvg } from "@/components/AuraLogo";
import { LANGS, useLang, type Lang } from "@/lib/aura-landing/i18n";
import { MODULES, modulePath, type ModuleKey } from "@/lib/aura-modules/catalog";
import { moduleCopy } from "@/lib/aura-modules/copy";
import { guidesFor, guidePath, readText } from "@/lib/aura-modules/guide-index";
import styles from "./module-landing.module.css";

const BRAND_COLORS: Record<ModuleKey, string> = {
  "second-opinion": "#63d9e8", "medical-tourism": "#e8bd79", "medical-aesthetics": "#c3a8ed",
};

export function ModuleBrand({ moduleKey }: { moduleKey: ModuleKey }) {
  const { lang } = useLang();
  const { name } = moduleCopy(lang, moduleKey);
  return <div className={styles.moduleBrand}>
    <Link href="https://www.auraglobalcare.com/" className={styles.brandHome} aria-label="AURA Global Care">
      <AuraMark size={32} />
      <AuraWordSvg decorative fill="#f4f5f3" className={styles.brandWord} />
    </Link>
    <Link href={modulePath(moduleKey)} className={styles.brandSubtitle} style={{ color: BRAND_COLORS[moduleKey] }}>{name}</Link>
  </div>;
}

export function ModuleHeader({ moduleKey }: { moduleKey: ModuleKey }) {
  const { lang, setLang, t } = useLang();
  const { cta } = moduleCopy(lang, moduleKey);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const guides = guidesFor(moduleKey);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const guideLabel = lang === "tr" ? "Bilgi rehberi" : "Guides";
  return <header className={styles.moduleHeader}>
    <div className={styles.headerInner}>
      <ModuleBrand moduleKey={moduleKey} />
      {moduleKey !== "medical-aesthetics" && <nav className={styles.desktopGuides} aria-label={guideLabel}>
        {guides.map(guide => <Link key={guide.slug} href={guidePath(moduleKey, guide.slug)} aria-current={pathname === guidePath(moduleKey, guide.slug) ? "page" : undefined}><AuraWordText text={readText(guide.title, lang)} /></Link>)}
      </nav>}
      <div className={styles.headerControls}>
        <select aria-label="Language" className={styles.languageSelect} value={lang} onChange={event => setLang(event.target.value as Lang)}>
          {LANGS.map(language => <option key={language.code} value={language.code}>{language.native}</option>)}
        </select>
        <Link href={MODULES[moduleKey].application} className={`${styles.primary} ${styles.headerApply}`}>{cta}<ArrowUpRight size={15} aria-hidden="true" /></Link>
        <button type="button" className={`${styles.menuButton} ${moduleKey === "medical-aesthetics" ? styles.alwaysMenu : ""}`} aria-label={open ? t.nav.close : t.nav.menu} aria-expanded={open} aria-controls="module-guides-menu" onClick={() => setOpen(!open)}>
          <span>{guideLabel}</span>{open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
    </div>
    {open && <nav id="module-guides-menu" className={styles.guideMenu} aria-label={guideLabel}>
      <Link href={modulePath(moduleKey)} onClick={() => setOpen(false)}>{moduleCopy(lang, moduleKey).name}</Link>
      {guides.map(guide => <Link key={guide.slug} href={guidePath(moduleKey, guide.slug)} aria-current={pathname === guidePath(moduleKey, guide.slug) ? "page" : undefined} onClick={() => setOpen(false)}><AuraWordText text={readText(guide.title, lang)} /></Link>)}
      <Link href={MODULES[moduleKey].application} className={styles.mobileApply} onClick={() => setOpen(false)}>{cta}<ArrowUpRight size={15} /></Link>
    </nav>}
  </header>;
}
