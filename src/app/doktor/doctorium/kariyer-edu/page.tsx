import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Compass } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { EDU_KIND_LABEL, EDU_OPPORTUNITIES } from "@/lib/edu-opportunities";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuraButtonLink } from "@/components/ui/AuraButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kariyer EDU" };

/**
 * KARİYER EDU — staj / değişim / burs takvimi (üç katman Faz B1, kullanıcı kararı 2026-09-05; rapor §7). Rafın 10 durağı;
 * YALNIZ öğrenci yüzeyi (audienceFlags.showsStudentSurfaces) — doktor/deneme/personel doğrudan URL ile gelirse akışa döner
 * (Kariyer rehberleri ?m=kariyer onlara kalır). ⚖️ İlan DEĞİL, süreç bilgisi (İŞKUR sınırı).
 *
 * DÜRÜST İSKELET: fırsat verisi elle derlenip (lib/edu-opportunities — boş başlar) kalıcı modele geçecek; bugün grafik/
 * uydurma satır YOK. Kit: PageHeader · AuraPanel · EmptyState · AuraButtonLink.
 */
export default async function KariyerEduPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");
  const ctx = await currentDoctoriumAudience();
  if (!ctx?.flags.showsStudentSurfaces) redirect("/doktor/doctorium");

  return (
    <DoctoriumShell active="kariyer-edu">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Akışıma dön
        </Link>

        <PageHeader
          className="mt-5"
          eyebrow="KARİYER EDU"
          title="Staj, değişim ve burs takvimi"
          sub="Zorunlu stajlar fakültenizde yapılır; buradaki değer isteğe bağlı fırsatlardır: yurt içi ve yurt dışı değişim, gözlemcilik, yaz araştırma programları, burslar. Son başvuru tarihleri ve şart özetleri tek yerde; başvuru daima resmî kaynakta yapılır."
        />

        {EDU_OPPORTUNITIES.length > 0 ? (
          <AuraPanel title="Yaklaşan son başvurular" meta="KAYNAKLI" className="mt-6">
            <ul className="divide-y divide-[var(--c-hairline)]">
              {EDU_OPPORTUNITIES.map((o) => (
                <li key={o.id} className="py-3">
                  <div className="aura-mono text-[10px] uppercase tracking-wider text-[var(--c-ink-3)]">{EDU_KIND_LABEL[o.kind]} · son başvuru {o.deadline}</div>
                  <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[15px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">{o.title}</a>
                  <p className="mt-1 text-[13px] text-[var(--c-ink-2)]">{o.organizer}{o.country ? ` · ${o.country}` : ""} — {o.eligibility}</p>
                </li>
              ))}
            </ul>
          </AuraPanel>
        ) : (
          <EmptyState
            className="mt-6"
            title="Fırsat takvimi hazırlanıyor"
            sub="İlk sürüm elle derlenen kaynaklarla gelecek: TurkMSIC/IFMSA staj değişimi, Erasmus+ / Farabi / Mevlana, VSLO gözlemcilik ve seçmeli rotasyonlar, fakülteye özel programlar ve burslar. Son başvuru tarihleri Takvim'inize düşecek."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AuraButtonLink href="/doktor/doctorium/takvim"><CalendarDays size={15} aria-hidden /> Takvimim</AuraButtonLink>
                <Link href="/doktor/doctorium?m=kariyer" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3.5 py-2 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
                  <Compass size={15} aria-hidden /> Kariyer rehberleri
                </Link>
              </div>
            }
          />
        )}
      </div>
    </DoctoriumShell>
  );
}
