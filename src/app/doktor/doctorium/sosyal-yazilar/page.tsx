import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SOCIAL_ARTICLES_TITLE } from '@/lib/doctorium-social-articles';
import { DoctoriumShell } from '../DoctoriumSidebar';
import { SocialArticleList } from '@/components/aura/doctorium-social-articles';

export const dynamic = 'force-dynamic';
export const metadata = { title: SOCIAL_ARTICLES_TITLE, robots: { index: false, follow: false } };

export default async function SocialArticlesPage() {
  const user = await getCurrentUser();
  if (!user || !['DOCTOR', 'COORDINATOR', 'ADMIN'].includes(user.role)) redirect('/');
  // Parent layout keeps the existing verified/trial/student access policy.
  return <DoctoriumShell active='sosyal-yazilar'>
    <div className='mx-auto max-w-6xl px-5 py-10 md:py-14'>
      <p className='text-xs font-semibold tracking-[0.14em] text-[var(--c-accent)]'>DOCTORIUM YAZILARI</p>
      <h1 className='mt-3 max-w-3xl text-3xl font-medium tracking-tight md:text-4xl'>{SOCIAL_ARTICLES_TITLE}</h1>
      <p className='mb-9 mt-4 max-w-2xl text-sm leading-relaxed text-[var(--c-ink-2)]'>X Article yazılarımız, en yeniden eskiye. Mesleki gündemimize dair yayımladığımız yazıları burada bir araya getiriyoruz.</p>
      <SocialArticleList />
      <p className='mt-6 text-xs text-[var(--c-ink-2)]'>Bağlantılar özgün X yayınını yeni sekmede açar. X oturumu gerekebilir.</p>
    </div>
  </DoctoriumShell>;
}
