import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, ExternalLink, Info } from "lucide-react";
import { TUS_EXAM_PERIODS, TUS_OFFICIAL_LINKS, TUS_SECTIONS, tusSectionHref } from "@/lib/tus";
import { EDU_KIND_LABEL, EDU_KIND_SHORT, EDU_KINDS, eduCountryLabel, type EduOpportunityKind } from "@/lib/edu-opportunities";
import { followedEduOpportunityIds, listApprovedEduOpportunities, type EduOpportunityView } from "@/lib/edu-store";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import EduFollowButton from "./EduFollowButton";
import { formatIsoDayTr } from "@/lib/iso-day";
import { approvedTusSummaries, tusBranches, type TusPeriodSummaryWithSource } from "@/lib/tus-data";
import { TUS_INSTITUTION_LABEL } from "@/lib/tus-normalize";
import TusChartsLoader from "./tus/TusChartsLoader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuraButtonLink } from "@/components/ui/AuraButton";

/**
 * KARİYER sekmesinin EDU bölümleri (üç katman B3, kullanıcı kararı 2026-09-05 akşam): "kariyer akışını öğrenciye
 * gösterme; Kariyer EDU ve TUS'u Kariyer'in İÇİNE koy — ekstra sekme açılmasın, Takvim en sonda kalsın."
 *  · StudentCareerHub  → ?m=kariyer ÖĞRENCİ sahnesinin FIRSATLAR sekmesi (doktorun denklik/yükselme yol haritası YERİNE çizilir).
 *    BÖLÜMLEME (2026-09-06, kullanıcı kararı "Kariyer çok karmaşık — Hukuk'taki gibi böl"): eskiden hub, fırsat takvimi + TUS'un
 *    6 panelini tek istifte çiziyordu. Artık 1. kademe çubuk (CareerSubnav: Fırsatlar | TUS) var; hub yalnız fırsatları (tür çipleri
 *    ?tur=staj|degisim|burs) gösterir, TUS /doktor/doctorium/tus rotasında ?bolum= ile üçe bölünür (TusSections).
 *  · DoctorTusSection  → doktor Özelleştir'den "Kariyer içinde TUS bölümünü göster" açarsa yol haritasının ALTINA gelir
 *    (rapor §2 "kapalı, gizli değil" — B1'deki raf sekmesi B3'te buraya indi); 2026-09-06'dan beri kısa: KPI + üç bölüm kartı.
 *  · Paneller /doktor/doctorium/tus sayfasıyla paylaşılır (tek markup). /kariyer-edu artık yönlendirmedir (Fırsatlar sekmesine).
 * Renk: sabit hex YOK — kit token'ı (--c-accent) kitleye göre zümrüt (doktor) / koral (öğrenci) olur.
 * ⚖️ İlan DEĞİL, süreç bilgisi (İŞKUR sınırı): CareerDisclaimer dilinin öğrenci karşılığı hub'ın ilk satırında.
 * DÜRÜST İSKELET: TUS verisi (ÖSYM) ve fırsat takvimi boş başlar (lib/tus · lib/edu-opportunities) — grafik/uydurma satır YOK.
 * K3/K4 (2026-09-05): rehberler (ÖSYM kılavuzu özetleri) + kaynakça/kurs dizini (tarafsız künye) TusGuideResourcePanels'ta;
 * hub'da compact, /doktor/doctorium/tus sayfasında tam. Onaysız kayıt görünmez. K5 (YÖK Atlas Tıp fakülteleri) TusYokSection'da — aynı desen.
 */

export const KARIYER_HREF = "/doktor/doctorium?m=kariyer";
export const TUS_HREF = "/doktor/doctorium/tus";

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

