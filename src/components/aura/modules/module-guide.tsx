"use client";
import Link from "next/link";
import Image from "next/image";
import { AuraWordText } from "@/components/aura/aura-word";
import { Fragment } from "react";
import { GuidePhoto, hasGuidePhoto } from "./guide-photo";
import { LangProvider, useLang, langDir } from "@/lib/aura-landing/i18n";
import { MODULES, modulePath, type ModuleKey } from "@/lib/aura-modules/catalog";
import { GUIDE_INDEX, readText } from "@/lib/aura-modules/guide-index";
import type { Guide } from "@/lib/aura-modules/guides";
import { moduleCopy } from "@/lib/aura-modules/copy";
import { ModuleFooter } from "./module-footer";
import { ModuleHeader } from "./module-header";
import { ModuleGuides } from "./module-guides";
import styles from "./module-landing.module.css";

export function ModuleGuide(props: { moduleKey: ModuleKey; slug: string; guide: Guide }) {
  return <LangProvider><GuideContent {...props} /></LangProvider>;
}
function GuideContent({ moduleKey, slug, guide }: { moduleKey: ModuleKey; slug: string; guide: Guide }) {
  const { lang } = useLang();
  const tr = lang === "tr";
  const words = [readText(guide.intro, lang), ...guide.sections.flatMap(section => [readText(section.title, lang), readText(section.body, lang), ...(section.items ?? []).map(item => readText(item, lang))])].join(" ").split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 180));
  const entry = GUIDE_INDEX.find(item => item.module === moduleKey && item.slug === slug)!;
  return <div className={`aura-page ${styles.page}`} dir={langDir(lang)} lang={lang}>
    <a href="#guide-content" className={styles.skip}>{tr ? "İçeriğe geç" : "Skip to content"}</a>
    <ModuleHeader key={slug} moduleKey={moduleKey} />
    <main id="guide-content" tabIndex={-1}>
      <article className={styles.article} lang={tr ? "tr" : "en"} dir="ltr">
        <header className={`${styles.container} ${styles.articleHeading}`}>
          <Link href={modulePath(moduleKey)} className={styles.textLink}>← {moduleCopy(tr ? "tr" : "en", moduleKey).name}</Link>
          {!tr && lang !== "en" && <p className={styles.translationNote}>This guide is available in English and Türkçe. Select Türkçe in the language menu to read the Turkish version.</p>}
          <div className={`${styles.articleHeroGrid} ${!hasGuidePhoto(slug) ? styles.articleHeroTextOnly : ""}`}><div>
          <h1 className="aura-display"><AuraWordText text={readText(entry.title, lang)} /></h1>
          {guide.navigation && <nav className={styles.surgeryNavigation} aria-label={tr ? "Estetik Cerrahi alanları" : "Aesthetic Surgery areas"}>{guide.navigation.map(link => <Link key={link.href} href={link.href}>{readText(link.label, lang)}<span aria-hidden="true">↗</span></Link>)}</nav>}
          <p className={styles.articleIntro}><AuraWordText text={readText(guide.intro, lang)} /></p>
          <p className={styles.articleDate}>{tr ? "Kaynak kontrolü: 20 Eylül 2026" : "Sources checked: 20 September 2026"}</p>
          <p className={styles.readingTime}>{tr ? `Yaklaşık ${readingMinutes} dakika okuma` : `About ${readingMinutes} minutes to read`}</p>
          </div><GuidePhoto moduleKey={moduleKey} slug={slug} placement="hero" lang={lang} /></div>
        </header>
        <div className={`aura-light ${styles.articleSurface}`}>
          <div className={`${styles.container} ${styles.articleLayout}`}>
            <aside className={styles.contents}><p>{tr ? "Bu rehberde" : "In this guide"}</p><nav aria-label={tr ? "İçindekiler" : "Contents"}>{guide.sections.map((section, index) => <a key={index} href={`#section-${index}`}><AuraWordText text={readText(section.title, lang)} /></a>)}<a href="#sources">{tr ? "Kaynaklar" : "Sources"}</a></nav></aside>
            <div className={styles.articleBody}>
              {guide.stats && <div className={styles.statsGrid}>{guide.stats.map(stat => <div key={stat.value}><strong>{stat.value}</strong><span><AuraWordText text={readText(stat.label, lang)} /></span><small><AuraWordText text={readText(stat.note, lang)} /></small></div>)}</div>}
              {guide.sections.map((section, index) => <Fragment key={index}><section id={`section-${index}`} className={styles.articleSection} key={index}>
                <h2 className="aura-display"><AuraWordText text={readText(section.title, lang)} /></h2><p><AuraWordText text={readText(section.body, lang)} /></p>
                {slug === "healthcare-in-turkiye" && section.title.tr === "HealthTürkiye ve Heal in Türkiye" && <nav className={styles.portalLinks} aria-label={tr ? "Resmî Sağlık Turizmi portalları" : "Official Medical Tourism portals"}>
                  <a href="https://healthturkiye.gov.tr/" target="_blank" rel="noopener noreferrer"><Image src="/assets/modules/portals/healthturkiye.svg" alt="HealthTürkiye" width={240} height={100} unoptimized /><span>{tr ? "Resmî siteyi ziyaret et" : "Visit the official website"} ↗</span></a>
                  <a className={styles.healPortal} href="https://www.healinturkiye.gov.tr/" target="_blank" rel="noopener noreferrer"><Image src="/assets/modules/portals/heal-in-turkiye.png" alt="Heal in Türkiye" width={240} height={100} /><span>{tr ? "Resmî siteyi ziyaret et" : "Visit the official website"} ↗</span></a>
                </nav>}
                {section.items && <ul>{section.items.map((item, i) => <li key={i}><AuraWordText text={readText(item, lang)} /></li>)}</ul>}
                {section.links && <nav className={styles.sectionLinks} aria-label={tr ? "İlgili ayrıntılı rehberler" : "Related detailed guides"}>{section.links.map(link => <Link key={link.href} href={link.href}><AuraWordText text={readText(link.label, lang)} /><span aria-hidden="true">↗</span></Link>)}</nav>}
              </section>{index === 2 && <GuidePhoto moduleKey={moduleKey} slug={slug} placement="inline" lang={lang} />}</Fragment>)}
              <section id="sources" className={styles.sources}><h2>{tr ? "Kaynaklar ve kapsam" : "Sources and scope"}</h2>
                <p><AuraWordText text={tr ? "Genel bilgilendirme içeriğidir; kişisel tıbbi değerlendirme yerine geçmez. Bağlantılar ilgili kaynaklara ve AURA hizmet sayfalarına yönlendirir." : "General information, not a substitute for an individual clinical assessment. Links lead to relevant sources and AURA service pages."} /></p>
                <ul>{guide.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer"><AuraWordText text={source.name} /> ↗</a></li>)}</ul>
              </section>
            </div>
          </div>
        </div>
      </article>
      {moduleKey !== "second-opinion" && <section className={[styles.container, styles.guideCta].join(" ")} aria-label={tr ? "AURA’da başlangıç seçenekleri" : "Ways to begin with AURA"}><Link href="/triyaj" className={styles.primary}>{tr ? "Önce branş doktoruyla görüş" : "Start with a specialist"}</Link><Link href="/saglik-turizmi" className={styles.primary}>{moduleKey === "medical-aesthetics" ? (tr ? "Medikal Estetik değerlendirmesi iste" : "Request an aesthetics assessment") : (tr ? "Sağlık Turizmi talebi oluştur" : "Request Medical Tourism")}</Link></section>}
      <ModuleGuides moduleKey={moduleKey} exclude={slug} />
      {moduleKey === "second-opinion" && <div className={`${styles.container} ${styles.guideCta}`}><Link href={MODULES[moduleKey].application} className={styles.primary}>{moduleCopy(lang, moduleKey).cta}</Link></div>}
    </main>
    <ModuleFooter moduleKey={moduleKey} />
  </div>;
}
