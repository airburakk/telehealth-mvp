import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SOCIAL_ARTICLES, socialArticleDate, SOCIAL_ARTICLES_PATH, SOCIAL_ARTICLES_TITLE } from '@/lib/doctorium-social-articles';
import { shelfTabsFor } from '@/lib/doctorium-shelf';

describe('published social editorial catalogue', () => {
  it('has unique, ordered publications and only the canonical Doctorium X source', () => {
    expect(new Set(SOCIAL_ARTICLES.map(a => a.id)).size).toBe(SOCIAL_ARTICLES.length);
    expect(SOCIAL_ARTICLES.map(a => a.id)).toEqual(["2126359077898871058","2123854771664589052","2121351854303125721","2118778665580265782","2116184651236557217","2113654287687451110"]);
    expect(SOCIAL_ARTICLES_TITLE).toBe('Sosyal medyada yayımlanan yazılar');
    for (const a of SOCIAL_ARTICLES) {
      expect(a.coverSrc).toBe(`/doctorium-social/article-cover-${a.id}.jpg`);
      expect(Array.from(readFileSync(`public${a.coverSrc}`).subarray(0, 3))).toEqual([255, 216, 255]);
    }
    for (const a of SOCIAL_ARTICLES) {
      expect(a.sourceUrl).toBe('https://x.com/Doctoriumtr/status/' + a.id);
      expect(a.title.length).toBeGreaterThan(10);
      expect(a.sourceUrl).not.toContain('2121295035027132778');
      expect(Date.parse(a.publishedAt)).not.toBeNaN();
    }
    expect(SOCIAL_ARTICLES.map(a => a.publishedAt)).toEqual(SOCIAL_ARTICLES.map(a => a.publishedAt).sort().reverse());
  });
  it('uses Turkey publication dates, including the after-midnight Article', () => {
    expect(socialArticleDate(SOCIAL_ARTICLES[2].publishedAt)).toBe('14 Kasım 2026');
    expect(socialArticleDate(SOCIAL_ARTICLES[3].publishedAt)).toBe('6 Kasım 2026');
  });
  it('adds the same source feed to all supported audience shelves without altering DB modules', () => {
    for (const a of ['VERIFIED', 'TRIAL', 'STUDENT', null] as const) {
      const tabs = shelfTabsFor(a);
      expect(tabs.find(t => t.key === 'sosyal-yazilar')).toMatchObject({ href: SOCIAL_ARTICLES_PATH, module: null });
      expect(tabs.at(-1)?.key).toBe('takvim');
    }
  });
  it('reuses one list in hero-page promotion and protected portal, never embeds X scripts', () => {
    const landing = readFileSync('src/components/aura/doctorium-v3/sections/SocialArticles.tsx', 'utf8');
    const portal = readFileSync('src/app/doktor/doctorium/sosyal-yazilar/page.tsx', 'utf8');
    const cards = readFileSync('src/components/aura/doctorium-social-articles.tsx', 'utf8');
    expect(landing).toContain('<SocialArticleList landing />');
    expect(landing).toContain('SOCIAL_ARTICLES');
    expect(cards.indexOf('src={item.coverSrc}')).toBeGreaterThan(-1);
    expect(cards.indexOf('src={item.coverSrc}')).toBeLessThan(cards.indexOf('{item.title}</Heading>'));
    expect(portal).toContain('<SocialArticleList />');
    expect(portal).toContain('getCurrentUser()');
    expect(portal).toContain("active='sosyal-yazilar'");
    expect(cards).toContain("rel='noopener noreferrer'");
    expect(cards).not.toMatch(/<script|<iframe/);
  });
});
