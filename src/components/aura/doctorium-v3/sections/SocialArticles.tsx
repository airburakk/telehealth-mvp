import Link from 'next/link';
import { SocialArticleList } from '@/components/aura/doctorium-social-articles';
import { SOCIAL_ARTICLES_PATH, SOCIAL_ARTICLES_TITLE } from '@/lib/doctorium-social-articles';
import styles from './SocialArticles.module.css';

export function SocialArticlesSection() {
  return (
    <section id='sosyal-yazilar' aria-labelledby='sosyal-yazilar-baslik' className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.copy}>
          <p className={styles.eyebrow}>DOCTORIUM · X ARTICLE</p>
          <h2 id='sosyal-yazilar-baslik'>{SOCIAL_ARTICLES_TITLE}</h2>
          <p className={styles.lead}>Doctorium’un X’te yayımladığı yazılar, en yeniden en eskiye. Yazıyı özgün X yayını üzerinden okuyabilirsiniz.</p>
        </header>
        <SocialArticleList landing />
        <Link href={'/doctorium/giris?next=' + encodeURIComponent(SOCIAL_ARTICLES_PATH)} className={styles.cta}>
          Doctorium’da yazı akışı <span aria-hidden='true'>↗</span>
        </Link>
      </div>
    </section>
  );
}
