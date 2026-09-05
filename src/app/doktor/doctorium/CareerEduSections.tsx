import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink, Info } from "lucide-react";
import { TUS_EXAM_PERIODS, TUS_OFFICIAL_LINKS } from "@/lib/tus";
import { EDU_KIND_LABEL, approvedEduOpportunities, eduCountryLabel } from "@/lib/edu-opportunities";
import { formatIsoDayTr } from "@/lib/iso-day";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuraButtonLink } from "@/components/ui/AuraButton";

/**
 * KARİYER sekmesinin EDU bölümleri (üç katman B3, kullanıcı kararı 2026-09-05 akşam): "kariyer akışını öğrenciye
 * gösterme; Kariyer EDU ve TUS'u Kariyer'in İÇİNE koy — ekstra sekme açılmasın, Takvim en sonda kalsın."
 *  · StudentCareerHub  → ?m=kariyer ÖĞRENCİ sahnesi (doktorun denklik/yükselme yol haritası YERİNE çizilir).
 *  · DoctorTusSection  → doktor Özelleştir'den "Kariyer içinde TUS bölümünü göster" açarsa yol haritasının ALTINA gelir
 *    (rapor §2 "kapalı, gizli değil" — B1'deki raf sekmesi B3'te buraya indi).
 *  · Paneller /doktor/doctorium/tus ve /kariyer-edu AYRINTI sayfalarıyla paylaşılır (tek markup; sayfalar derin bağlantı
 *    olarak sürer, raf sekmesi olarak DEĞİL).
 * Renk: sabit hex YOK — kit token'ı (--c-accent) kitleye göre zümrüt (doktor) / koral (öğrenci) olur.
 * ⚖️ İlan DEĞİL, süreç bilgisi (İŞKUR sınırı): CareerDisclaimer dilinin öğrenci karşılığı hub'ın ilk satırında.
 * DÜRÜST İSKELET: TUS verisi (ÖSYM) ve fırsat takvimi boş başlar (lib/tus · lib/edu-opportunities) — grafik/uydurma satır YOK.
 */

export const KARIYER_HREF = "/doktor/doctorium?m=kariyer";
export const TUS_HREF = "/doktor/doctorium/tus";
export const KARIYER_EDU_HREF = "/doktor/doctorium/kariyer-edu";

export function TusOfficialLinksPanel({ className = "" }: { className?: string }) {
  return (
    <AuraPanel title="Resmî kaynaklar" meta="ÖSYM" className={className}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {TUS_OFFICIAL_LINKS.map((l) => (
          <li key={l.href} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]"
            >
              {l.label} <ExternalLink size={14} aria-hidden />
            </a>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{l.note}</p>
          </li>
        ))}
      </ul>
    </AuraPanel>
  );
}

export function TusPeriodsPanel({ className = "" }: { className?: string }) {
  if (TUS_EXAM_PERIODS.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Taban puan ve kontenjan verisi hazırlanıyor"
        sub="ÖSYM'nin açık verisi (kılavuzlar, kontenjanlar, yerleştirme sonuçları) doğrulanıp yüklendiğinde branş bazlı eğilimler ve tercih simülasyonu burada görünecek. Şimdilik resmî kaynaklara doğrudan ulaşabilirsiniz."
      />
    );
  }
  // Yeni dönem üstte; başvuru penceresi yalnız takvimden çekilen dönemlerde dolu. Tarihler UTC ekseninde Türkçe.
  const rows = [...TUS_EXAM_PERIODS].reverse();
  const verified = rows.map((p) => p.verifiedAt).sort().at(-1);
  return (
    <AuraPanel title="Sınav dönemleri" meta="ÖSYM · KAYNAKLI" className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
              <th className="py-2 pr-3">Dönem</th><th className="py-2 pr-3">Başvuru</th><th className="py-2 pr-3">Sınav</th><th className="py-2 pr-3">Sonuç</th><th className="py-2">Kaynak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={`${p.year}-${p.term}`} className="border-t border-[var(--c-hairline)] text-[var(--c-ink-2)]">
                <td className="py-2 pr-3 font-medium whitespace-nowrap text-[var(--c-ink)]">{p.year}-TUS {p.term}. Dönem</td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.applicationStart && p.applicationEnd ? `${formatIsoDayTr(p.applicationStart)} – ${formatIsoDayTr(p.applicationEnd)}` : "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.examDate ? formatIsoDayTr(p.examDate) : "—"}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.resultDate ? formatIsoDayTr(p.resultDate) : "—"}</td>
                <td className="py-2"><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--c-accent)]">ÖSYM duyurusu</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Tarihler ÖSYM&apos;nin kendi duyuru ve sınav takvimi sayfalarından alınır{verified ? `; son doğrulama ${formatIsoDayTr(verified)}` : ""}. Bağlayıcı olan ÖSYM&apos;nin yayımladığı güncel metindir.
      </p>
    </AuraPanel>
  );
}

