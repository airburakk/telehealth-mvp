import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { SOCIAL_ARTICLES, socialArticleDate, type SocialArticle } from '@/lib/doctorium-social-articles';

/** Shared catalogue for the public introduction and authenticated Doctorium feed. */
export function SocialArticleList({ items = SOCIAL_ARTICLES, landing = false }: {
  items?: readonly SocialArticle[]; landing?: boolean;
}) {
  const Heading = landing ? 'h3' : 'h2';
  const ink = landing ? 'text-[var(--dl-ink,#18181b)]' : 'text-[var(--c-ink)]';
  const body = landing ? 'text-[var(--dl-body,#4b4b48)]' : 'text-[var(--c-ink-2)]';
  const border = landing ? 'border-black/15' : 'border-[var(--c-hairline)]';
  if (!items.length) return <p className={body}>Yayımlanan yazılarımız burada yer alacak.</p>;
  return <ol className='grid min-w-0 gap-5 md:grid-cols-2'>
    {items.map((item) => (
      <li key={item.id} className='min-w-0'>
        <article className={'h-full rounded-2xl border ' + border}>
          <a href={item.sourceUrl} target='_blank' rel='noopener noreferrer'
            aria-label={item.title + ' — X’te oku (yeni sekme)'}
            className='group flex h-full flex-col overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600'>
            <Image src={item.coverSrc} alt='' width={680} height={272} unoptimized
              className='block h-auto w-full bg-emerald-950' />
            <div className='flex grow flex-col p-5 sm:p-6'>
              <div className={'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium ' + body}>
                <span>{item.platform} Article</span><span aria-hidden='true'>·</span><span>{item.topic}</span>
              </div>
              <Heading className={'mt-3 break-words text-xl font-medium leading-tight tracking-tight sm:text-2xl ' + ink}>{item.title}</Heading>
              <p className={'mt-3 text-sm leading-relaxed ' + body}>{item.summary}</p>
              <footer className={'mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-5 text-xs ' + body}>
                <time dateTime={item.publishedAt}>{socialArticleDate(item.publishedAt)}</time>
                <span className={'inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 ' + ink}>
                  X’te oku <ExternalLink size={14} aria-hidden='true' />
                </span>
              </footer>
            </div>
          </a>
        </article>
      </li>
    ))}
  </ol>;
}
