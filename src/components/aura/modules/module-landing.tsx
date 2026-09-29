"use client";

import { aiNoticeText } from "@/components/AiVideoNotice";
import Image from "next/image";
import Link from "next/link";
import { AuraWordText } from "@/components/aura/aura-word";
import { ArrowDown, ArrowUpRight, Check, Plus } from "lucide-react";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";
import { MODULES, MODULE_KEYS, modulePath, type ModuleKey } from "@/lib/aura-modules/catalog";
import { COMMON, moduleCopy } from "@/lib/aura-modules/copy";
import { ModuleGuides } from "./module-guides";

import { ModuleHeader } from "./module-header";
import { ModuleFooter } from "./module-footer";
import styles from "./module-landing.module.css";

export function ModuleLanding({ moduleKey }: { moduleKey: ModuleKey }) {
  return <LangProvider><ModuleContent moduleKey={moduleKey} /></LangProvider>;
}

function ModuleContent({ moduleKey }: { moduleKey: ModuleKey }) {
  const { lang } = useLang();
  const text = moduleCopy(lang, moduleKey);
  const common = COMMON[lang];
  const service = MODULES[moduleKey];

  return (
    <div className={`aura-page ${styles.page}`} lang={lang} dir={langDir(lang)}>
      <a href="#module-content" className={styles.skip}><AuraWordText text={common.skip} /></a>
      <ModuleHeader moduleKey={moduleKey} />
      <main id="module-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="module-title">
          <Image src={service.image} alt="" fill preload sizes="100vw" className={styles.heroImage} />
          <div className={styles.scrim} />
          <div className={styles.heroInner}>
            {/* Modül geçişleri yalnız sayfa sonundaki ilgili hizmetler bölümünde. */}
            <div className={styles.heroCopy}>
              <p className={styles.serviceName}><span aria-hidden="true" /><AuraWordText text={text.name} /></p>
              <h1 id="module-title" className="aura-display"><AuraWordText text={text.title} /></h1>
              <p className={styles.lede}><AuraWordText text={text.description} /></p>
              <div className={styles.actions}>
                <Link href={service.application} className={styles.primary}><AuraWordText text={text.cta} /><ArrowUpRight size={18} aria-hidden="true" /></Link>
                <a href="#process" className={styles.secondary}><AuraWordText text={common.discover} /><ArrowDown size={16} aria-hidden="true" /></a>
              </div>
            </div>
          </div>
        </section>
        <p className={`${styles.container} ${styles.mediaNotice}`}>{aiNoticeText(lang)}</p>

        <section className={`aura-light ${styles.lightSection}`} aria-labelledby="focus-title">
          <div className={`${styles.container} ${styles.focusGrid}`}>
            <div>
              <p className={styles.sectionLabel}><AuraWordText text={text.name} /></p>
              <h2 id="focus-title" className="aura-display"><AuraWordText text={common.focus} /></h2>
              <p className={styles.body}><AuraWordText text={text.focus} /></p>
            </div>
            <ul className={styles.topics}>
              {text.topics.map(topic => <li key={topic}><Check size={19} aria-hidden="true" /><span><AuraWordText text={topic} /></span></li>)}
            </ul>
          </div>
        </section>

        <section id="process" className={styles.process} aria-labelledby="process-title">
          <div className={`${styles.container} ${styles.processGrid}`}>
            <div className={styles.processIntro}>
              <p className={styles.sectionLabel}><AuraWordText text={common.discover} /></p>
              <h2 id="process-title" className="aura-display"><AuraWordText text={common.process} /></h2>
              <p className={styles.body}><AuraWordText text={common.processIntro} /></p>
              <Link href={service.application} className={styles.textLink}><AuraWordText text={text.cta} /><ArrowUpRight size={19} aria-hidden="true" /></Link>
            </div>
            <ol className={styles.steps}>
              {text.steps.map((step, index) => <li key={step}><span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span><p><AuraWordText text={step} /></p></li>)}
            </ol>
          </div>
          <div className={styles.container}><p className={styles.scopeNote}><AuraWordText text={text.note} /></p></div>
        </section>

        <section className={`aura-light ${styles.lightSection}`} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.faqGrid}`}>
            <div><p className={styles.sectionLabel}><AuraWordText text={text.name} /></p><h2 id="faq-title" className="aura-display"><AuraWordText text={common.faq} /></h2><Link href="/guven-ve-gizlilik" className={styles.textLink}><AuraWordText text={common.privacy} /><ArrowUpRight size={18} aria-hidden="true" /></Link></div>
            <div className={styles.faqList}>
              {common.questions.map((question, i) => <details key={question}><summary><AuraWordText text={question} /><Plus size={20} aria-hidden="true" /></summary><p><AuraWordText text={common.answers[i]} /></p></details>)}
            </div>
          </div>
        </section>

        <ModuleGuides moduleKey={moduleKey} />
        <section className={`${styles.container} ${styles.next}`} aria-labelledby="next-title">
          <div><h2 id="next-title" className="aura-display"><AuraWordText text={common.next} /></h2><p className={styles.body}><AuraWordText text={common.nextBody} /></p></div>
          <Link href={service.application} className={styles.primary}><AuraWordText text={text.cta} /><ArrowUpRight size={18} aria-hidden="true" /></Link>
        </section>
        <section className={`${styles.container} ${styles.related}`} aria-labelledby="related-title">
          <h2 id="related-title" className="aura-display"><AuraWordText text={common.other} /></h2>
          <div className={styles.relatedGrid}>
            {MODULE_KEYS.filter(key => key !== moduleKey).map(key => <Link key={key} href={modulePath(key)} className={styles.relatedLink}>
              <figure className={styles.relatedFigure}><Image src={MODULES[key].image} alt="" width={160} height={100} sizes="96px" /><figcaption className={styles.mediaNotice}>{aiNoticeText(lang)}</figcaption></figure>
              <span><AuraWordText text={moduleCopy(lang, key).name} /></span><ArrowUpRight size={20} aria-hidden="true" />
            </Link>)}
          </div>
        </section>
      </main>
      <ModuleFooter moduleKey={moduleKey} />
    </div>
  );
}

