"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Save, Loader2, Check, Award, ScrollText, BadgeCheck, AlertTriangle } from "lucide-react";
import { DoctorDocuments, type DocMeta, type MmssInitial } from "@/components/DoctorDocuments";

interface Pub { title: string; venue: string; year: number }

// Sertifika/akademik kartlarında MMSS formu HİÇ render edilmez (yalnız MMSS kartında çizilir),
// bu yüzden boş bir MmssInitial yeterli — bu örneğe gerçek poliçe verisi geçirmeye gerek yok.
const EMPTY_MMSS: MmssInitial = { insurer: null, coverageLimit: null, currency: null, validUntil: null, policyNoSet: false };

// ── v6.105 (kullanıcı kararı 2026-08-17): tek AcademicEditor İKİ BAĞIMSIZ kutuya bölündü ───────
// Kutular onboarding'de sayfanın FARKLI bölümlerinde durur:
//   • AcademicEducationBox → "Mesleki Belgeler" altında, tıp diploması ile MMSS'nin ARASINDA
//   • CertificatesBox      → kendi "Sertifikalar ve Akademik Çalışmalar" başlığı altında
// Bu yüzden ortak state/ortak kaydet düğmesi MÜMKÜN DEĞİL — her kutu kendi alanlarını kendi
// düğmesiyle kaydeder.
// ⚠️ Bunun ön koşulu: /api/doctor/academic KISMİ güncelleme yapar (yalnız gövdede geçen alanı
// yazar). Uç eskiden tüm alanları koşulsuz yazıyordu; bölünmüş kutular böyle bir uçta birbirini
// EZERDİ — sertifikaları kaydetmek licenseNo/specBoard'ı null yapar, bu ikisi aktivasyon şartı
// olduğu için hesabı sessizce deaktive ederdi. Uç v6.105'te kısmi hâle getirildi.
// Boş akademik alanlar için public profil (lib/doctor-profile.ts) deterministik üretim fallback eder.

// Ortak kaydetme yardımcısı: yalnız verilen alanları gönderir (kısmi güncelleme sözleşmesi).
function useAcademicSave() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function post(body: Record<string, unknown>) {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const r = await fetch("/api/doctor/academic", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata oluştu."); }
    finally { setSaving(false); }
  }
  return { post, saving, saved, setSaved, err };
}

function SaveButton({ saving, saved, onClick, label = "Kaydet" }: { saving: boolean; saved: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
      {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
      {saved ? "Kaydedildi" : label}
    </button>
  );
}

// ── KUTU 1 — Akademik & Eğitim: FHIR qualification + eğitim/uzmanlık künyesi ────────────────────
// licenseNo (Practitioner.identifier) ve specBoard (Practitioner.qualification) AKTİVASYON
// şartıdır — bu kutu bu yüzden Mesleki Belgeler bölümünde, diplomanın hemen altında durur.
export function AcademicEducationBox(props: {
  licenseNo?: string | null;
  eduSchool: string | null; eduYear: number | null;
  specBoard: string | null; specYear: number | null;
}) {
  const [licenseNo, setLicenseNo] = useState(props.licenseNo ?? "");
  const [eduSchool, setEduSchool] = useState(props.eduSchool ?? "");
  const [eduYear, setEduYear] = useState(props.eduYear ? String(props.eduYear) : "");
  const [specBoard, setSpecBoard] = useState(props.specBoard ?? "");
  const [specYear, setSpecYear] = useState(props.specYear ? String(props.specYear) : "");
  const { post, saving, saved, setSaved, err } = useAcademicSave();

  const onChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(e.target.value); setSaved(false); };

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <h2 className="aura-display flex flex-wrap items-center gap-2 text-[17px] font-medium leading-tight tracking-tight text-[var(--c-ink)]">
        <GraduationCap size={17} className="text-[var(--c-accent)]" /> Akademik &amp; Eğitim
        <span className="ml-1 text-xs font-normal text-[var(--c-ink-3)]">(boş alanlar profilde otomatik üretilir)</span>
      </h2>

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

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      {/* Yalnız BU kutunun alanları gönderilir — sertifika/yayın alanları gövdede geçmediği için
          uç onlara dokunmaz (kısmi güncelleme sözleşmesi). */}
      <SaveButton
        saving={saving}
        saved={saved}
        label="Akademik bilgileri kaydet"
        onClick={() => post({ licenseNo, eduSchool, eduYear: Number(eduYear) || null, specBoard, specYear: Number(specYear) || null })}
      />
    </div>
  );
}

