import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decryptCaseFields, decryptField } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { clinicalDoctorFor } from "@/lib/doctor-activation";
import { caseAccessLevel } from "@/lib/ownership";
import { casePreviewDto, PREVIEW_ANON_LABEL, type CasePreviewDto } from "@/lib/case-preview";
import { AcceptCaseButton } from "@/components/AcceptCaseButton";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess } from "@/lib/audit";
import { headersMeta } from "@/lib/request-meta";
import { PostopClosedScreen } from "@/components/PostopClosedScreen";
import { countryFlag, countryName, urgencyStyle, CASE_STATUS, formatDateTime } from "@/lib/constants";
import { StartConsultButton } from "@/components/StartConsultButton";
import { TranslateButton } from "@/components/TranslateButton";
import { CaseDicom } from "@/components/CaseDicom";
import { DocumentAnalysis } from "@/components/DocumentAnalysis";
import { loincForBranchLabel } from "@/data/coding";
import { LabResultsForm } from "@/components/LabResultsForm";
import { caseDicomStudies } from "@/lib/case-dicom";
import { PoolConsultPanel, CasePoolAnswers } from "@/components/PoolConsultPanel";
import { poolRequestsForCase } from "@/lib/consultation-requests";
import { ArrowLeft, ArrowRight, FileText, Stethoscope, Globe, Clock, Languages, Brain, Luggage, HeartPulse, ListChecks, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rol + sahiplik kapısı. proxy /doktor'u DOCTOR/COORDINATOR/ADMIN'e kapıyor ama sayfa KENDİ savunmasını
  // yapar (proxy DB'siz → verified/atama/branş bakmaz). BOLA fix (2026-07-03): bu sayfa canCaseBeAccessedBy'ı
  // ATLIYORDU → giriş yapmış herhangi doktor/personel URL'deki id ile yabancı vakanın PHI'sini görebiliyordu
  // (SO detay sayfası v4.6'da kapatılmıştı; klinik vaka sayfası eşleniği atlanmıştı).
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) notFound();

  // v6.87 Aşama 2 kapısı: klinik aktivasyonu olmayan DOCTOR vaka detayına hiç inemez (ownership
  // zaten doğrulanmamışı reddediyor; bu kapı aktive-olmamışı da klinik veri ÇEKİLMEDEN çevirir).
  if (user.role === "DOCTOR" && !(await clinicalDoctorFor(user.id))) redirect("/doktor/baslangic");

  // E2EE Faz 2A — post-op erişim daraltma: takip tamamlandıysa klinik personel erişimi kapalı (hasta-only, §0.1·3).
  // Klinik veri ÇEKİLMEDEN reddet (sızma yok). Hasta kendi kayıtlarını /takip + /vakalarim'de görmeye devam eder.
  // Red de kayda geçer (JSON ucu api/cases/[id] ile aynı — kontrol raporu K05); subject için dar select, klinik alan çekilmez.
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    const subject = await db.case.findUnique({ where: { id }, select: { userId: true } });
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: id, subjectUserId: subject?.userId ?? null, detail: `post-op kapalı (${closed.reason}) — kokpit sayfası`, ...(await headersMeta()) });
    return <PostopClosedScreen />;
  }

  // DAR kayıt önce (belge listesi YOK): erişim SEVİYESİ belirlenmeden belge üstverisi çekilmez. Sahiplik/atama + branş
  // daraltması ownership tek-kaynak; "none" → notFound (vakanın varlığını ele vermez), klinik veri DECRYPT edilmeden.
  const raw = await db.case.findUnique({ where: { id }, include: { doctor: true } });
  if (!raw) notFound();
  const level = await caseAccessLevel(user, { userId: raw.userId, doctorId: raw.doctorId, branch: raw.branch, deletionLockedAt: raw.deletionLockedAt });
  if (level === "none") notFound();
  if (level === "preview") {
    // K06 1C-a (2026-09-20): aynı branştaki ATANMAMIŞ havuz vakası → KİMLİKSİZ önizleme (personel metni A09 madde 10.1).
    // Kimlik, telefon, belgeler, triyaj yanıtları ve AI gerekçesi ÇİZİLMEZ; şikâyette hastanın adı [HASTA] ile maskelenir.
    // Önizleme de erişimdir → kayıt zincirine yazılır (hasta /erisim-kaydi'nda görür). Kabul → atama → tam sayfa.
    await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: raw.id, subjectUserId: raw.userId, detail: "kimliksiz havuz önizlemesi (kabul öncesi)", ...(await headersMeta()) });
    const dto = casePreviewDto({
      id: raw.id, branch: raw.branch, urgency: raw.urgency, country: raw.country, language: raw.language, status: raw.status,
      createdAt: raw.createdAt, durationText: raw.durationText, attachments: raw.attachments,
      symptoms: decryptField(raw.symptoms), patientName: decryptField(raw.patientName),
    });
    return <CasePreview dto={dto} />;
  }
  // Erişim kaydı (kontrol raporu K05): sayfa yolu da JSON ucu (api/cases/[id]) gibi CASE_VIEW yazar — "her erişim
  // kayıt zincirine yazılır" taahhüdü doktorun normal bağlantıyla açtığı bu ekranı da kapsar. Decrypt ÖNCESİ.
  // Kayıt başarısızlığı: recordAccess fail-safe (yutar + audit-write alarmı) — sayfa çizimi bozulmaz (bilinçli).
  // Ön-yükleme: force-dynamic sayfada <Link> prefetch'i RSC gövdesini koşturmaz → gezinti başına tek kayıt.
  await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: raw.id, subjectUserId: raw.userId, detail: "kokpit sayfası", ...(await headersMeta()) });
  // Belge üstverisi yalnız TAM erişimde çekilir (önizlemede hiç sorgulanmaz).
  const documents = await db.caseDocument.findMany({
    where: { caseId: id },
    select: { id: true, label: true, mimeType: true, aiDocType: true, aiSummary: true, aiTranslation: true, aiFlags: true, assessedAt: true },
    orderBy: { createdAt: "asc" },
  });
  const c = { ...decryptCaseFields(raw), documents }; // symptoms/reasoning/extra(triyaj yanıtları) at-rest şifreli → kokpit gösterimi için çöz

  const u = urgencyStyle(c.urgency);
  const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
  const files = c.attachments ? c.attachments.split(",").filter(Boolean) : [];
  // DICOM belgeler AI belge-analizi kartına GİRMEZ (viewer-only, v6.33) — Radyoloji kartında listelenir.
  const caseDocs = c.documents.filter((d) => d.mimeType !== "application/dicom").map((d) => ({ ...d, assessedAt: d.assessedAt ? d.assessedAt.toISOString() : null }));
  // DICOM (v6.33): hastanın triyajda yüklediği gerçek .dcm'ler (şifreli CaseDocument) demo çalışmalarla
  // yan yana — auth'lu endpoint'ten mevcut görüntüleyiciye akar ("Hasta yüklemesi" rozeti).
  const uploadedDicoms = c.documents
    .filter((d) => d.mimeType === "application/dicom")
    .map((d) => ({ url: `/api/cases/${c.id}/documents/${d.id}/dicom`, label: d.label, modality: "DCM", uploaded: true }));
  const dicomStudies = [...uploadedDicoms, ...caseDicomStudies(c.id)];
  const suggested = await db.doctor.findFirst({ where: { branch: c.branch, verified: true } }); // v4.19: öneri yalnız doğrulanmış (profil linki de verified-kapılı)

  // v6.33 Faz 3 — havuza açma yalnız ATANAN doktorda (kullanıcı kararı); görüş kartı klinik erişimli herkese.
  const viewerDoctorId = user.role === "DOCTOR" ? (await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } }))?.doctorId ?? null : null;
  const isAssignedDoctor = !!viewerDoctorId && viewerDoctorId === c.doctorId;
  const poolItems = await poolRequestsForCase(c.id);

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
                  <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">{c.patientName}</h1>
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

          {/* v6.33 Faz 3 — bu vakadan açılan havuz talepleri (durum + gelen uzman görüşü) */}
          <CasePoolAnswers items={poolItems} />
        </div>

        {/* Sağ: aksiyon paneli */}
        <aside className="space-y-4">
          {/* v6.33 Faz 3 — havuza açma yalnız atanan doktorda */}
          {isAssignedDoctor && <PoolConsultPanel caseId={c.id} />}
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Durum</div>
            <div className="mt-1 mb-4">
              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>

            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Atanan / Önerilen Doktor</div>
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
              <Link href={`/doktorlar/${(c.doctor ?? suggested)!.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--c-accent)] hover:underline">
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

// K06 1C-a — havuz vakasının KİMLİKSİZ önizlemesi (A09 madde 10.1). Yalnız DTO alanları çizilir: kimlik/telefon/belge
// listesi/triyaj yanıtları/AI gerekçesi bu bileşene HİÇ GELMEZ (lib/case-preview tip sınırı). "Vakayı üstlen" → atama → tam sayfa.
function CasePreview({ dto }: { dto: CasePreviewDto }) {
  const u = urgencyStyle(dto.urgency);
  const st = CASE_STATUS[dto.status] ?? CASE_STATUS.NEW;
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Vaka kuyruğu
      </Link>
      <div className="mt-4 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="aura-display text-2xl font-medium tracking-tight text-[var(--c-ink)]">{PREVIEW_ANON_LABEL}</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-ink-2)]">
                <EyeOff size={12} /> kimliksiz önizleme
              </span>
              <span className="text-sm text-[var(--c-ink-3)]">{countryFlag(dto.country)} {countryName(dto.country)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--c-ink-2)]">
              <span className="inline-flex items-center gap-1"><Languages size={14} /> {dto.language}</span>
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatDateTime(dto.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><Stethoscope size={14} /> <span className="font-medium text-[var(--c-accent-strong)]">{dto.branch}</span></span>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {dto.urgency}/5 · {u.label}
          </span>
        </div>

        <div className="mt-5">
          <SectionTitle icon={<FileText size={15} />}>Şikayet</SectionTitle>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink)]">{dto.complaint}</p>
          {dto.durationText && <p className="mt-1 text-xs text-[var(--c-ink-3)]">Süre: {dto.durationText}</p>}
          <p className="mt-2 text-xs text-[var(--c-ink-3)]">
            Tıbbi belge: {dto.fileCount > 0 ? `${dto.fileCount} dosya (üstlendikten sonra açılır)` : "yüklenmemiş"}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] p-4 text-sm leading-relaxed text-[var(--c-ink-2)]">
          <p>
            Bu başvuru <strong className="text-[var(--c-ink)]">{dto.branch}</strong> havuzunda ve henüz bir doktora atanmadı. Hasta kimliği, iletişim
            bilgileri, yüklenen belgeler ve ön değerlendirme yanıtları <strong className="text-[var(--c-ink)]">vakayı üstlendikten sonra</strong> açılır;
            her erişim kayıt zincirine yazılır ve hastaya gösterilir.
          </p>
          <div className="mt-3"><AcceptCaseButton caseId={dto.id} /></div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone?: string }) {
  return (
    <div className={`flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] ${tone ?? "text-[var(--c-ink-2)]"}`}>
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

// PostopClosedScreen → components/PostopClosedScreen.tsx (K03: hasta vaka merkezi de aynı ekranı çizer).
