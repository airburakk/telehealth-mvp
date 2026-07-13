"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Stethoscope, Inbox, Loader2, ArrowRight, Check, BadgeCheck, Lock, ShieldAlert } from "lucide-react";
import { DoctorDocuments, type DocMeta, type MmssInitial } from "@/components/DoctorDocuments";
import ProcedureSelector, { type Proc } from "@/components/ProcedureSelector";
import { AcademicEditor } from "@/components/AcademicEditor";

interface Pub { title: string; venue: string; year: number }

// M5 — İlk-giriş onboarding kapısı (client). Hesap aktifleşmesi için ZORUNLU: (1) FHIR uzmanlık &
// işlemler — diploma/tescil no + uzmanlık belgesi + branş işlemleri & ücretleri (≥1); (2) mesleki
// belgeler — diploma + MMSS. Sonra Ücretsiz Sağlık Hizmeti + Partner Konsültasyon opt-in toplanır. Kaydedince /doktor'a geçer.
export function OnboardingForm({
  doctorName,
  branchKey,
  branchLabel,
  branchItems,
  initialProc,
  extraItems,
  qualification,
  soOpen,
  initialFreeCare,
  initialConsult,
  initialDocs,
  initialMmss,
}: {
  doctorName: string;
  branchKey: string;
  branchLabel: string;
  branchItems: Proc[];
  initialProc: Record<string, number>;
  extraItems: Proc[];
  qualification: {
    licenseNo: string | null; eduSchool: string | null; eduYear: number | null;
    specBoard: string | null; specYear: number | null; certifications: string[]; publications: Pub[];
  };
  soOpen: boolean;
  initialFreeCare: boolean;
  initialConsult: boolean;
  initialDocs: DocMeta[];
  initialMmss: MmssInitial;
}) {
  const router = useRouter();
  const [freeCare, setFreeCare] = useState(initialFreeCare);
  const [consult, setConsult] = useState(initialConsult);
  const [docsReady, setDocsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  async function finish() {
    setSaving(true);
    setErr("");
    setMissing([]);
    try {
      const r = await fetch("/api/doctor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeCareOptIn: freeCare, consultOptIn: consult }),
      });
      const d = await r.json();
      if (!r.ok) {
        // 409: eksik zorunlu adımlar (işlem · diploma no · uzmanlık belgesi · belgeler) → listele
        if (Array.isArray(d.missing)) setMissing(d.missing as string[]);
        throw new Error(d.error || "Kaydedilemedi.");
      }
      router.push("/doktor");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--c-ink)]">Hoş geldiniz, {doctorName}</h1>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">
          Doktor Ana Sayfanız tercihinize göre düzenlenir. Aşağıdaki birimlere katılmak isteyip
          istemediğinizi seçin — dilediğiniz zaman profilinizden değiştirebilirsiniz.
        </p>
      </div>

      {/* ── Uzmanlık & İşlemler (FHIR) — diploma/tescil no + uzmanlık belgesi + işlem seçimi (zorunlu; ücret tedavi kararında) ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
          <Stethoscope size={16} className="text-[var(--c-accent-strong)]" /> Uzmanlık & İşlemler
        </div>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          <strong>{branchLabel}</strong> branşı için diploma/tescil numaranızı, uzmanlık belgenizi ve
          yaptığınız işlemleri tanımlayın. Bu bilgiler <strong>FHIR</strong> standardında
          (Practitioner.identifier/qualification + ServiceRequest) saklanır ve hesabınız aktifleşmeden
          zorunludur — en az bir işlem seçmelisiniz. İşlem ücreti burada sorulmaz; hasta görüşmesi
          sonrasında <strong>tedavi kararı</strong> ekranında taban–tavan aralığında belirlersiniz.
        </p>

        {/* FHIR qualification: diploma/tescil no + uzmanlık belgesi (AcademicEditor) */}
        <div className="mt-3">
          <AcademicEditor
            licenseNo={qualification.licenseNo}
            eduSchool={qualification.eduSchool}
            eduYear={qualification.eduYear}
            specBoard={qualification.specBoard}
            specYear={qualification.specYear}
            certifications={qualification.certifications}
            publications={qualification.publications}
          />
        </div>

        {/* Branş işlemleri + ücretlendirme (≥1 zorunlu) */}
        <div className="mt-4">
          <ProcedureSelector
            branchKey={branchKey}
            branchLabel={branchLabel}
            branchItems={branchItems}
            initial={initialProc}
            extraItems={extraItems}
          />
        </div>
      </div>

      {/* ── Zorunlu mesleki belgeler — hesap aktivasyon kapısı ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
          <ShieldAlert size={16} className="text-amber-500" /> Mesleki Belgeler
        </div>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          <strong>Tıp diploması</strong> ve <strong>Mesleki Mali Sorumluluk Sigortası (MMSS)</strong> poliçenizi
          yüklemeden hesabınız aktifleşmez. Sertifika ve akademik çalışmalar ihtiyaridir.
        </p>
        <div className="mt-3">
          <DoctorDocuments initialDocs={initialDocs} initialMmss={initialMmss} onActivationChange={setDocsReady} />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {/* İkinci Görüş — ünvan kapısı (seçim değil, bilgi) */}
        <div className={`rounded-3xl border p-5 ${soOpen ? "border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-surface)]"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${soOpen ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/20 text-white"}`}>
              {soOpen ? <Stethoscope size={18} /> : <Lock size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">
                İkinci Görüş Paneli {soOpen && <BadgeCheck size={15} className="text-[var(--c-accent)]" />}
              </div>
              {soOpen ? (
                <p className="mt-1 text-xs text-[var(--c-ink-2)]">
                  Ünvanınız uygun — İkinci Görüş paneliniz <strong>otomatik açık</strong>. Tanı konmuş
                  hastaların belgelerini inceleyip yazılı görüş ve video görüşme sunabilirsiniz.
                </p>
              ) : (
                <p className="mt-1 text-xs text-[var(--c-ink-2)]">
                  İkinci Görüş paneli yalnız <strong>Doçent / Profesör</strong> ünvanlı doktorlara açılır;
                  hesabınızda görüntülenmeyecek.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Ücretsiz Sağlık Hizmeti opt-in */}
        <OptCard
          active={freeCare}
          onToggle={() => setFreeCare((v) => !v)}
          icon={<HeartHandshake size={18} />}
          title="Ücretsiz Sağlık Hizmeti — Gönüllü Konsültasyon"
          desc="Sağlığa erişimi kısıtlı hastalarla gönüllü, ücretsiz video görüşmesinde buluşun."
          benefit="Avantaj: profil itibar rozeti (“Ücretsiz Hizmet Gönüllüsü”), dizinlerde öne çıkma ve etik katkı görünürlüğü. Haftalık kontenjanı kendiniz belirlersiniz."
        />

        {/* Partner Konsültasyon opt-in */}
        <OptCard
          active={consult}
          onToggle={() => setConsult((v) => !v)}
          icon={<Inbox size={18} />}
          title="Konsültasyon Talepleri — Partner Doktorlar"
          desc="Partner (yurtdışı) doktorlardan gelen, anonimleştirilmiş hasta dosyalarına görüş verin."
          benefit="Yanıtladığınız her konsültasyon talebi için ödeme alırsınız (yanıt başına; demo ortamında simüledir). Talepleri kendi branşınızla sınırlı veya genel havuzdan görebilirsiniz."
        />
      </div>

      {err && <p className="mt-4 text-center text-sm text-red-300">{err}</p>}

      {/* Sunucudan dönen eksik zorunlu adımlar (409) */}
      {missing.length > 0 && (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-400/25">
          <div className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={15} /> Eksik zorunlu adımlar</div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {!docsReady && (
        <p className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-center text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
          <ShieldAlert size={14} /> Hesabınızı aktifleştirmek için işlem seçimi, diploma no, uzmanlık belgesi ve tıp diploması + MMSS poliçesini (teminat limiti dahil) tamamlayın.
        </p>
      )}

      <button
        onClick={finish}
        disabled={saving || !docsReady}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Ana Sayfama geç
      </button>
      <p className="mt-3 text-center text-xs text-[var(--c-ink-3)]">
        Klinik Nöbet ve Haberler pencereleri her doktorun ana sayfasında bulunur.
      </p>
    </div>
  );
}

function OptCard({
  active,
  onToggle,
  icon,
  title,
  desc,
  benefit,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  benefit: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`w-full rounded-3xl border p-5 text-left transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-white/50"}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--c-ink)]">{title}</span>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-transparent"}`}>
              <Check size={14} />
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--c-ink-2)]">{desc}</p>
          <p className="mt-2 rounded-xl bg-[var(--c-surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--c-ink-2)]">{benefit}</p>
        </div>
      </div>
    </button>
  );
}
