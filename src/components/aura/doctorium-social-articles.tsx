import { ExternalLink } from 'lucide-react';
import { SOCIAL_ARTICLES, socialArticleDate, type SocialArticle } from '@/lib/doctorium-social-articles';

/** Same editorial content in the public introduction and authenticated feed.
 * Direct source links work without embedding X scripts or loading third-party media.
 */
export function SocialArticleList({ items = SOCIAL_ARTICLES, landing = false }: {
  items?: readonly SocialArticle[]; landing?: boolean;
}) {
  const Heading = landing ? 'h3' : 'h2';
  const ink = landing ? 'text-[var(--dl-ink)]' : 'text-[var(--c-ink)]';
  const body = landing ? 'text-[var(--dl-body)]' : 'text-[var(--c-ink-2)]';
  const border = landing ? 'border-black/15' : 'border-[var(--c-hairline)]';
  if (!items.length) return <p className={body}>Yayımlanan yazılarımız burada yer alacak.</p>;
  return <ol className='grid min-w-0 gap-5 md:grid-cols-2'>
    {items.map((item) => <li key={item.id} className={'min-w-0 rounded-2xl border p-6 md:p-8 ' + border}>
      <article className='flex h-full flex-col'>
        <div className={'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium ' + body}>
          <span>{item.platform} Article</span><span aria-hidden='true'>·</span><span>{item.topic}</span>
        </div>
        <Heading className={'mt-5 text-2xl font-medium leading-tight tracking-tight ' + ink}>{item.title}</Heading>
        <p className={'mt-4 text-sm leading-relaxed ' + body}>{item.summary}</p>
        <div className={'mt-auto flex flex-wrap items-center justify-between gap-4 pt-8 text-xs ' + body}>
          <time dateTime={item.publishedAt}>{socialArticleDate(item.publishedAt)}</time>
          <a href={item.sourceUrl} target='_blank' rel='noopener noreferrer'
            aria-label={item.title + ' — X’te oku (yeni sekme)'}
            className={'inline-flex items-center gap-2 rounded py-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 ' + ink}>
            X’te oku <ExternalLink size={14} aria-hidden='true' />
          </a>
        </div>
      </article>
    </li>)}
  </ol>;
}