export async function EduOpportunitiesPanel({ className = "", kind = null, defaultKind = null }: { className?: string; kind?: EduOpportunityKind | null; defaultKind?: EduOpportunityKind | null }) {
  // E2 (2026-09-06): KALICI MODEL — onaylı satırlar DB'den (lib/edu-store; approvedAt null görünmez). Öğrenci "Takip et" → son başvuru
  // 7/3/1 gün kala bildirim + e-posta (lib/edu-reminder, daily-digest); tüm tarihli fırsatlar öğrenci Takvim'inde (👤 karar).
  // Tür çipleri (2026-09-06 bölümleme): Hepsi · Staj · Değişim · Burs (?tur=); sayılar onaylı satırlardan, süzgeç sunucuda.
  const [allRows, ctx] = await Promise.all([listApprovedEduOpportunities(), currentDoctoriumAudience()]);
  const rows = kind ? allRows.filter((o) => o.kind === kind) : allRows;
  const counts = Object.fromEntries(EDU_KINDS.map((k) => [k, allRows.filter((o) => o.kind === k).length])) as Record<EduOpportunityKind, number>;
  const chips: { key: EduOpportunityKind | null; label: string; n: number }[] = [
    { key: null, label: "Hepsi", n: allRows.length },
    ...EDU_KINDS.map((k) => ({ key: k, label: EDU_KIND_SHORT[k], n: counts[k] })),
  ];
  const chipRow = allRows.length > 0 && (
    <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Fırsat türü">
      {chips.map((c) => {
        const on = c.key === kind;
        return (
          <Link
            key={c.label}
            href={c.key ? `${KARIYER_HREF}&tur=${c.key}` : defaultKind ? `${KARIYER_HREF}&tur=hepsi` : KARIYER_HREF}
            aria-current={on ? "true" : undefined}
            className={`aura-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              on
                ? "bg-[var(--c-accent)]/15 text-[var(--c-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-accent)_55%,transparent)]"
                : "bg-[var(--c-surface)] text-[var(--c-ink-2)] shadow-[inset_0_0_0_1px_var(--c-hairline)] hover:text-[var(--c-ink)]"
            }`}
          >
            {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
          </Link>
        );
      })}
    </div>
  );
  const canFollow = !!ctx?.doctorId && ctx.flags.showsStudentSurfaces;
  const followed = canFollow ? await followedEduOpportunityIds(ctx?.doctorId as string) : new Set<string>();
  if (allRows.length === 0) {
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
    <AuraPanel title="Fırsat takvimi" meta={`KAYNAKLI · ${rows.length}${kind ? ` / ${allRows.length}` : ""}${canFollow && followed.size ? ` · TAKİP ${followed.size}` : ""}`} className={className}>
      {chipRow}
      {rows.length === 0 && <p className="py-3 text-[13px] text-[var(--c-ink-2)]">Bu türde onaylı fırsat yok; diğer türlere çiplerden geçebilirsiniz.</p>}
      <ul className="divide-y divide-[var(--c-hairline)]">
        {rows.map((o) => (
          <EduOpportunityRow
            key={o.id}
            id={`edu-${o.id}`}
            o={o}
            action={canFollow && o.deadline ? <EduFollowButton opportunityId={o.id} following={followed.has(o.id)} /> : undefined}
          />
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Başvuru daima kurumun kendi sayfasında yapılır; tarih ve şartlar kurum duyurularıyla değişebilir. Bu liste ilan değil, süreç bilgisidir.
        {canFollow && <> Takip ettiğiniz fırsatın son başvurusu 7, 3 ve 1 gün kala bildirim ve e-postayla hatırlatılır; tarihli fırsatların hepsi Takvim&apos;inizde görünür.</>}
      </p>
    </AuraPanel>
  );
}

/**
 * Fırsat satırı — Fırsatlar paneli (portal) + landing Öğrenciler kanıt penceresi AYNI markup (v6.262, 2026-09-10: landing
 * kuralı "ProductFrame içinde gerçek ürün bileşeni"). `action` = takip düğmesi (yalnız girişli öğrenci; landing vermez).
 * `clampEligibility`: landing'de şart metni iki satıra kırpılır (kart yüksekliği), portalda tam. Kit token'ı (--c-accent)
 * kitleye göre çözülür — landing öğrenci kapsamını sarmalayıcıyla verir.
 */
export function EduOpportunityRow({ o, action, clampEligibility = false, id }: { o: EduOpportunityView; action?: ReactNode; clampEligibility?: boolean; id?: string }) {
  return (
    <li id={id} className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
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
          <p className={`mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)] ${clampEligibility ? "line-clamp-2" : ""}`}>
            <span className="font-medium text-[var(--c-ink)]">{o.organizer}</span> — {o.eligibility}
          </p>
        </div>
        {action}
      </div>
    </li>
  );
}

/**
 * Son dönem KPI şeridi (GENEL kontenjan) — TusPlacementSection (portal) + landing Öğrenciler kanıt penceresi (v6.262).
 * Yerleşme oranı tr-TR biçiminde ("%82,3"; eski `Math.round(...)/10` şablonu "%82.3" noktalı yazıyordu — düzeltildi).
 */
export function TusKpiStrip({ last }: { last: TusPeriodSummaryWithSource }) {
  const g = last.totals.general;
  const rate = g.quota ? `%${((g.placed / g.quota) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : "—";
  const kpis = [
    { k: "Kontenjan (GENEL)", v: g.quota }, { k: "Yerleşen", v: g.placed }, { k: "Boş kalan", v: g.vacant },
    { k: "Yerleşme oranı", v: rate },
  ];
  return (
    <>
      <div className="aura-mono text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">{last.year}-TUS {last.term}. Dönem · son dönem</div>
      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((x) => (
          <div key={x.k} className="flex flex-col rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5">
            <dt className="text-[11px] leading-snug text-[var(--c-ink-3)]">{x.k}</dt>
            <dd className="aura-display mt-auto pt-0.5 text-xl font-semibold tabular-nums text-[var(--c-ink)]">{typeof x.v === "number" ? x.v.toLocaleString("tr-TR") : x.v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/**
 * TUS yerleştirme verisi (K1, 2026-09-05): onaylı dönem özetleri (lib/tus-data) → KPI şeridi (son dönem) + Recharts grafikleri
 * (client, dinamik). Onaylı dönem yoksa dürüst "hazırlanıyor". `compact` (Kariyer hub'ı): yalnız KPI + ayrıntı bağlantısı.
 */
export function TusPlacementSection({ className = "", compact = false, initialBranch = null }: { className?: string; compact?: boolean; initialBranch?: string | null }) {
  const periods = approvedTusSummaries();
  if (periods.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Kontenjan ve taban puan verisi hazırlanıyor"
        sub="ÖSYM'nin yerleştirme tabloları (en küçük/en büyük puanlar) dönem dönem doğrulanıp onaylandığında branş bazlı eğilimler burada görünecek."
      />
    );
  }
  const last = periods[periods.length - 1];
  return (
    <AuraPanel title={<span id="yerlestirme">Yerleştirme verisi</span>} meta={`ÖSYM · ${periods.length} DÖNEM`} className={className}>
      <TusKpiStrip last={last} />
      {compact ? (
        <p className="mt-3 text-[12px] text-[var(--c-ink-2)]">
          Branş bazlı taban puan eğilimi, kurum türüne göre yerleşme ve puan dağılımı grafikleri ile branş × dönem kurum tablosu (ek yerleştirme dâhil) TUS sayfasında —{" "}
          <Link href={TUS_HREF} className="font-semibold text-[var(--c-accent)] hover:underline">Ayrıntı</Link>.
        </p>
      ) : (
        <div className="mt-5">
          <TusChartsLoader periods={periods} branches={tusBranches(periods)} institutionLabels={TUS_INSTITUTION_LABEL} initialBranch={initialBranch && tusBranches(periods).some((b) => b.branch === initialBranch) ? initialBranch : "İÇ HASTALIKLARI"} />
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Sayılar ÖSYM&apos;nin dönem tablolarından alınır (kaynak bağlantıları TUS sayfasında); GENEL kontenjan esas alınır, yabancı uyruklu
        kontenjan ayrı tutulur. Geçmiş veridir; tercih tavsiyesi değildir.
      </p>
    </AuraPanel>
  );
}

/** Bölüm başı: mono etiket (kitle aksanı) + h2 + ayrıntı bağlantısı. Sahne h1'i page.tsx'te — burada yalnız h2. */
function SectionHead({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-accent)]">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--c-ink)]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--c-accent)] hover:underline">
          Ayrıntı <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * Öğrencinin Kariyer sahnesi — FIRSATLAR sekmesi (2026-09-06 bölümleme): yalnız staj · değişim · burs takvimi, tür çipleriyle.
 * TUS artık aynı çubuğun ikinci sekmesi (/doktor/doctorium/tus). Sahne h1'i ve 1. kademe çubuk page.tsx'te; burada başlık katmanı
 * eklenmez (h1 + çubuk + panel başlığı yeter — üçüncü başlık gürültüydü).
 */
export function StudentCareerHub({ kind = null, defaultKind = null }: { kind?: EduOpportunityKind | null; defaultKind?: EduOpportunityKind | null }) {
  return (
    <div className="mt-5 space-y-4">
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        <Info size={13} className="mt-px shrink-0 text-[var(--c-accent)]" />
        Bu bölüm iş ilanı içermez; staj, değişim ve burs süreçlerini anlatır. Başvuru daima resmî kaynakta yapılır.
      </p>
      <EduOpportunitiesPanel kind={kind} defaultKind={defaultKind} />
    </div>
  );
}

/**
 * Doktorun Kariyer sahnesinde, yol haritasının altında — yalnız Özelleştir anahtarı açıksa (viewPrefs.showTus).
 * 2026-09-06 bölümleme: 5 panel yerine son dönem KPI'sı + TUS'un üç bölümüne kart bağlantıları (aynı sadeleşme doktora da).
 */
export function DoctorTusSection() {
  return (
    <section className="mt-10 border-t border-[var(--c-hairline)] pt-8">
      <SectionHead eyebrow="TUS" title="Tıpta Uzmanlık Sınavı" href={TUS_HREF} />
      <p className="mt-2 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">
        Bu bölümü Özelleştir&apos;den açtınız — uzmanlık sınavına hazırlananlar ve mentorlar için resmî veri, kılavuz özetleri ve sınav dönemleri.
      </p>
      <TusPlacementSection className="mt-4" compact />
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {TUS_SECTIONS.map((sec) => (
          <li key={sec.key}>
            <Link href={tusSectionHref(sec.key)} className="block h-full rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4 transition hover:border-[var(--c-accent)]/50">
              <div className="aura-mono inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--c-accent)]">
                {sec.label} <ArrowRight size={11} aria-hidden />
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">{sec.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
