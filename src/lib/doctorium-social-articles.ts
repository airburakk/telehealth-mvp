/** Editorial catalogue of already published, owner-approved X Articles.
 * No scraper, schedule, publisher or database mutation. Add entries only after publication
 * and final URL verification. Existing cover/text approval is not replaced by this archive.
 */
export type SocialArticle = Readonly<{
  id: string;
  title: string;
  summary: string;
  topic: string;
  publishedAt: string;
  sourceUrl: string;
  platform: 'X';
}>;
export const SOCIAL_ARTICLES: readonly SocialArticle[] = [
  {
    id: '2121351854303125721',
    title: 'Son hasta çıktı. Aile hekiminin gündemi bitmedi.',
    summary: 'Aile hekiminin mesleki gündemine Doctorium’dan bir bakış.',
    topic: 'Aile hekimliği',
    publishedAt: '2026-11-13T21:17:49.534Z',
    sourceUrl: 'https://x.com/Doctoriumtr/status/2121351854303125721',
    platform: 'X',
  },
  {
    id: '2118778665580265782',
    title: 'Dijital çağda güncel kalmaya çalışan doktor',
    summary: 'Doktorların dijital çağda güncel kalma çabasına odaklanan yazımız.',
    topic: 'Mesleki gelişim',
    publishedAt: '2026-11-06T18:52:53.535Z',
    sourceUrl: 'https://x.com/Doctoriumtr/status/2118778665580265782',
    platform: 'X',
  },
];
export const SOCIAL_ARTICLES_PATH = '/doktor/doctorium/sosyal-yazilar';
export function socialArticleDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
}
