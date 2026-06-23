import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assessDocument } from "@/lib/ai-clinical";
import { loincForBranchLabel } from "@/data/coding";
import { decryptField } from "@/lib/crypto";
import { recordAccess, reqMeta } from "@/lib/audit";

export const maxDuration = 60; // PDF/görüntü vision çağrıları + çoklu belge → uzun sürebilir

// POST /api/cases/:id/analyze-docs — vakanın yüklenen tıbbi belgelerini AI ile değerlendir + Türkçeye çevir.
// Klinik personel (DOCTOR/COORDINATOR/ADMIN) başlatır. Varsayılan: yalnız değerlendirilmemiş belgeler;
// { redo: true } ile hepsi yeniden işlenir. Sonuç CaseDocument satırına kaydedilir (kokpit "Belge Analizi" kartı).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, branch: true, symptoms: true, language: true, labResults: true },
  });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  const loincHints = loincForBranchLabel(c.branch).map((e) => ({ code: e.code, label: e.label }));

  const body = await req.json().catch(() => ({}));
  const redo = !!body?.redo;

  const docs = await db.caseDocument.findMany({
    where: { caseId: id, content: { not: null }, ...(redo ? {} : { assessedAt: null }) },
    select: { id: true, label: true, content: true },
  });
  if (!docs.length) {
    return NextResponse.json({ ok: true, assessed: 0, failed: 0, message: "Değerlendirilecek belge yok." });
  }

  const results = await Promise.allSettled(
    docs.map(async (d) => {
      const a = await assessDocument(decryptField(d.content as string), { // at-rest şifreli → AI girdisi için çöz
        branch: c.branch,
        symptoms: decryptField(c.symptoms), // at-rest şifreli → AI bağlamı için çöz
        language: c.language,
        label: d.label,
        loincHints,
      });
      await db.caseDocument.update({
        where: { id: d.id },
        data: {
          aiDocType: a.docType,
          aiSummary: a.summary,
          aiTranslation: a.translation,
          aiFlags: a.flags,
          assessedAt: new Date(),
        },
      });
      return a.docType === "Laboratuvar" ? a.labs : [];
    })
  );

  const assessed = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - assessed;

  // Hiçbiri başarmadıysa (ör. anahtar yok / desteklenmeyen biçim) → anlamlı hata
  if (assessed === 0 && failed > 0) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    const msg = first?.reason instanceof Error ? first.reason.message : "Belge değerlendirilemedi.";
    return NextResponse.json({ error: msg, failed }, { status: 502 });
  }

  // AI'nin laboratuvar belgelerinden çıkardığı değerleri lab formuna (Case.labResults) ÖNERİ olarak ekle.
  // aiSuggested:true → doktor "Kaydet" ile onaylayana dek FHIR Observation'a girmez; var olan satırlar ezilmez (dedup).
  type LabRow = { loinc?: string; name?: string; value?: string; unit?: string; abnormal?: string; aiSuggested?: boolean };
  const extracted = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  let addedLabs = 0;
  if (extracted.length) {
    let existing: LabRow[] = [];
    try {
      const p = c.labResults ? JSON.parse(c.labResults) : [];
      if (Array.isArray(p)) existing = p;
    } catch {
      existing = [];
    }
    const norm = (s?: string) => (s || "").trim().toLowerCase();
    const keyOf = (r: LabRow) => (r.loinc ? `c:${r.loinc}` : `n:${norm(r.name)}`);
    const seen = new Set(existing.map(keyOf));
    const additions: LabRow[] = [];
    for (const l of extracted) {
      const row: LabRow = {
        name: l.name,
        value: l.value,
        unit: l.unit,
        ...(l.loinc ? { loinc: l.loinc } : {}),
        ...(l.abnormal ? { abnormal: l.abnormal } : {}),
        aiSuggested: true,
      };
      const k = keyOf(row);
      if (seen.has(k)) continue; // aynı analit zaten var → tekrar ekleme
      seen.add(k);
      additions.push(row);
    }
    if (additions.length) {
      const merged = [...existing, ...additions].slice(0, 50);
      await db.case.update({ where: { id }, data: { labResults: JSON.stringify(merged) } });
      addedLabs = additions.length;
    }
  }

  // Belge içeriği + semptomlar çözülüp dış AI'ya gönderildi → denetim kaydına mühürle.
  await recordAccess({
    actor: user, action: "DOCUMENT_ANALYZE", resourceType: "CASE", resourceId: id, subjectUserId: c.userId,
    detail: `${assessed} belge değerlendirildi${addedLabs ? ` · ${addedLabs} lab önerisi` : ""}`, ...reqMeta(req),
  });

  // Güncel tüm değerlendirmeleri döndür (içerik hariç) → kokpit reload'suz güncellenir
  const all = await db.caseDocument.findMany({
    where: { caseId: id },
    select: {
      id: true, label: true, mimeType: true,
      aiDocType: true, aiSummary: true, aiTranslation: true, aiFlags: true, assessedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    assessed,
    failed,
    addedLabs,
    documents: all.map((d) => ({ ...d, assessedAt: d.assessedAt ? d.assessedAt.toISOString() : null })),
  });
}
