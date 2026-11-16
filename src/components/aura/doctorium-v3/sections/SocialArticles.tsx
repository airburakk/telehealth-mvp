import Image from 'next/image';
import Link from 'next/link';
import { SOCIAL_ARTICLES, SOCIAL_ARTICLES_PATH } from '@/lib/doctorium-social-articles';
import styles from './SocialArticles.module.css';

/** Genuine, cropped X screenshots captured 2026-11-16. No fabricated UI or metrics.
 * Editorial feed is unchanged; this composition is only for the public Hero page.
 */
export function SocialArticlesSection() {
  const latest = SOCIAL_ARTICLES[0];
  const previous = SOCIAL_ARTICLES[1];
  return <section id='sosyal-yazilar' aria-labelledby='sosyal-yazilar-baslik' className={styles.section}>
    <div className={styles.inner}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>DOCTORIUM · X ARTICLE</p>
        <h2 id='sosyal-yazilar-baslik'>Doktorun gündemi.<br /><span>Kendi kelimelerimizle.</span></h2>
        <p className={styles.lead}>Sosyal medyada yayınlanan yazılarımız. Mesleki gündeme doktorun tarafından bakan yazıları, özgün X yayınlarından okuyun.</p>
        <Link href={'/doctorium/giris?next=' + encodeURIComponent(SOCIAL_ARTICLES_PATH)} className={styles.cta}>Doctorium’da yazı akışı <span aria-hidden='true'>↗</span></Link>
        <p className={styles.note}>Kartlara dokunarak X’te okuyabilirsiniz.</p>
      </div>
      <div className={styles.visual}>
        <div className={styles.glow} aria-hidden='true' />
        <a href={previous.sourceUrl} target='_blank' rel='noopener noreferrer' className={styles.card + ' ' + styles.back} aria-label={previous.title + ' — X’te oku (yeni sekme)'}>
          <Image src={'/doctorium-social/x-article-' + previous.id + '.jpg'} alt={previous.title + ' başlıklı Doctorium X Article yayınının gerçek ekran görüntüsü'} width={594} height={760} unoptimized />
        </a>
        <a href={latest.sourceUrl} target='_blank' rel='noopener noreferrer' className={styles.card + ' ' + styles.front} aria-label={latest.title + ' — X’te oku (yeni sekme)'}>
          <Image src={'/doctorium-social/x-article-' + latest.id + '.jpg'} alt={latest.title + ' başlıklı Doctorium X Article yayınının gerçek ekran görüntüsü'} width={594} height={760} unoptimized />
        </a>
        <p className={styles.caption}>Gerçek X yayınlarından · 16 Kasım 2026</p>
      </div>
    </div>
  </section>;
}
