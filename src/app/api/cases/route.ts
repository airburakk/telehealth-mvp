import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { notifyRoles } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";
import { encryptField } from "@/lib/crypto";

// GET /api/cases — vaka kuyruğu (filtrelenebilir)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");

  const cases = await db.case.findMany({
    where: {
      ...(branch ? { branch } : {}),
      ...(status ? { status } : {}),
    },
    include: { doctor: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(cases);
}

// POST /api/cases — yeni vaka oluştur (triyaj sunucu tarafında yeniden hesaplanır)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const patientName = String(body.patientName ?? "").trim();
  const symptoms = String(body.symptoms ?? "").trim();
  if (!patientName || !symptoms) {
    return NextResponse.json({ error: "Hasta adı ve şikayet zorunludur." }, { status: 400 });
  }

  const a = await runTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText) : undefined,
    answers: body.answers ?? undefined,
    forceBranchKey: body.forceBranchKey ? String(body.forceBranchKey) : undefined,
  });

  const attachments: string | null = Array.isArray(body.attachments) && body.attachments.length
    ? body.attachments.join(",")
    : null;

  const creator = await getCurrentUser();

  const created = await db.case.create({
    data: {
      userId: creator?.id ?? null, // vaka sahibi (hasta yalnız kendi vakalarını görür)
      patientName,
      country: String(body.country ?? "TR"),
      language: String(body.language ?? "Türkçe"),
      symptoms,
      durationText: body.durationText ? String(body.durationText) : null,
      extra: body.answers ? JSON.stringify(body.answers) : null,
      attachments,
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: a.reasoning,
      status: "NEW",
      consultFee: typeof body.consultFee === "number" ? body.consultFee : null,
      payStatus: ["PAID", "INSURED"].includes(String(body.payStatus)) ? String(body.payStatus) : "PENDING",
      payMethod: body.payMethod ? String(body.payMethod) : null,
      policyNo: body.policyNo ? String(body.policyNo).slice(0, 40) : null,
      payRef: body.payRef ? String(body.payRef).slice(0, 40) : null,
    },
  });

  // Triyajda yüklenen içerikli belgeler → CaseDocument (doktor kokpitte AI ile değerlendirir + Türkçeye çevirir).
  // Yalnız base64 içerikli (görüntü/PDF) olanlar saklanır; DICOM/büyük dosyalar yalnız ad olarak attachments'ta kalır.
  type RawDoc = { label?: unknown; mimeType?: unknown; content?: unknown };
  const documents: RawDoc[] = Array.isArray(body.documents) ? body.documents : [];
  if (documents.length) {
    const rows = documents
      .map((d) => ({
        caseId: created.id,
        label: typeof d.label === "string" ? d.label.slice(0, 200) : "belge",
        mimeType: typeof d.mimeType === "string" ? d.mimeType.slice(0, 100) : "application/octet-stream",
        // Belge içeriği at-rest şifrelenir (E2EE Faz 1). filter aşağıda enc-string'i (truthy) korur.
        content: encryptField(typeof d.content === "string" && d.content.startsWith("data:") ? d.content : null),
      }))
      .filter((r) => !!r.content)
      .slice(0, 12);
    if (rows.length) await db.caseDocument.createMany({ data: rows });
  }

  // §1/§7: yeni klinik vaka koordinatöre DEĞİL doktor kuyruğuna düşer (koordinatör yalnız M3/S3 rezervasyon).
  await notifyRoles(["DOCTOR"], {
    type: "NEW_CASE",
    title: `${a.urgency >= 4 ? "🔴 " : ""}Yeni vaka: ${patientName}`,
    body: `${a.branch} · aciliyet ${a.urgency}/5`,
    href: `/doktor/vaka/${created.id}`,
  });

  // Eksik belge bildirim botu: branşa özel zorunlu belge eksikse koordinatöre bildir (operasyon takibi)
  const missingDocs: string[] = Array.isArray(body.missingDocs)
    ? body.missingDocs.filter((d: unknown) => typeof d === "string").map((d: string) => d.slice(0, 80)).slice(0, 12)
    : [];
  if (missingDocs.length) {
    await notifyRoles(["DOCTOR"], {
      type: "MISSING_DOCS",
      title: `📄 Eksik belge: ${patientName}`,
      body: `${a.branch} · eksik: ${missingDocs.join(", ")}`,
      href: `/doktor/vaka/${created.id}`,
    });
  }

  return NextResponse.json(created, { status: 201 });
}
