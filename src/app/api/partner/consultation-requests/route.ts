import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createRequestFromInput, processRequestAi, DicomRejectedError, type PartnerDocInput } from "@/lib/consultation-requests";
import { LANGUAGES, COUNTRIES } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";

export const maxDuration = 60; // belge AI değerlendirme (vision/PDF) + özet çeviri → uzun sürebilir

const LANG_SET = new Set(LANGUAGES);
const BRANCH_LABELS = new Set(BRANCHES.map((b) => b.label));
const COUNTRY_NAME = new Map(COUNTRIES.map((c) => [c.code, c.name]));

// Belge data URL doğrulama: PDF + yaygın görüntü + DICOM (v6.32 — sunucuda PHI tag-strip'ten geçer). ~8MB.
const ALLOWED_MIME = /^(application\/pdf|application\/dicom|image\/(jpeg|png|webp|gif))$/;
function parseDocs(raw: unknown): PartnerDocInput[] {
  if (!Array.isArray(raw)) return [];
  const out: PartnerDocInput[] = [];
  for (const d of raw.slice(0, 8)) {
    if (!d || typeof d.dataUrl !== "string") continue;
    const m = /^data:([^;]+);base64,/.exec(d.dataUrl);
    if (!m || !ALLOWED_MIME.test(m[1])) continue;
    if (d.dataUrl.length > 11_000_000) continue; // ~8MB base64
    out.push({ label: typeof d.label === "string" ? d.label : "belge", mime: m[1], dataUrl: d.dataUrl });
  }
  return out;
}

// POST /api/partner/consultation-requests — M5 Faz 3: Partner doktor anonim konsültasyon talebi açar.
// Self-auth: yalnız PARTNER rolü + bağlı PartnerDoctor. Hasta DB'sine erişim YOK; partner klinik bilgiyi kendi girer.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARTNER") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
  const partner = dbUser?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: dbUser.partnerId } }) : null;
  if (!partner) {
    return NextResponse.json({ error: "Partner profili bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));

  const clinicalSummary = typeof b.clinicalSummary === "string" ? b.clinicalSummary.trim() : "";
  if (clinicalSummary.length < 10) {
    return NextResponse.json({ error: "Klinik özet en az 10 karakter olmalı." }, { status: 400 });
  }

  const branchLimited = b.branchLimited === true;
  const branch = branchLimited && typeof b.branch === "string" && BRANCH_LABELS.has(b.branch) ? b.branch : null;
  if (branchLimited && !branch) {
    return NextResponse.json({ error: "Geçerli bir branş seçin veya branş sınırını kaldırın." }, { status: 400 });
  }

  // Bölge: ülke kodu geldiyse adına çevir; serbest metin de kabul (kısalt).
  const region = typeof b.region === "string" && b.region.trim()
    ? (COUNTRY_NAME.get(b.region.trim()) ?? b.region.trim().slice(0, 60))
    : (partner.country ? COUNTRY_NAME.get(partner.country) ?? partner.country : "—");

  const language = typeof b.language === "string" && LANG_SET.has(b.language) ? b.language : "Türkçe";
  const urgency = Math.min(5, Math.max(1, Math.round(Number(b.urgency) || 3)));
  const icd10Code = typeof b.icd10Code === "string" && b.icd10Code.trim() ? b.icd10Code.trim().slice(0, 20) : null;

  const documents = parseDocs(b.documents);

  let id: string;
  try {
    id = await createRequestFromInput({
      partnerId: partner.id,
      partnerName: `${partner.title} ${partner.name} (${COUNTRY_NAME.get(partner.country) ?? partner.country})`,
      branchLimited,
      branch,
      region,
      language,
      urgency,
      icd10Code,
      clinicalSummary,
    }, documents);
  } catch (e) {
    // Fail-closed (v6.32): sıyrılamayan DICOM = talep HİÇ açılmaz; partner dosyayı düzeltip yeniden dener.
    if (e instanceof DicomRejectedError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  // AI işleme: klinik özeti TR'ye çevir + her belgeyi assessDocument ile değerlendir (tür/çeviri/labs).
  // Anahtar yoksa/hata olursa talep yine de açık kalır (best-effort).
  await processRequestAi(id);

  return NextResponse.json({ ok: true, id });
}
