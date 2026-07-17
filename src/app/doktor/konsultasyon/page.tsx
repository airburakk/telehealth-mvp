import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { openRequestsForDoctor, answeredByDoctor, answeredStatsForDoctor, engagedByDoctor, PAYMENT_PER_ANSWER, type ConsultReqView, type ConsultDocView } from "@/lib/consultation-requests";
import { formatUSD } from "@/lib/pricing";
import { loincForBranchLabel } from "@/data/coding";
import { imagingForBranch } from "@/data/imaging";
import { medicationsForBranch } from "@/data/medications";
import { ConsultAnswerForm, type CatalogProps } from "./ConsultAnswerForm";
import { ConsultationChat } from "@/components/ConsultationChat";
import { VideoControls } from "@/components/VideoControls";
import { PresencePinger } from "@/components/PresencePinger";
import { Inbox, ShieldCheck, ArrowLeft, Globe, Languages, Stethoscope, Wallet, FileText, FlaskConical, AlertTriangle, Pill, Scan, MessagesSquare } from "lucide-react";

export const dynamic = "force-dynamic";

// M5 — Konsültasyon Talepleri gelen kutusu (anonim hasta dosyaları + belge AI + kodlu öneriler).
export default async function ConsultationInboxPage() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id }, select: { doctorId: true } }) : null;
  const doctor = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId } }) : null;

  if (!doctor) redirect("/doktor");
  if (!doctor.consultOptIn) redirect("/doktor"); // panel görünürlüğüyle tutarlı

  const [open, engaged, answered, stats] = await Promise.all([
    openRequestsForDoctor(doctor.branch),
    engagedByDoctor(doctor.id),
    answeredByDoctor(doctor.id),
    answeredStatsForDoctor(doctor.id), // kümülatif — liste take 20 ile sınırlı, reduce yanlış olurdu
  ]);
  const totalEarned = stats.totalEarned;

  // Kodlu öneri katalogları (branşa göre öne çıkar) — yanıt formuna geçer.
  const catalog: CatalogProps = {
    labs: loincForBranchLabel(doctor.branch).map((e) => ({ loinc: e.code, name: e.label })),
    imaging: imagingForBranch(doctor.branch).map((e) => ({ code: e.code, system: "http://loinc.org", name: e.label })),
    meds: medicationsForBranch(doctor.branch).map((m) => ({ atc: m.atc, name: m.name })),
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <PresencePinger />
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Konsültasyon Talepleri</h1>
          <p className="mt-1 text-sm text-[var(--c-ink-2)]">Partner doktorlardan gelen anonimleştirilmiş hasta dosyaları. Yanıt başına {formatUSD(PAYMENT_PER_ANSWER)} (simüle).</p>
        </div>
        <div className="shrink-0 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-300"><Wallet size={14} /> Hakediş</div>
          <div className="text-lg font-bold text-emerald-300">{formatUSD(totalEarned)}</div>
          <div className="text-[10px] text-emerald-300/80">{stats.count} yanıt</div>
        </div>
      </div>

      {/* Mahremiyet bilgi şeridi */}
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-3 text-xs text-indigo-200">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>Bu dosyalar otomatik <strong>anonimleştirme</strong> katmanından geçti — hasta adı, kimlik numarası ve ham görüntüler kaldırıldı. Belgeler AI ile değerlendirilip Türkçeye çevrildi; yalnız klinik içerik gösterilir.</span>
      </div>

      {/* Açık talepler */}
      <h2 className="mt-7 flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]"><Inbox size={16} /> Açık talepler ({open.length})</h2>
      {open.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-center text-sm text-[var(--c-ink-2)]">Şu an açık konsültasyon talebi yok.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {open.map((r) => <OpenCard key={r.id} r={r} catalog={catalog} />)}
        </div>
      )}

      {/* Devam eden görüşmeler — bu doktorun sahiplendiği (IN_DISCUSSION) talepler: chat + nihai görüş */}
      {engaged.length > 0 && (
        <>
          <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]"><MessagesSquare size={16} className="text-sky-300" /> Devam eden görüşmeler ({engaged.length})</h2>
          <div className="mt-3 space-y-4">
            {engaged.map((r) => <OpenCard key={r.id} r={r} catalog={catalog} engaged />)}
          </div>
        </>
      )}

      {/* Yanıtladıklarım */}
      {answered.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-[var(--c-ink)]">Yanıtladıklarım (son {answered.length} / toplam {stats.count})</h2>
          <div className="mt-3 space-y-3">
            {answered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <BranchTag r={r} />
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">{formatUSD(r.paymentSim ?? 0)} · yanıtlandı</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--c-ink-2)]">{r.summaryTr || r.clinicalSummary}</p>
                <div className="mt-2 rounded-xl bg-[var(--c-surface)] p-3 text-sm text-[var(--c-ink)]"><span className="text-xs font-semibold text-[var(--c-ink-3)]">Görüşünüz: </span>{r.answerText}</div>
                <RecommendationsView r={r} />
                <Link href={`/fhir/ConsultationRequest/${r.id}`} target="_blank" className="mt-2 inline-block text-xs text-indigo-300 hover:underline">FHIR Bundle ↗</Link>
                <div className="mt-3 space-y-3">
                  <VideoControls requestId={r.id} role="doctor" />
                  <ConsultationChat requestId={r.id} canSend compact />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BranchTag({ r }: { r: ConsultReqView }) {
  return (
    <span className="inline-flex items-center gap-2 text-[var(--c-ink-2)]">
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">
        <Stethoscope size={12} /> {r.branch ?? "Genel havuz"}
      </span>
      {r.urgency >= 4 && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-300">acil {r.urgency}/5</span>}
    </span>
  );
}

// Yüklenen belgelerin AI değerlendirmesi (tür + TR çeviri + özet + anormal bayrak + LOINC lab tablosu).
function DocumentsBlock({ docs }: { docs: ConsultDocView[] }) {
  if (!docs.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Yüklenen belgeler (AI değerlendirme)</div>
      {docs.map((d) => (
        <div key={d.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--c-ink)]">
            <FileText size={14} className="text-[var(--c-ink-3)]" /> {d.label}
            {d.docType && <span className="rounded-full bg-[var(--c-ink)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--c-ink-2)]">{d.docType}</span>}
            {!d.assessed && <span className="text-[10px] text-amber-300">değerlendirilmedi</span>}
          </div>
          {d.aiFlags && d.aiFlags.toLowerCase() !== "yok" && (
            <p className="mt-1.5 inline-flex items-start gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300"><AlertTriangle size={13} className="mt-px shrink-0" /> {d.aiFlags}</p>
          )}
          {d.aiSummary && <p className="mt-1.5 text-xs text-[var(--c-ink-2)]"><span className="font-semibold text-[var(--c-ink-2)]">Özet: </span>{d.aiSummary}</p>}
          {d.aiTranslation && <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--c-ink-2)]"><span className="font-semibold">TR çeviri: </span>{d.aiTranslation}</p>}
          {d.aiLabs.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><FlaskConical size={12} /> Laboratuvar (LOINC)</div>
              <table className="w-full text-xs">
                <tbody>
                  {d.aiLabs.map((l, i) => (
                    <tr key={i} className="border-t border-[var(--c-hairline)]">
                      <td className="py-1 pr-2 text-[var(--c-ink-2)]">{l.name}{l.loinc ? <span className="ml-1 font-mono text-[9px] text-[var(--c-ink-3)]">{l.loinc}</span> : null}</td>
                      <td className="py-1 text-right font-medium text-[var(--c-ink)]">{l.value}{l.unit ? ` ${l.unit}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Doktorun verdiği yapılandırılmış öneriler (lab/görüntüleme/ilaç) — okunabilir özet.
function RecommendationsView({ r }: { r: ConsultReqView }) {
  if (!r.recommendedLabs.length && !r.recommendedImaging.length && !r.medications.length) return null;
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      {r.recommendedLabs.length > 0 && (
        <div className="rounded-xl border border-[var(--c-hairline)] p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><FlaskConical size={12} /> Lab</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.recommendedLabs.map((l, i) => <li key={i}>{l.name}{l.loinc ? <span className="ml-1 font-mono text-[9px] text-[var(--c-ink-3)]">{l.loinc}</span> : null}</li>)}</ul>
        </div>
      )}
      {r.recommendedImaging.length > 0 && (
        <div className="rounded-xl border border-[var(--c-hairline)] p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><Scan size={12} /> Görüntüleme</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.recommendedImaging.map((l, i) => <li key={i}>{l.name}{l.code ? <span className="ml-1 font-mono text-[9px] text-[var(--c-ink-3)]">{l.code}</span> : null}</li>)}</ul>
        </div>
      )}
      {r.medications.length > 0 && (
        <div className="rounded-xl border border-[var(--c-hairline)] p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><Pill size={12} /> İlaç (ATC)</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.medications.map((m, i) => <li key={i}>{m.name} <span className="font-mono text-[9px] text-[var(--c-ink-3)]">{m.atc}</span>{m.dose ? ` · ${m.dose}` : ""}{m.freq ? ` · ${m.freq}` : ""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function OpenCard({ r, catalog, engaged }: { r: ConsultReqView; catalog: CatalogProps; engaged?: boolean }) {
  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BranchTag r={r} />
        <div className="flex items-center gap-3 text-xs text-[var(--c-ink-3)]">
          <span className="inline-flex items-center gap-1"><Globe size={12} /> {r.region}</span>
          <span className="inline-flex items-center gap-1"><Languages size={12} /> {r.language}</span>
          {r.icd10Code && <span className="rounded bg-[var(--c-ink)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--c-ink-2)]">{r.icd10Code}</span>}
        </div>
      </div>
      {r.requestedByName && <p className="mt-2 text-xs text-[var(--c-ink-3)]">Talep eden: {r.requestedByName} (Partner)</p>}
      {/* Klinik özet — Türkçe (varsa) öncelikli; kaynak dil farklıysa altta */}
      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--c-ink)]">{r.summaryTr || r.clinicalSummary}</p>
      {r.summaryTr && r.summaryTr !== r.clinicalSummary && (
        <details className="mt-1 text-xs text-[var(--c-ink-3)]"><summary className="cursor-pointer">Özgün metin ({r.language})</summary><p className="mt-1 whitespace-pre-wrap">{r.clinicalSummary}</p></details>
      )}
      <DocumentsBlock docs={r.documents} />

      {engaged ? (
        // Sahiplenilmiş görüşme: görüntülü öner + chat açık + nihai görüş formu
        <div className="mt-4 space-y-3">
          <VideoControls requestId={r.id} role="doctor" />
          <ConsultationChat requestId={r.id} canSend />
          <ConsultAnswerForm id={r.id} catalog={catalog} />
        </div>
      ) : (
        // Açık talep: doğrudan yanıtla VEYA önce soru sor (ilk mesaj talebi üstlenir)
        <div className="mt-4 space-y-3">
          <ConsultAnswerForm id={r.id} catalog={catalog} />
          <details className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--c-ink-2)]"><MessagesSquare size={13} /> Önce soru sor (bu talebi üstlenirsiniz)</summary>
            <div className="mt-2"><ConsultationChat requestId={r.id} canSend hintKey="İlk sorunuzu gönderdiğinizde bu talebi üstlenirsiniz." /></div>
          </details>
        </div>
      )}
    </div>
  );
}
