import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LANGUAGES, COUNTRIES, langDir } from "@/lib/constants";
import { getTranslations } from "@/lib/i18n";
import { BRANCHES } from "@/lib/triage";
import { PartnerRequestForm } from "./PartnerRequestForm";

export const dynamic = "force-dynamic";

// Formun tüm sabit metinleri (kanonik TR) — partner doktorun diline çevrilir.
const FORM_UI = {
  back: "Panel",
  title: "Konsültasyon Talebi Oluştur",
  warning: "Girdiğiniz bilgi anonimleştirme katmanından geçirilir — yanlışlıkla yazılan ad / kimlik no / iletişim bilgisi otomatik maskelenir. Lütfen yine de hasta kimliği yazmayın.",
  branchLimit: "Talebi belirli bir branşla sınırla",
  branchUnlimited: "Sınırsız → tüm uzman hekimler genel havuzda görür.",
  region: "Hasta bölgesi / ülkesi",
  patientLang: "Hasta dili",
  urgency: "Aciliyet (1-5)",
  icd: "ICD-10 kodu (opsiyonel)",
  summary: "Klinik özet",
  summaryPlaceholder: "Tanı, şikâyetler, ilgili tetkik/lab bulguları… (hasta kimliği YAZMAYIN)",
  docsLabel: "Tıbbi belge / sonuç / görüntüleme",
  docsOptional: "(opsiyonel, en çok 8)",
  docsHelp: "PDF veya görüntü (DICOM kapsam dışı). Lab/radyoloji/epikriz AI ile değerlendirilir, Türkçeye çevrilir ve FHIR olarak kodlanır. Üzerinde hasta kimliği bulunmayan belgeler yükleyin.",
  addDoc: "Belge ekle",
  submit: "Talebi gönder",
  submitting: "Gönderiliyor — belgeler AI ile değerlendiriliyor…",
  errMinSummary: "Klinik özet en az 10 karakter olmalı.",
  errPdfBig: "PDF çok büyük (max ~8MB).",
  errOnlyPdfImg: "yalnız PDF ve görüntü desteklenir (DICOM kapsam dışı).",
  errUnreadable: "okunamadı.",
  errGeneric: "Hata oluştu.",
  errSendFail: "Gönderilemedi.",
} as const;

export type FormStrings = Record<keyof typeof FORM_UI, string>;

// M5 — Partner doktorun anonim konsültasyon talebi oluşturma formu (arayüz partner dilinde + RTL).
export default async function PartnerRequestPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/giris?next=/partner/talep");
  const u = await db.user.findUnique({ where: { id: session.id }, select: { partnerId: true } });
  const partner = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId }, select: { country: true, branch: true, language: true } }) : null;
  if (!partner) redirect("/");

  const lang = partner.language || "İngilizce";
  const keys = Object.keys(FORM_UI) as (keyof typeof FORM_UI)[];
  const tx = await getTranslations(lang, keys.map((k) => FORM_UI[k]));
  const t = Object.fromEntries(keys.map((k) => [k, tx[FORM_UI[k]] ?? FORM_UI[k]])) as FormStrings;

  return (
    <PartnerRequestForm
      branches={BRANCHES.map((b) => b.label)}
      countries={COUNTRIES.map((c) => ({ code: c.code, name: c.name, flag: c.flag }))}
      languages={LANGUAGES}
      defaultCountry={partner.country}
      defaultBranch={partner.branch}
      t={t}
      dir={langDir(lang)}
    />
  );
}
