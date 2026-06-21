import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assessDocument } from "@/lib/ai-clinical";

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
    select: { id: true, branch: true, symptoms: true, language: true },
  });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

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
      const a = await assessDocument(d.content as string, {
        branch: c.branch,
        symptoms: c.symptoms,
        language: c.language,
        label: d.label,
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
    documents: all.map((d) => ({ ...d, assessedAt: d.assessedAt ? d.assessedAt.toISOString() : null })),
  });
}
