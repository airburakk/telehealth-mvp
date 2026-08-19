import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { soEligible } from "@/lib/doctor-home";
import { branchKeyFromLabel, branchLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import { hasDoctoriumAccess, isEduEmail } from "@/lib/doctor-activation";
import { SPONSOR_CONSENT_TEXT } from "@/lib/sponsor";
import { HR_CONTACT_CONSENT_TEXT } from "@/lib/hr-consent";
import { GraduationCap, FileCheck2, ArrowRight } from "lucide-react";
import { AuraMark } from "@/components/AuraLogo";
import { StudentStage1Card } from "@/components/StudentStage1Card";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

// M5 — Doktor ilk-giriş onboarding kapısı. onboardedAt damgalıysa Ana Sayfa'ya geçer (bir daha
// gösterilmez). v6.87: İKİ AŞAMALI — Aşama 1 (tabip odası yazısı → Doctorium) + Aşama 2 (klinik).
// Rıza TAM metinleri buradan prop geçer (lib'ler db'li → client'a import edilemez).
export default async function DoctorOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/baslangic");
  if (user.role !== "DOCTOR" && user.role !== "ADMIN") redirect("/doktor");

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = dbUser?.doctorId
    ? await db.doctor.findUnique({
        where: { id: dbUser.doctorId },
        select: {
          title: true, name: true, branch: true, city: true, onboardedAt: true, activatedAt: true, freeCareOptIn: true, consultOptIn: true,
          soOptIn: true, tourismOptIn: true, // v6.105 — İkinci Görüş + Sağlık Turizmi tercihleri
          mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true, mmssCoverageCurrency: true, mmssValidUntil: true,
          procedures: true, licenseNo: true, eduSchool: true, eduYear: true, specBoard: true, specYear: true,
          certifications: true, publications: true,
          chamberLetterAt: true, studentVerifiedAt: true, studentTrack: true, sponsorPersonalizationAt: true, hrContactOptInAt: true,
        },
      })
    : null;

  // Doktor profili bağlı değilse (ör. koordinatör) onboarding'in anlamı yok → panele geç.
  if (!doctor) redirect("/doktor");

  // v6.95 — ÖĞRENCİ MODU (/ogrenci hunisi): doktor onboarding'i (FHIR uzmanlık, işlemler,
  // diploma+MMSS, rızalar) HİÇ render edilmez — tek belge e-Devlet öğrenci belgesidir.
  // Branş/city kapısından ÖNCE dallanır: öğrenci profil-tamamla (doktor soruları) sayfasına
  // düşürülmez (kayıt formu branş+şehri zaten zorunlu topluyor).
  if (doctor.studentTrack) {
    const studentDocs = await db.doctorDocument.findMany({
      where: { doctorId: dbUser!.doctorId!, type: "STUDENT_CERT" },
      select: { id: true, type: true, label: true, mimeType: true },
      orderBy: { createdAt: "desc" },
    });
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]">
            <GraduationCap size={24} className="text-[var(--c-accent)]" />
          </span>
          <h1 className="mt-3 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">
            Hoş geldiniz, {doctor.name}
          </h1>
          <p className="mt-1 max-w-md text-sm text-[var(--c-ink-2)]">
            Öğrenci belgenizi yükleyin; Doctorium&apos;un haber, kongre, hukuk ve kütüphane
            içerikleri anında açılsın.
          </p>
        </div>
        <StudentStage1Card
          initialStudentDoc={studentDocs[0] ?? null}
          eduEmail={isEduEmail(user.email)}
          initialAccess={hasDoctoriumAccess(doctor)}
        />
      </div>
    );
  }
  // Onboard OLMUŞ ve zorunlu belgeleri tamamlamış (aktif) ise kapıyı atla. Belge eksikse (activatedAt
  // null) burada kal — doktor zorunlu belgeyi (v6.105: yalnız diploma) yükleyip tamamlasın.
  if (doctor.onboardedAt && doctor.activatedAt) redirect("/doktor");
  // v6.87 OAuth bekçisi: Google/Apple hesabı branch/city BOŞ açılır — kimlik tamamlanmadan
  // onboarding anlamsız (işlem listesi branştan türer) → profil-tamamla ara sayfasına
  // (?from=doctorium bağlamı korunur; callback'in doğrudan yönlendirmesinden kaçanlar da burada yakalanır).
  const sp = await searchParams;
  if (!doctor.branch.trim() || !doctor.city.trim()) {
    redirect(`/doktor/profil-tamamla${sp.from === "doctorium" ? "?from=doctorium" : ""}`);
  }

  // Yüklü mesleki belgelerin meta listesi (içerik DÖNMEZ) + MMSS metadata pre-fill.
  const allDocs = await db.doctorDocument.findMany({
    where: { doctorId: dbUser!.doctorId! },
    // v6.119: status/verifiedSource/reviewNote de gelir — doktor belgesinin hangi hâlde olduğunu
    // (e-Devlet ile doğrulandı / incelemede / yetersiz) kartın üstünde görür.
    select: {
      id: true, type: true, label: true, mimeType: true,
      status: true, verifiedSource: true, reviewNote: true,
    },
    orderBy: { createdAt: "desc" },
  });
  // Aşama ayrımı: CHAMBER (tabip odası yazısı) Aşama 1 kartına, kalanı Aşama 2 belge bölümüne.
  // STUDENT_CERT de dışlanır: mezuniyet geçişi yapmış hesabın öğrenci belgesi klinik belge
  // listesine sızmaz (öğrenci MODU yukarıda ayrı dallandı — buraya öğrenci hesabı gelmez).
  const chamberDoc = allDocs.find((d) => d.type === "CHAMBER") ?? null;
  const docs = allDocs.filter((d) => d.type !== "CHAMBER" && d.type !== "STUDENT_CERT");

  // Branş işlemleri (taban/tavan) + doktorun kayıtlı seçimi (FHIR ServiceRequest/ChargeItem girdisi).
  const branchKey = branchKeyFromLabel(doctor.branch) ?? "";
  const branchItems = branchKey ? getBranchProcedures(branchKey) : [];
  let initialProc: Record<string, number> = {};
  try { initialProc = doctor.procedures ? (JSON.parse(doctor.procedures) as Record<string, number>) : {}; } catch { initialProc = {}; }
  const branchCodes = new Set(branchItems.map((p) => p.code));
  const extraItems = getByCodes(Object.keys(initialProc).filter((c) => !branchCodes.has(c)));

  // FHIR qualification + akademik pre-fill.
  let certs: string[] = [];
  try { if (doctor.certifications) { const p = JSON.parse(doctor.certifications); if (Array.isArray(p)) certs = p as string[]; } } catch { /* bozuk JSON */ }
  let pubs: { title: string; venue: string; year: number }[] = [];
  try { if (doctor.publications) { const p = JSON.parse(doctor.publications); if (Array.isArray(p)) pubs = p; } } catch { /* bozuk JSON */ }

  // Aktif tema (layout ile AYNI kaynak: aura_theme cookie, yoksa gece). Almaşık ritim için
  // forma geçer — Aşama 2 bandı bunun tersine boyanır (v6.105, kullanıcı kararı 2026-08-17).
  const theme = (await cookies()).get("aura_theme")?.value === "light" ? "light" : "dark";

  return (
    <>
      {/* AURA'ya geçiş uyarı ekranı (kullanıcı kararı 2026-08-16): Doctorium'daki Aşama-1
          doktoru marka toggle'ıyla AURA'ya geçmek istedi → /doktor kapısı buraya
          ?from=aura-gecis ile yönlendirdi. Ekran Aşama-2 şartlarını (belgeler + doğrulama)
          söyler; yükleme yeri zaten bu sayfanın formu. Liste yalnız ZORUNLU şartları sayar:
          MMSS v6.105'te ihtiyarileşti → satırı 2026-08-18'de çıktı (/kayit anlatımı hâlâ MMSS
          sayıyor — o metnin güncellenmesi ayrı iş). py-10: kutu koyu üst bölgede dikey dengeli
          dursun (pb'siz hali alttaki açık Aşama-1 bandına yapışıyordu). Buton OnboardingForm
          BANT 2'deki #asama-2 çapasına kaydırır. */}
      {sp.from === "aura-gecis" && (
        <div className="mx-auto max-w-2xl px-5 py-10">
          <section
            aria-label="AURA klinik erişim koşulları"
            className="relative overflow-hidden rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--c-accent)]" />
            <div className="flex items-start gap-3 ps-1">
              <AuraMark size={24} />
              <div className="min-w-0">
                <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">
                  AURA klinik paneline geçiş için Aşama 2 gerekli
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">
                  Doctor<span className="doctorium-ium">ium</span> üyeliğiniz (Aşama 1) aktif. Vaka
                  havuzlarının bulunduğu AURA klinik çalışma alanına geçebilmek için Aşama 2
                  belgelerinizi yükleyip doğrulanmanız gerekir:
                </p>
                <ul className="mt-2.5 space-y-1.5 text-sm text-[var(--c-ink-2)]">
                  {["Diploma", "Uzmanlık ve işlem tanımları"].map((b) => (
                    <li key={b} className="flex items-center gap-2">
                      <FileCheck2 size={15} className="shrink-0 text-[var(--c-accent)]" aria-hidden />
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs leading-relaxed text-[var(--c-ink-3)]">
                  Belgeleriniz incelenip onaylandığında klinik panel ve doktor havuzları açılır.
                  Yüklemeyi aşağıdaki adımlardan yapabilirsiniz.
                </p>
                <a
                  href="#asama-2"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)]"
                >
                  Aşama 2&apos;ye geç <ArrowRight size={15} aria-hidden />
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
      <OnboardingForm
      doctorName={`${doctor.title} ${doctor.name}`}
      branchKey={branchKey}
      branchLabel={branchKey ? branchLabel(branchKey) : doctor.branch}
      branchItems={branchItems}
      initialProc={initialProc}
      extraItems={extraItems}
      qualification={{
        licenseNo: doctor.licenseNo,
        eduSchool: doctor.eduSchool,
        eduYear: doctor.eduYear,
        specBoard: doctor.specBoard,
        specYear: doctor.specYear,
        certifications: certs,
        publications: pubs,
      }}
      soOpen={soEligible(doctor.title)}
      initialFreeCare={doctor.freeCareOptIn}
      initialConsult={doctor.consultOptIn}
      initialSo={doctor.soOptIn}
      initialTourism={doctor.tourismOptIn}
      initialDocs={docs}
      initialMmss={{
        insurer: doctor.mmssInsurer,
        coverageLimit: doctor.mmssCoverageLimit,
        currency: doctor.mmssCoverageCurrency,
        validUntil: doctor.mmssValidUntil ? doctor.mmssValidUntil.toISOString() : null,
        policyNoSet: !!doctor.mmssPolicyNo,
      }}
      stage1={{
        initialChamberDoc: chamberDoc,
        initialAccess: hasDoctoriumAccess(doctor),
        initialSponsor: !!doctor.sponsorPersonalizationAt,
        initialHr: !!doctor.hrContactOptInAt,
        sponsorText: SPONSOR_CONSENT_TEXT,
        hrText: HR_CONTACT_CONSENT_TEXT,
        fromDoctorium: sp.from === "doctorium",
      }}
      theme={theme}
    />
    </>
  );
}
