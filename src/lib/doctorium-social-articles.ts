/** Editorial catalogue of verified, already published Doctorium X Articles.
 * Keep cover assets with this catalogue; a post or draft alone is not an Article.
 */
export type SocialArticle = Readonly<{
  id: string;
  title: string;
  summary: string;
  topic: string;
  publishedAt: string;
  sourceUrl: string;
  coverSrc: string;
  platform: 'X';
}>;

export const SOCIAL_ARTICLES_TITLE = 'Sosyal medyada yayımlanan yazılar';
export const SOCIAL_ARTICLES_PATH = '/doktor/doctorium/sosyal-yazilar';

const entries = [
  ["2126359077898871058","2026-11-27T16:54:44.669Z","Tıp fakültesinde fırsatları son gün öğrenmemek için: Doctorium Student","Tıp öğrencilerinin burs, etkinlik ve mesleki fırsatları zamanında takip etmesine dair bir yazı.","Doctorium Student"],
  ["2123854771664589052","2026-11-20T19:03:31.535Z","Doctorium sizin için bu hafta neler yaptı?","Doctorium’da bir haftanın mesleki gündemine ve öne çıkan çalışmalara bakış.","Doctorium gündemi"],
  ["2121351854303125721","2026-11-13T21:17:49.534Z","Son hasta çıktı. Aile hekiminin gündemi bitmedi.","Aile hekiminin mesleki gündemine Doctorium’dan bir bakış.","Aile hekimliği"],
  ["2118778665580265782","2026-11-06T18:52:53.535Z","Dijital çağda güncel kalmaya çalışan doktor","Doktorların dijital çağda güncel kalma çabasına odaklanan yazımız.","Mesleki gelişim"],
  ["2116184651236557217","2026-10-30T15:05:12.321Z","Branşına göre bir mesleki gündem kurmak","Mesleki gündemi branşa ve ilgi alanlarına göre düzenlemek üzerine.","Kişiselleştirme"],
  ["2113654287687451110","2026-10-23T15:30:26.639Z","Doctorium’a başlangıç: Mesleki gündeminizi düzenleyin","Doctorium ile mesleki gündeminizi düzenlemeye giriş.","Doctorium rehberi"],
] as const;

export const SOCIAL_ARTICLES: readonly SocialArticle[] = entries.map(([id, publishedAt, title, summary, topic]) => ({
  id,
  title,
  summary,
  topic,
  publishedAt,
  sourceUrl: `https://x.com/Doctoriumtr/status/${id}`,
  coverSrc: `/doctorium-social/article-cover-${id}.jpg`,
  platform: 'X',
}));

export function socialArticleDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
}
