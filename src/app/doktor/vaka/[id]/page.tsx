import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { decryptCaseFields } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { countryFlag, countryName, urgencyStyle, CASE_STATUS, formatDateTime } from "@/lib/constants";
import { StartConsultButton } from "@/components/StartConsultButton";
import { TranslateButton } from "@/components/TranslateButton";
import { CaseDicom } from "@/components/CaseDicom";
import { DocumentAnalysis } from "@/components/DocumentAnalysis";
import { loincForBranchLabel } from "@/data/coding";
import { LabResultsForm } from "@/components/LabResultsForm";
import { caseDicomStudies } from "@/lib/case-dicom";
import { ArrowLeft, ArrowRight, FileText, Stethoscope, Globe, Clock, Languages, Brain, Luggage, HeartPulse, ListChecks, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rol + sahiplik kapısı. proxy /doktor'u DOCTOR/COORDINATOR/ADMIN'e kapıyor ama sayfa KENDİ savunmasını
  // yapar (proxy DB'siz → verified/atama/branş bakmaz). BOLA fix (2026-07-03): bu sayfa canCaseBeAccessedBy'ı
  // ATLIYORDU → giriş yapmış herhangi doktor/personel URL'deki id ile yabancı vakanın PHI'sini görebiliyordu
  // (SO detay sayfası v4.6'da kapatılmıştı; klinik vaka sayfası eşleniği atlanmıştı).
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) notFound();

  // E2EE Faz 2A — post-op erişim daraltma: takip tamamlandıysa klinik personel erişimi kapalı (hasta-only, §0.1·3).
  // Klinik veri ÇEKİLMEDEN reddet (sızma yok). Hasta kendi kayıtlarını /takip + /vakalarim'de görmeye devam eder.
  if ((await staffAccessClosed(id, user)).closed) return <PostopClosedScreen />;

  const raw = await db.case.findUnique({
    where: { id },
    include: {
      doctor: true,
      documents: {
        select: { id: true, label: true, mimeType: true, aiDocType: true, aiSummary: true, aiTranslation: true, aiFlags: true, assessedAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!raw) notFound();
  // Sahiplik/atama + branş daraltması (ownership tek-kaynak): atanan/eşleşen-branş doktor + operasyon
  // personeli. Klinik veri DECRYPT edilmeden reddet (sızma yok) → notFound (vakanın varlığını ele vermez).
  if (!(await canCaseBeAccessedBy(user, { userId: raw.userId, doctorId: raw.doctorId, branch: raw.branch, deletionLockedAt: raw.deletionLockedAt }))) notFound();
  const c = decryptCaseFields(raw); // symptoms/reasoning/extra(triyaj yanıtları) at-rest şifreli → kokpit gösterimi için çöz

  const u = urgencyStyle(c.urgency);
  const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
  const files = c.attachments ? c.attachments.split(",").filter(Boolean) : [];
  const caseDocs = c.documents.map((d) => ({ ...d, assessedAt: d.assessedAt ? d.assessedAt.toISOString() : null }));
  const dicomStudies = caseDicomStudies(c.id);
  const suggested = await db.doctor.findFirst({ where: { branch: c.branch, verified: true } }); // v4.19: öneri yalnız doğrulanmış (profil linki de verified-kapılı)

  let triageAnswers: Record<string, string> | null = null;
  try { triageAnswers = c.extra ? (JSON.parse(c.extra) as Record<string, string>) : null; } catch { triageAnswers = null; }

  let labResults: { loinc?: string; name?: string; value?: string; unit?: string; abnormal?: string; aiSuggested?: boolean }[] = [];
  try { const p = c.labResults ? JSON.parse(c.labResults) : []; if (Array.isArray(p)) labResults = p; } catch { labResults = []; }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Vaka kuyruğu
      </Link>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Sol: Vaka kartı (kokpit) */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[var(--c-ink)]">{c.patientName}</h1>
                  <span className="text-sm text-[var(--c-ink-3)]">{countryFlag(c.country)} {countryName(c.country)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--c-ink-2)]">
                  <span className="inline-flex items-center gap-1"><Languages size={14} /> {c.language}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatDateTime(c.createdAt)}</span>
                  <span className="inline-flex items-center gap-1"><Stethoscope size={14} /> <span className="font-medium text-[var(--c-accent-strong)]">{c.branch}</span></span>
                </div>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {c.urgency}/5 · {u.label}
              </span>
            </div>

            <div className="mt-5">
              <SectionTitle icon={<FileText size={15} />}>Şikayet</SectionTitle>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink)]">{c.symptoms}</p>
              {c.durationText && <p className="mt-1 text-xs text-[var(--c-ink-3)]">Süre: {c.durationText}</p>}
              <TranslateButton text={c.symptoms} defaultTarget="Türkçe" />
            </div>

            {/* AI Triyaj Gerekçesi kartı kaldırıldı (2026-07-14, kullanıcı isteği). */}
          </div>

          {/* Branş ön-değerlendirme yanıtları (dinamik triyaj soruları) */}
          {triageAnswers && Object.keys(triageAnswers).length > 0 && (
            <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
              <SectionTitle icon={<ListChecks size={15} />}>Ön Değerlendirme · Branş Soruları</SectionTitle>
              <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {Object.entries(triageAnswers).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <dt className="text-xs text-[var(--c-ink-3)]">{k}</dt>
                    <dd className="font-medium text-[var(--c-ink)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Belgeler */}
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
            <SectionTitle icon={<FileText size={15} />}>Tıbbi Belgeler</SectionTitle>
            {files.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {files.map((f) => (
                  <li key={f} className="flex items-center gap-2 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)]">
                    <FileText size={16} className="text-[var(--c-accent)]" /> {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--c-ink-3)]">Yüklenmiş belge yok.</p>
            )}
            {caseDocs.length > 0 && (
              <p className="mt-3 text-xs text-[var(--c-ink-3)]">
                Görüntü ve PDF belgeler aşağıdaki <strong>Belge Analizi (AI)</strong> kartında değerlendirilip Türkçeye çevrilir. DICOM görüntüleri Radyoloji görüntüleyicide açılır.
              </p>
            )}
          </div>

          {/* Triyajda yüklenen belgelerin AI ön-değerlendirmesi (tür + Türkçe çeviri + klinik özet + anormal bulgu) */}
          {caseDocs.length > 0 && <DocumentAnalysis caseId={c.id} initial={caseDocs} />}

          {/* Radyoloji (DICOM) — vakaya bağlı çalışmalar, kokpitten görüntülenir */}
          {dicomStudies.length > 0 && <CaseDicom studies={dicomStudies} />}

          {/* AI Epikriz + Klinik Kodlama (FHIR) → görüşme ekranına taşındı
              (akış: Görüşme Notları → Klinik Kodlama → Tedavi Kararı → AI Epikriz) */}

          {/* FHIR Faz 2 — laboratuvar sonuçları (LOINC) → Observation */}
          <LabResultsForm
            caseId={c.id}
            initial={labResults}
            loincOptions={loincForBranchLabel(c.branch)}
          />
        </div>

        {/* Sağ: aksiyon paneli */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">Durum</div>
            <div className="mt-1 mb-4">
              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>

            <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">Atanan / Önerilen Doktor</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-[var(--c-ink)]" style={{ background: (c.doctor ?? suggested)?.color ?? "var(--c-accent-strong)" }}>
                {((c.doctor ?? suggested)?.name ?? "?").slice(0, 1)}
              </span>
              <div className="text-sm">
                <div className="font-semibold text-[var(--c-ink)]">
                  {(c.doctor ?? suggested) ? `${(c.doctor ?? suggested)!.title} ${(c.doctor ?? suggested)!.name}` : "Atanmadı"}
                </div>
                <div className="text-xs text-[var(--c-ink-2)]">{(c.doctor ?? suggested)?.branch}</div>
              </div>
            </div>
            {(c.doctor ?? suggested)?.languages && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]">
                <Globe size={13} /> {(c.doctor ?? suggested)!.languages.split(",").join(" · ")}
              </div>
            )}
            {(c.doctor ?? suggested) && (
              <Link href={`/hekim/${(c.doctor ?? suggested)!.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--c-accent)] hover:underline">
                Doktor profilini gör <ArrowRight size={13} />
              </Link>
            )}

            <div className="mt-5">
              <StartConsultButton caseId={c.id} label={c.status === "IN_CONSULT" ? "Görüşmeye Dön" : "Görüşmeyi Başlat"} />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
              Görüşme başlatıldığında hasta için sade arayüz, doktor için veri-yoğun ekran açılır.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <SectionTitle icon={<Brain size={15} />}>Hızlı Aksiyonlar</SectionTitle>
            <div className="mt-3 space-y-2 text-sm">
              <Link
                href={`/paket/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 font-medium text-emerald-300 hover:bg-emerald-500/15"
              >
                <span className="inline-flex items-center gap-1.5"><Luggage size={14} /> Sağlık turizmi paketi</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href={`/takip/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 px-3 py-2 font-medium text-[var(--c-accent)] hover:bg-[var(--c-accent)]/15"
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
    <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone ?? "text-[var(--c-ink-2)]"}`}>
      {icon} {children}
    </div>
  );
}

function DisabledAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--c-hairline)] px-3 py-2 text-[var(--c-ink-3)]">
      {children}
      <span className="rounded bg-[var(--c-ink)]/10 px-1.5 py-0.5 text-[10px]">yakında</span>
    </div>
  );
}

// Post-op takip tamamlanmış vakada (E2EE Faz 2A) klinik personele gösterilen ekran — klinik veri yok.
function PostopClosedScreen() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Vaka kuyruğu
      </Link>
      <div className="mt-6 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]"><Lock size={26} /></span>
        <h1 className="mt-4 text-lg font-bold text-[var(--c-ink)]">Post-op takip tamamlandı</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--c-ink-2)]">
          Bu vakanın post-op takip süreci kapandığı için klinik kayıtlara erişim hastaya devredilmiştir.
          Doktor/personel artık bu vakanın klinik içeriğini görüntüleyemez. Erişim olayları değiştirilemez denetim
          kaydında zaman damgalıdır.
        </p>
      </div>
    </div>
  );
}
