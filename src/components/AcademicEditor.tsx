"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Save, Loader2, Check, Award, BookOpen, BadgeCheck } from "lucide-react";

interface Pub { title: string; venue: string; year: number }

// Doktorun kalıcı akademik/eğitim + FHIR uzmanlık (qualification) profili — /api/doctor/academic'e
// kaydeder (yalnız oturumdaki doktor). Diploma/tescil no = FHIR Practitioner.identifier; uzmanlık
// belgesi = Practitioner.qualification. Boş akademik alanlar için public profil (lib/doctor-profile.ts)
// deterministik üretim fallback eder.
export function AcademicEditor(props: {
  licenseNo?: string | null;
  eduSchool: string | null; eduYear: number | null;
  specBoard: string | null; specYear: number | null;
  certifications: string[]; publications: Pub[];
}) {
  const router = useRouter();
  const [licenseNo, setLicenseNo] = useState(props.licenseNo ?? "");
  const [eduSchool, setEduSchool] = useState(props.eduSchool ?? "");
  const [eduYear, setEduYear] = useState(props.eduYear ? String(props.eduYear) : "");
  const [specBoard, setSpecBoard] = useState(props.specBoard ?? "");
  const [specYear, setSpecYear] = useState(props.specYear ? String(props.specYear) : "");
  const [certsText, setCertsText] = useState(props.certifications.join("\n"));
  const [pubsText, setPubsText] = useState(props.publications.map((p) => `${p.title} | ${p.venue} | ${p.year}`).join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setter(e.target.value); setSaved(false); };

  async function save() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const certifications = certsText.split("\n").map((s) => s.trim()).filter(Boolean);
      const publications = pubsText.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => {
        const [title, venue, year] = line.split("|").map((x) => x.trim());
        return { title: title || "", venue: venue || "", year: Number(year) || new Date().getFullYear() };
      }).filter((p) => p.title);
      const r = await fetch("/api/doctor/academic", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseNo, eduSchool, eduYear: Number(eduYear) || null, specBoard, specYear: Number(specYear) || null, certifications, publications }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata oluştu."); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
        <GraduationCap size={15} /> Akademik & Eğitim
        <span className="ml-1 text-[10px] font-normal normal-case text-[var(--c-ink-3)]">(boş alanlar profilde otomatik üretilir)</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Diploma / Tescil No" icon={<BadgeCheck size={14} />} hint="FHIR Practitioner.identifier">
          <input type="text" value={licenseNo} onChange={onChange(setLicenseNo)} placeholder="ör. TR-123456" className={INPUT} />
        </Field>
        <div className="hidden sm:block" />
        <Field label="Tıp fakültesi" icon={<GraduationCap size={14} />}>
          <input type="text" value={eduSchool} onChange={onChange(setEduSchool)} placeholder="ör. Hacettepe Üniversitesi Tıp Fakültesi" className={INPUT} />
        </Field>
        <Field label="Mezuniyet yılı">
          <input type="number" min={1960} max={2026} value={eduYear} onChange={onChange(setEduYear)} placeholder="2002" className={INPUT} />
        </Field>
        <Field label="Uzmanlık belgesi / yan dal" icon={<Award size={14} />}>
          <input type="text" value={specBoard} onChange={onChange(setSpecBoard)} placeholder="ör. Tıbbi Onkoloji Yan Dal Uzmanlığı" className={INPUT} />
        </Field>
        <Field label="Uzmanlık yılı">
          <input type="number" min={1960} max={2026} value={specYear} onChange={onChange(setSpecYear)} placeholder="2008" className={INPUT} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Sertifikalar / üyelikler" icon={<Award size={14} />} hint="her satıra bir tane">
          <textarea value={certsText} onChange={onChange(setCertsText)} rows={3} placeholder={"ESMO (Avrupa Tıbbi Onkoloji Derneği) üyeliği\nİyi Klinik Uygulamalar (GCP) sertifikası"} className={`${INPUT} resize-y`} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Yayınlar / akademik çalışmalar" icon={<BookOpen size={14} />} hint="her satır: Başlık | Dergi/Kongre | Yıl">
          <textarea value={pubsText} onChange={onChange(setPubsText)} rows={3} placeholder={"Lokal ileri NSCLC'de neoadjuvan tedavi sonuçları | Türk Onkoloji Dergisi | 2021"} className={`${INPUT} resize-y`} />
        </Field>
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button onClick={save} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? "Kaydedildi" : "Akademik bilgileri kaydet"}
      </button>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]";

function Field({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]">
        {icon && <span className="text-[var(--c-ink-3)]">{icon}</span>} {label}
        {hint && <span className="text-xs font-normal text-[var(--c-ink-3)]">({hint})</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
