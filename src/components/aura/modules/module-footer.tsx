"use client";
import { AuraWordText } from "@/components/aura/aura-word";
import { useLang } from "@/lib/aura-landing/i18n";
import type { ModuleKey } from "@/lib/aura-modules/catalog";
import { moduleSlogan } from "@/lib/aura-modules/guide-index";
import { ModuleBrand } from "./module-header";
import styles from "./module-landing.module.css";

// [S1] Modül vitrinlerinde yalnız marka, modül sloganı ve alt bilgi bulunur.
export function ModuleFooter({ moduleKey }: { moduleKey: ModuleKey }) {
  const { lang, t } = useLang();
  return <footer className={styles.moduleFooter}>
    <div className={styles.container}>
      <ModuleBrand moduleKey={moduleKey} />
      <p className={styles.footerSlogan}><AuraWordText text={moduleSlogan(lang, moduleKey)} /></p>
      <p className={styles.footerCopyright}><AuraWordText text={t.footer.legal} /></p>
    </div>
  </footer>;
}
