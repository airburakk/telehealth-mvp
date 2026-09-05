import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { careerPathwayBySlug, parseSteps, parseStringList, todayModuleCounts } from "@/lib/doctorium";
import { DoctoriumShell } from "../../DoctoriumSidebar";
import { CareerDisclaimer, careerDate } from "../../CareerShared";
import {
  ArrowLeft, Building2, ExternalLink, FileText, GraduationCap, Info, Languages, ListChecks, ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kariyer" };

/**
 * Kariyer süreç kartı (v6.89) — bir denklik/kariyer sürecinin adımları ve belge listesi.
 *
 * VERİ DÜRÜSTLÜĞÜ (MedicalCongress kartıyla aynı ilke): alanlar yalnız DOLUYSA basılır; boş alan
 * "bilinmiyor" diye uydurulmaz. `typicalMonths` çoğu kayıtta BOŞTUR — resmî kaynakta yazmayan
 * süre tahmin edilmez (yanlış süre = doktorun yanlış planlaması). Doğrulama tarihi ve "teyit
 * bekliyor" ibaresi kartta GÖRÜNÜR; bayatlık gizlenmez.
 *
 * ⚖️ İŞ İLANI DEĞİL: başvuru butonu, işveren teması, CV gönderimi YOKTUR — üyelik arkasında ilan
 * sunmak İŞKUR'a göre "aracılık"tır (özel istihdam bürosu izni gerekir, envanter §3). Sayfa
 * yalnız resmî kaynağa YÖNLENDİRİR; başvuru doktorun kendisi tarafından resmî otoritede yapılır.
 */
export default async function CareerPathwayPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const { slug } = await params;
  const p = await careerPathwayBySlug(slug);
  if (!p) notFound();

  const steps = parseSteps(p.steps);
  const documents = parseStringList(p.documents);
  const sources = parseStringList(p.sourceUrls);

  // Üst raf detayda da SABİT (kullanıcı isteği 2026-08-18) — aktif sekme Kariyer. (Eski puan
  // rozeti hesabı 2026-09-05'te kalktı — Shell'in balance/isDoctor prop'ları söküldü.)

  return (
    <DoctoriumShell active="kariyer" counts={await todayModuleCounts()}>
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link
        href={`/doktor/doctorium?m=kariyer${p.scope === "turkiye" ? "&t=turkiye" : ""}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
      >
        <ArrowLeft size={15} /> Kariyer
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          {p.confidence === "kismi" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              ⚠️ Teyit bekliyor
            </span>
          )}
          <span className="text-[10px] text-[var(--c-ink-3)]">Son doğrulama: {careerDate(p.verifiedAt)}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold text-[var(--c-ink)]">{p.title}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--c-ink-3)]">
          <Building2 size={13} /> {p.authority}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--c-ink-2)]">{p.summary}</p>
      </header>

      {/* Kayda özgü uyarı (eyalet farkı · statü farkı · sınav geçişi) — doluysa ÖNE çıkar. */}
      {p.warning && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-200/90">
          <Info size={14} className="mt-px shrink-0" /> {p.warning}
        </p>
      )}

      {/* Dil · sınav · süre — YALNIZ dolu olanlar. typicalMonths çoğu kayıtta boştur (bilinçli). */}
      {(p.languageReq || p.examReq || p.typicalMonths || p.costNote) && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {p.languageReq && (
            <Field icon={<Languages size={13} />} label="Dil şartı" value={p.languageReq} />
          )}
          {p.examReq && (
            <Field icon={<GraduationCap size={13} />} label="Sınav" value={p.examReq} />
          )}
          {p.typicalMonths && (
            <Field icon={<Info size={13} />} label="Resmî kaynakta belirtilen süre" value={p.typicalMonths} />
          )}
          {p.costNote && <Field icon={<Info size={13} />} label="Ücret" value={p.costNote} />}
        </dl>
      )}

      {steps.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">
            <ListChecks size={15} className="text-[var(--c-accent)]" /> Adımlar
          </h2>
          <ol className="mt-3 grid gap-3">
            {steps.map((s, i) => (
              <li
                key={`${s.order}-${i}`}
                className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span className="rounded-full bg-[var(--c-accent)]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--c-accent)]">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--c-ink)]">{s.title}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">{s.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {documents.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">
            <FileText size={15} className="text-[var(--c-accent)]" /> Gerekli belgeler
          </h2>
          <ul className="mt-3 grid gap-1.5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
            {documents.map((d) => (
              <li key={d} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--c-ink-2)]">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--c-accent)]/70" /> {d}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--c-ink-3)]">
            Belge listesi başvuru anına ve otoriteye göre değişebilir — nihai listeyi resmî kaynaktan
            teyit edin.
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">
          <ShieldCheck size={15} className="text-[var(--c-accent)]" /> Resmî kaynak
        </h2>
        <a
          href={p.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 break-all text-xs font-semibold text-[var(--c-accent)] hover:underline"
        >
          {p.officialUrl} <ExternalLink size={12} className="shrink-0" />
        </a>

        {sources.length > 1 && (
          <details className="mt-3 text-[11px] text-[var(--c-ink-3)]">
            <summary className="cursor-pointer list-none font-semibold text-[var(--c-ink-2)] [&::-webkit-details-marker]:hidden">
              Bu bilgi nereden geliyor?
            </summary>
            <ul className="mt-2 grid gap-1">
              {sources.map((u) => (
                <li key={u}>
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all hover:text-[var(--c-ink)] hover:underline"
                  >
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <CareerDisclaimer />
    </div>
    </DoctoriumShell>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3">
      <dt className="flex items-center gap-1.5 text-[11px] text-[var(--c-ink-3)]">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{value}</dd>
    </div>
  );
}
