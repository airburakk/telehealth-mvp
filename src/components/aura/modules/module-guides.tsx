"use client";
import Link from "next/link";
import { AuraWordText } from "@/components/aura/aura-word";
import { ArrowUpRight } from "lucide-react";
import { useLang } from "@/lib/aura-landing/i18n";
import type { ModuleKey } from "@/lib/aura-modules/catalog";
import { guidesFor, guidePath, readText } from "@/lib/aura-modules/guide-index";
import styles from "./module-landing.module.css";

export function ModuleGuides({ moduleKey, exclude }: { moduleKey: ModuleKey; exclude?: string }) {
  const { lang } = useLang();
  return <section className={`${styles.container} ${styles.guideSection}`} aria-labelledby="guides-title" lang={lang === "tr" ? "tr" : "en"} dir="ltr">
    <h2 id="guides-title" className="aura-display">{lang === "tr" ? "Karar vermeden önce, bilgi edinin." : "Understand your options before deciding."}</h2>
    <p className={styles.body}>{lang === "tr" ? "Sorularınıza daha yakından bakan rehberler." : "Guides that take a closer look at your questions."}</p>
    <div className={styles.guideGrid}>
      {guidesFor(moduleKey).filter(guide => guide.slug !== exclude).map(guide => <Link key={guide.slug} href={guidePath(moduleKey, guide.slug)} className={styles.guideCard}>
        <h3><AuraWordText text={readText(guide.title, lang)} /></h3><p><AuraWordText text={readText(guide.summary, lang)} /></p><ArrowUpRight size={20} aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
