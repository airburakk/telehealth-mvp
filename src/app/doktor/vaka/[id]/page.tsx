import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { countryFlag, countryName, urgencyStyle, CASE_STATUS, formatDateTime } from "@/lib/constants";
import { StartConsultButton } from "@/components/StartConsultButton";
import { TranslateButton } from "@/components/TranslateButton";
import { DischargeReport, type Structured } from "@/components/DischargeReport";
import { CaseDicom } from "@/components/CaseDicom";
import { FhirCodingForm } from "@/components/FhirCodingForm";
import { icd10ForBranchLabel, loincForBranchLabel } from "@/data/coding";
import { LabResultsForm } from "@/components/LabResultsForm";
import { caseDicomStudies } from "@/lib/case-dicom";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Stethoscope, Globe, Clock, Languages, Brain, Luggage, HeartPulse, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id }, include: { doctor: true } });
  if (!c) notFound();

  const u = urgencyStyle(c.urgency);
  const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
  const files = c.attachments ? c.attachments.split(",").filter(Boolean) : [];
  const dicomStudies = caseDicomStudies(c.id);
  const suggested = await db.doctor.findFirst({ where: { branch: c.branch } });

  let dischargeStructured: Structured | null = null;
  try { dischargeStructured = c.dischargeStructured ? (JSON.parse(c.dischargeStructured) as Structured) : null; } catch { dischargeStructured = null; }

  let triageAnswers: Record<string, string> | null = null;
  try { triageAnswers = c.extra ? (JSON.parse(c.extra) as Record<string, string>) : null; } catch { triageAnswers = null; }

  let labResults: { loinc?: string; name?: string; value?: string; unit?: string }[] = [];
  try { const p = c.labResults ? JSON.parse(c.labResults) : []; if (Array.isArray(p)) labResults = p; } catch { labResults = []; }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A7D77]">
        <ArrowLeft size={16} /> Vaka kuyruğu
      </Link>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Sol: Vaka kartı (kokpit) */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-800">{c.patientName}</h1>
                  <span className="text-sm text-slate-400">{countryFlag(c.country)} {countryName(c.country)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1"><Languages size={14} /> {c.language}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatDateTime(c.createdAt)}</span>
                  <span className="inline-flex items-center gap-1"><Stethoscope size={14} /> <span className="font-medium text-[#0A7D77]">{c.branch}</span></span>
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {c.urgency}/5 · {u.label}
              </span>
            </div>

            <div className="mt-5">
              <SectionTitle icon={<FileText size={15} />}>Şikayet</SectionTitle>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{c.symptoms}</p>
              {c.durationText && <p className="mt-1 text-xs text-slate-400">Süre: {c.durationText}</p>}
              <TranslateButton text={c.symptoms} defaultTarget="Türkçe" />
            </div>

            <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <SectionTitle icon={<Sparkles size={15} />} tone="text-teal-700">AI Triyaj Gerekçesi</SectionTitle>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.reasoning}</p>
              <div className="mt-2 text-xs text-slate-400">Güven skoru: %{c.confidence}</div>
            </div>
          </div>

          {/* Branş ön-değerlendirme yanıtları (dinamik triyaj soruları) */}
          {triageAnswers && Object.keys(triageAnswers).length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionTitle icon={<ListChecks size={15} />}>Ön Değerlendirme · Branş Soruları</SectionTitle>
              <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {Object.entries(triageAnswers).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="font-medium text-slate-700">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Belgeler */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle icon={<FileText size={15} />}>Tıbbi Belgeler</SectionTitle>
            {files.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {files.map((f) => (
                  <li key={f} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <FileText size={16} className="text-teal-600" /> {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Yüklenmiş belge yok.</p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Not: Radyoloji/patoloji belgeleri görüşme öncesi otomatik çeviri ve özetleme için AI Orchestration katmanına gönderilecektir (yol haritası).
            </p>
          </div>

          {/* Radyoloji (DICOM) — vakaya bağlı çalışmalar, kokpitten görüntülenir */}
          {dicomStudies.length > 0 && <CaseDicom studies={dicomStudies} />}

          {/* AI Epikriz / Taburcu Raporu */}
          <DischargeReport
            caseId={c.id}
            initialReport={c.dischargeReport}
            initialStructured={dischargeStructured}
            initialSavedAt={c.dischargeAt ? c.dischargeAt.toISOString() : null}
          />

          {/* FHIR Faz 0 — klinik kodlama (ICD-10 tanı + hasta kimliği) → FHIR Condition/Patient.identifier */}
          <FhirCodingForm
            caseId={c.id}
            icd10Code={c.icd10Code}
            patientIdentifier={c.patientIdentifier}
            patientIdentifierType={c.patientIdentifierType}
            icd10Options={icd10ForBranchLabel(c.branch)}
          />

          {/* FHIR Faz 2 — laboratuvar sonuçları (LOINC) → Observation */}
          <LabResultsForm
            caseId={c.id}
            initial={labResults}
            loincOptions={loincForBranchLabel(c.branch)}
          />
        </div>

        {/* Sağ: aksiyon paneli */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">Durum</div>
            <div className="mt-1 mb-4">
              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>

            <div className="text-xs uppercase tracking-wide text-slate-400">Atanan / Önerilen Hekim</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white" style={{ background: (c.doctor ?? suggested)?.color ?? "#0A7D77" }}>
                {((c.doctor ?? suggested)?.name ?? "?").slice(0, 1)}
              </span>
              <div className="text-sm">
                <div className="font-semibold text-slate-800">
                  {(c.doctor ?? suggested) ? `${(c.doctor ?? suggested)!.title} ${(c.doctor ?? suggested)!.name}` : "Atanmadı"}
                </div>
                <div className="text-xs text-slate-500">{(c.doctor ?? suggested)?.branch}</div>
              </div>
            </div>
            {(c.doctor ?? suggested)?.languages && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Globe size={13} /> {(c.doctor ?? suggested)!.languages.split(",").join(" · ")}
              </div>
            )}
            {(c.doctor ?? suggested) && (
              <Link href={`/hekim/${(c.doctor ?? suggested)!.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                Hekim profilini gör <ArrowRight size={13} />
              </Link>
            )}

            <div className="mt-5">
              <StartConsultButton caseId={c.id} label={c.status === "IN_CONSULT" ? "Görüşmeye Dön" : "Görüşmeyi Başlat"} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Görüşme başlatıldığında hasta için sade arayüz, hekim için veri-yoğun ekran açılır.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle icon={<Brain size={15} />}>Hızlı Aksiyonlar</SectionTitle>
            <div className="mt-3 space-y-2 text-sm">
              <Link
                href={`/paket/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <span className="inline-flex items-center gap-1.5"><Luggage size={14} /> Sağlık turizmi paketi</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href={`/takip/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 font-medium text-teal-700 hover:bg-teal-100"
              >
                <span className="inline-flex items-center gap-1.5"><HeartPulse size={14} /> Post-Op takip</span>
                <ArrowRight size={14} />
              </Link>
              <DisabledAction>Koordinatöre ilet</DisabledAction>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone?: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone ?? "text-slate-500"}`}>
      {icon} {children}
    </div>
  );
}

function DisabledAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2 text-slate-400">
      {children}
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">yakında</span>
    </div>
  );
}
