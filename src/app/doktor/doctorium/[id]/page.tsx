import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  articleById, ensureClinicalSummary, ensureRegulationSummary,
  KIND_LABEL, branchLabel, categoryLabel,
} from "@/lib/doctorium";
import { branchColor } from "@/lib/branch-visuals";
import { extractKeywords, extractLawRefs } from "@/lib/hukuk-keywords";
import {
  ArrowLeft, ExternalLink, Sparkles, AlertTriangle, FlaskConical, ListChecks,
  ShieldQuestion, Gavel, Users, CalendarCheck, FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium yayın detayı — 2 dakikalık Türkçe klinik özet burada TEMBEL üretilir (ilk açılışta bir kez,
// sonra DB'den). Okunmayan yayınlar için AI parası ödenmez.
export default async function DoctoriumArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const { id } = await params;
  const item = await articleById(id);
  if (!item) notFound();

  // Akademik yayın → 2 dk klinik özet · mevzuat/sektörel/ilaç → doktor özeti + aksiyon maddeleri.
  // İkisi de TEMBEL: ilk açılışta bir kez üretilir, sonra DB'den okunur.
  // İçtihat (v6.86) İKİSİNE DE GİRMEZ: mevzuat özet şablonu ("yürürlük/aksiyon maddeleri") yargı
  // kararına uymaz ve karar metni zaten tam gösterilir; AI özet bilinçli YOK (Faz 3 adayı).
  const isAcademic = item.module === "akademik";
  const isIctihat = item.category === "ictihat";
  const summary = isAcademic ? await ensureClinicalSummary(id) : null;
  const reg = isAcademic || isIctihat ? null : await ensureRegulationSummary(id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.branchSlugs.map((s) => (
          <span key={s} className="aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: branchColor(branchLabel(s)), background: `${branchColor(branchLabel(s))}1f` }}>
            {branchLabel(s)}
          </span>
        ))}
        {categoryLabel(item.category) && (
          <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
            {categoryLabel(item.category)}
          </span>
        )}
        <span className="text-[11px] text-[var(--c-ink-3)]">
          {KIND_LABEL[item.kind] ?? item.kind} · {item.sourceName} ·{" "}
          {item.publishedAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
      </div>

      <h1 className="aura-display mt-2 text-2xl font-medium leading-snug tracking-tight text-[var(--c-ink)]">{item.title}</h1>
      {item.titleOriginal && <p className="mt-1 text-sm italic text-[var(--c-ink-3)]">{item.titleOriginal}</p>}
      {item.authors && <p className="mt-2 text-xs text-[var(--c-ink-2)]">{item.authors}</p>}

      {/* AI klinik özet — varsa. Uyarı bandı KALDIRILAMAZ: bu bir karar destek aracı değildir. */}
      {summary && (
        <section className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Sparkles size={16} /> 2 dakikalık klinik özet
          </h2>

          <div className="mt-3.5">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              <ListChecks size={13} /> Ana çıkarımlar
            </h3>
            <ul className="mt-1.5 grid gap-1.5">
              {summary.takeaways.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--c-ink)]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <FlaskConical size={13} /> Çalışma tasarımı
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.design}</p>
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <ShieldQuestion size={13} /> Kısıtlılıklar
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.limits}</p>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 border-t border-emerald-400/20 pt-3 text-[11px] leading-relaxed text-amber-200/90">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            Bu özet yapay zekâ ile üretilmiştir ve <strong>klinik karar aracı değildir</strong>. Hasta
            bakımına ilişkin her karardan önce yayının tam metnini kendiniz değerlendirin.
          </p>
        </section>
      )}

      {/* Mevzuat / sektörel / ilaç → doktor özeti. Kaynak metni çekilip AI ile yapılandırılır. */}
      {reg?.state === "ok" && (
        <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Gavel size={16} /> Doktor özeti
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--c-ink)]">{reg.data.summary}</p>

          {reg.data.actions.length > 0 && (
            <div className="mt-4">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <ListChecks size={13} /> Aksiyon maddeleri
              </h3>
              <ul className="mt-1.5 grid gap-1.5">
                {reg.data.actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--c-ink)]">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <Users size={13} /> Kimi etkiliyor
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{reg.data.affected}</p>
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <CalendarCheck size={13} /> Yürürlük
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{reg.data.effective}</p>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 border-t border-amber-400/20 pt-3 text-[11px] leading-relaxed text-amber-200/90">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            Bu özet yapay zekâ ile üretilmiştir ve <strong>hukuki görüş değildir</strong>. Bağlayıcı
            olan resmî metindir; aşağıdaki kaynaktan tam metni doğrulayın.
          </p>
        </section>
      )}

      {reg?.state === "pdf" && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          <FileText size={15} className="mt-px shrink-0" />
          Bu kalemin resmî metni <strong>PDF</strong> olarak yayımlanmış; otomatik özet çıkarılmıyor.
          Aşağıdaki bağlantıdan resmî metne ulaşabilirsiniz.
        </p>
      )}

      {reg?.state === "unavailable" && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          <AlertTriangle size={15} className="mt-px shrink-0" />
          Özet şu anda üretilemedi (kaynak metne ulaşılamadı). Aşağıdaki bağlantıdan resmî metni
          açabilirsiniz; sayfayı sonra yenilediğinizde özet oluşmuş olabilir.
        </p>
      )}

      {/* İçtihat etiketleri (v6.87): metinde GEÇEN kanun maddeleri + sözlük terimleri —
          kartla aynı deterministik çıkarım; terim çipi arşivin süzülmüş listesine götürür. */}
      {isIctihat && item.summary && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {extractLawRefs(item.summary).map((l) => (
            <span key={l} className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
              {l}
            </span>
          ))}
          {extractKeywords(item.summary).map((k) => (
            <Link
              key={k.key}
              href={`/doktor/doctorium?m=mevzuat&h=ictihat&k=${k.key}`}
              className="aura-mono rounded-full bg-rose-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-rose-300/90 hover:bg-rose-500/15"
            >
              {k.label}
            </Link>
          ))}
        </div>
      )}

      {/* İçtihat (v6.86): SPA kaynakta karara kalıcı derin link yok → dış buton yerine E./K.
          numarasıyla resmî sistemde doğrulama yönergesi. Uyarı bandı kaldırılamaz. */}
      {isIctihat && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/[0.06] px-4 py-3.5 text-[11px] leading-relaxed text-[var(--c-ink-2)]">
          <AlertTriangle size={14} className="mt-px shrink-0 text-rose-300" />
          <span>
            Bu metin <strong className="text-[var(--c-ink)]">Yargıtay Karar Arama</strong>{" "}
            (karararama.yargitay.gov.tr) kaydından alınmıştır ve <strong className="text-[var(--c-ink)]">hukuki
            mütalaa değildir</strong>. Karara dayanmadan önce aslını, başlıktaki esas/karar
            numarasıyla resmî sistemden doğrulayın.
          </span>
        </p>
      )}

      {item.summary && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
            {isAcademic ? "Özgün abstract" : isIctihat ? "Karar metni" : "Resmî metinden"}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--c-ink-2)]">
            {/* İçtihat: hukuki metin kesilmez (karar bütünlüğü); diğerlerinde 2500 kr kesit. */}
            {isAcademic || isIctihat ? item.summary : item.summary.slice(0, 2500)}
          </p>
        </section>
      )}

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer nofollow"
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-[var(--c-hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--c-accent-stronger)] hover:bg-[var(--c-surface)]">
          <ExternalLink size={15} />
          {item.doi ? "Yayının tam metnine git (DOI)" : "Kaynağa git"}
        </a>
      )}
    </div>
  );
}