export function EduOpportunitiesPanel({ className = "" }: { className?: string }) {
  // Yalnız 👤 onaylı satırlar (approvedAt) — onaysız veri hiçbir yüzeyde görünmez; liste boşsa dürüst "hazırlanıyor".
  const rows = approvedEduOpportunities();
  if (rows.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Fırsat takvimi hazırlanıyor"
        sub="İlk sürüm elle derlenen kaynaklarla gelecek: TurkMSIC/IFMSA staj değişimi, Erasmus+ / Farabi / Mevlana, VSLO gözlemcilik ve seçmeli rotasyonlar, fakülteye özel programlar ve burslar. Son başvuru tarihleri Takvim'inize düşecek."
        action={
          <AuraButtonLink href="/doktor/doctorium/takvim"><CalendarDays size={15} aria-hidden /> Takvimim</AuraButtonLink>
        }
      />
    );
  }
  return (
    <AuraPanel title="Fırsat takvimi" meta={`KAYNAKLI · ${rows.length}`} className={className}>
      <ul className="divide-y divide-[var(--c-hairline)]">
        {rows.map((o) => (
          <li key={o.id} className="py-3.5">
            <div className="aura-mono flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-wider text-[var(--c-ink-3)]">
              <span className="text-[var(--c-accent)]">{EDU_KIND_LABEL[o.kind]}</span>
              <span aria-hidden>·</span>
              <span>{eduCountryLabel(o.country)}</span>
              <span aria-hidden>·</span>
              {o.deadline ? (
                <span className="text-[var(--c-ink-2)]">son başvuru {formatIsoDayTr(o.deadline)}</span>
              ) : (
                <span className="normal-case tracking-normal">{o.deadlineNote}</span>
              )}
            </div>
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">
              {o.title} <ExternalLink size={13} aria-hidden />
            </a>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]"><span className="font-medium text-[var(--c-ink)]">{o.organizer}</span> — {o.eligibility}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Başvuru daima kurumun kendi sayfasında yapılır; tarih ve şartlar kurum duyurularıyla değişebilir. Bu liste ilan değil, süreç bilgisidir.
      </p>
    </AuraPanel>
  );
}

/** Bölüm başı: mono etiket (kitle aksanı) + h2 + ayrıntı bağlantısı. Sahne h1'i page.tsx'te — burada yalnız h2. */
function SectionHead({ eyebrow, title, href }: { eyebrow: string; title: string; href: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-accent)]">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--c-ink)]">{title}</h2>
      </div>
      <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--c-accent)] hover:underline">
        Ayrıntı <ArrowRight size={13} aria-hidden />
      </Link>
    </div>
  );
}

/** Öğrencinin Kariyer sahnesi: Kariyer EDU (staj/değişim/burs) önce, TUS sonra — kullanıcı sırası. */
export function StudentCareerHub() {
  return (
    <div className="mt-6 space-y-10">
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        <Info size={13} className="mt-px shrink-0 text-[var(--c-accent)]" />
        Bu bölüm iş ilanı içermez; staj, değişim ve burs süreçlerini ve TUS&apos;un resmî verisini anlatır. Başvuru daima resmî kaynakta yapılır.
      </p>
      <section>
        <SectionHead eyebrow="KARİYER EDU" title="Staj, değişim ve burs takvimi" href={KARIYER_EDU_HREF} />
        <EduOpportunitiesPanel className="mt-4" />
      </section>
      <section>
        <SectionHead eyebrow="TUS" title="Tıpta Uzmanlık Sınavı" href={TUS_HREF} />
        <TusOfficialLinksPanel className="mt-4" />
        <TusPeriodsPanel className="mt-4" />
      </section>
    </div>
  );
}

/** Doktorun Kariyer sahnesinde, yol haritasının altında — yalnız Özelleştir anahtarı açıksa (viewPrefs.showTus). */
export function DoctorTusSection() {
  return (
    <section className="mt-10 border-t border-[var(--c-hairline)] pt-8">
      <SectionHead eyebrow="TUS" title="Tıpta Uzmanlık Sınavı" href={TUS_HREF} />
      <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">
        Bu bölümü Özelleştir&apos;den açtınız — uzmanlık sınavına hazırlananlar ve mentorlar için resmî kaynaklar ve sınav dönemleri.
      </p>
      <TusOfficialLinksPanel className="mt-4" />
      <TusPeriodsPanel className="mt-4" />
    </section>
  );
}