// ── KUTU 2 — Sertifikalar & Akademik Çalışmalar: dosyalar + listeler (tamamı ihtiyari) ──────────
export function CertificatesBox(props: {
  certifications: string[];
  publications: Pub[];
  initialDocs?: DocMeta[];
}) {
  const [certsText, setCertsText] = useState(props.certifications.join("\n"));
  const [pubsText, setPubsText] = useState(props.publications.map((p) => `${p.title} | ${p.venue} | ${p.year}`).join("\n"));
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const { post, saving, saved, setSaved, err } = useAcademicSave();

  // Dolu satır sayısı: boş satırlar sayılmaz (kaydetme mantığıyla AYNI filtre — uyarı, gerçekte
  // kaydedilecek satır sayısına göre çıkmalı, ham metne göre değil; yoksa boş satır uyarıyı susturur).
  const certLines = certsText.split("\n").filter((s) => s.trim()).length;
  const pubLines = pubsText.split("\n").map((s) => s.trim()).filter((l) => l && l.split("|")[0]?.trim()).length;
  const certGap = Math.max(0, (docCounts.CERTIFICATE ?? 0) - certLines);
  const pubGap = Math.max(0, (docCounts.ACADEMIC ?? 0) - pubLines);

  const onChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLTextAreaElement>) => { setter(e.target.value); setSaved(false); };

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <h2 className="aura-display flex flex-wrap items-center gap-2 text-[17px] font-medium leading-tight tracking-tight text-[var(--c-ink)]">
        <Award size={17} className="text-[var(--c-accent)]" /> Sertifikalar &amp; Akademik Çalışmalar
        <span className="ml-1 text-xs font-normal text-[var(--c-ink-3)]">(ihtiyari)</span>
      </h2>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">
        Belgelerinizi buradan yükleyin, ardından aşağıdaki listelere de yazın. Liste alanları
        profilinizde ve dizinlerde görünen kısımdır — yüklenen dosya tek başına orada
        görüntülenmez.
      </p>

      {/* Sertifika + akademik çalışma DOSYALARI (kullanıcı kararı 2026-08-17: "Mesleki
          Belgeler"den buraya taşındı) — yükleme, ait olduğu metin alanının hemen üstünde durur. */}
      <div className="mt-4">
        <DoctorDocuments
          types={["CERTIFICATE", "ACADEMIC"]}
          initialDocs={props.initialDocs ?? []}
          initialMmss={EMPTY_MMSS}
          onDocsChange={setDocCounts}
        />
      </div>

      {/* Dosya var ama listeye yazılmamışsa yumuşak hatırlatma (kullanıcı kararı: engellemesin,
          uyarsın). Karşılaştırma DOSYA SAYISI ↔ LİSTE SATIRI. */}
      {certGap > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          {certGap} sertifika dosyası yüklediniz ama listede karşılığı yok — aşağıya adlarını da yazın.
        </p>
      )}
      {pubGap > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/20">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          {pubGap} akademik çalışma dosyası yüklediniz ama listede karşılığı yok — aşağıya başlıklarını da yazın.
        </p>
      )}

      <div className="mt-4">
        <Field label="Sertifikalar / üyelikler" icon={<Award size={14} />} hint="her satıra bir tane">
          <textarea value={certsText} onChange={onChange(setCertsText)} rows={3} placeholder={"ESMO (Avrupa Tıbbi Onkoloji Derneği) üyeliği\nİyi Klinik Uygulamalar (GCP) sertifikası"} className={`${INPUT} resize-y`} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Yayınlar / akademik çalışmalar" icon={<ScrollText size={14} />} hint="her satır: Başlık | Dergi/Kongre | Yıl">
          <textarea value={pubsText} onChange={onChange(setPubsText)} rows={3} placeholder={"Lokal ileri NSCLC'de neoadjuvan tedavi sonuçları | Türk Onkoloji Dergisi | 2021"} className={`${INPUT} resize-y`} />
        </Field>
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      <SaveButton
        saving={saving}
        saved={saved}
        label="Sertifika ve çalışmaları kaydet"
        onClick={() => {
          const certifications = certsText.split("\n").map((s) => s.trim()).filter(Boolean);
          const publications = pubsText.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => {
            const [title, venue, year] = line.split("|").map((x) => x.trim());
            return { title: title || "", venue: venue || "", year: Number(year) || new Date().getFullYear() };
          }).filter((p) => p.title);
          post({ certifications, publications });
        }}
      />
    </div>
  );
}

// ── Geriye uyumlu sarmalayıcı ───────────────────────────────────────────────────────────────────
// /doktor/profil iki kutuyu ARDIŞIK ister (orada bölünmüş yerleşim yok) → eski çağrı imzası
// korunur, içeride yeni iki bileşen render edilir. Onboarding bu sarmalayıcıyı KULLANMAZ;
// kutuları ayrı ayrı, farklı bölümlere yerleştirir.
export function AcademicEditor(props: {
  licenseNo?: string | null;
  eduSchool: string | null; eduYear: number | null;
  specBoard: string | null; specYear: number | null;
  certifications: string[]; publications: Pub[];
  initialDocs?: DocMeta[];
}) {
  return (
    <div className="space-y-4">
      <AcademicEducationBox
        licenseNo={props.licenseNo}
        eduSchool={props.eduSchool}
        eduYear={props.eduYear}
        specBoard={props.specBoard}
        specYear={props.specYear}
      />
      <CertificatesBox
        certifications={props.certifications}
        publications={props.publications}
        initialDocs={props.initialDocs}
      />
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
