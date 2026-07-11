import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { notifyDoctorsByBranch } from "@/lib/notify";
import { requireUser, requireStaff } from "@/lib/api-auth";
import { stampPatientJourney } from "@/lib/patient-journey";
import { parseContactFields } from "@/lib/contact-pref";
import { encryptField, decryptField } from "@/lib/crypto";
import { storeDocument } from "@/lib/storage";

// GET /api/cases — vaka kuyruğu (filtrelenebilir + sayfalı, /denetim getChainAudit deseni)
export async function GET(req: Request) {
  // Vaka kuyruğu = klinik personel. Kimliksiz PHI dökümü kapandı (T1/P0).
  const { user, error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");
  // Sayfalama: varsayılan 50, üst sınır 100 (tüm tabloyu tek yanıtta taşıma).
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50));

  // DOCTOR daraltması (2026-07-03, savunma-derinliği): doktor yalnız kendine atanan + KENDİ branşındaki
  // atanmamış vakaları listeler (kokpit doktor/page.tsx:71 deseninin API eşleniği; canCaseBeAccessedBy ile
  // hizalı). COORDINATOR/ETHICS/ADMIN tüm kuyruğu görür. Profili/branşı yoksa → yalnız kendine atananlar.
  let doctorScope: Prisma.CaseWhereInput = {};
  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const doc = me?.doctorId
      ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { id: true, branch: true } })
      : null;
    doctorScope = doc
      ? { OR: [{ doctorId: doc.id }, ...(doc.branch ? [{ doctorId: null, branch: doc.branch }] : [])] }
      : { id: "__none__" }; // profilsiz doktor → boş küme (var olmayan id)
  }

  const where: Prisma.CaseWhereInput = {
    ...(branch ? { branch } : {}),
    ...(status ? { status } : {}),
    ...doctorScope,
  };
  const total = await db.case.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // İstenen sayfayı geçerli aralığa sıkıştır (0/negatif/NaN/aşırı-büyük güvenli).
  const page = Math.min(Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1), totalPages);

  const cases = await db.case.findMany({
    where,
    // Dar liste-DTO: klinik metin (symptoms/reasoning/extra) ve belge içerikleri listede taşınmaz.
    select: {
      id: true,
      patientName: true,
      country: true,
      language: true,
      branch: true,
      urgency: true,
      status: true,
      createdAt: true,
      doctor: { select: { title: true, name: true } },
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  // Yalnız kimlik (patientName) at-rest şifreli → çöz (E2EE inc.2c); diğer alanlar düz.
  const items = cases.map((c) => ({ ...c, patientName: decryptField(c.patientName) }));
  return NextResponse.json({ items, total, page, pageSize, totalPages });
}

// POST /api/cases — yeni vaka oluştur (triyaj sunucu tarafında yeniden hesaplanır)
export async function POST(req: Request) {
  // Vaka oluşturma giriş ister → anonim vaka + ölçümsüz AI (DoS/maliyet) kapandı (T1).
  const { user, error } = await requireUser();
  if (error) return error;

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

  const contact = parseContactFields(body); // FAZ 8 — telefon + iletişim tercihi

  const created = await db.case.create({
    data: {
      userId: user.id, // vaka sahibi = oturum kullanıcısı (hasta yalnız kendi vakalarını görür)
      patientName: encryptField(patientName), // kimlik at-rest şifreli (E2EE inc.2c)
      country: String(body.country ?? "TR"),
      language: String(body.language ?? "Türkçe"),
      symptoms: encryptField(symptoms),
      durationText: body.durationText ? String(body.durationText) : null,
      extra: encryptField(body.answers ? JSON.stringify(body.answers) : null), // branş soruları JSON (E2EE Faz 1)
      attachments,
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: encryptField(a.reasoning), // triyaj gerekçesi (E2EE Faz 1)
      status: "NEW",
      // Hasta iletişim (FAZ 8): telefon kimlik verisi → şifreli; tercih (APP|SMS|EMAIL) düz.
      patientPhone: contact.phone ? encryptField(contact.phone) : null,
      contactPreference: contact.contactPreference,
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
    const valid = documents
      .filter((d) => typeof d.content === "string" && (d.content as string).startsWith("data:"))
      .slice(0, 12);
    const rows = await Promise.all(
      valid.map(async (d) => ({
        caseId: created.id,
        label: typeof d.label === "string" ? d.label.slice(0, 200) : "belge",
        mimeType: typeof d.mimeType === "string" ? d.mimeType.slice(0, 100) : "application/octet-stream",
        // Belge içeriği object storage'a (varsa) taşınır; yoksa at-rest şifreli inline (E2EE Faz 1). T11.
        content: await storeDocument(d.content as string, { keyPrefix: "case-doc" }),
      })),
    );
    if (rows.length) await db.caseDocument.createMany({ data: rows });
  }

  // §1/§7: yeni klinik vaka koordinatöre DEĞİL doktor kuyruğuna düşer (koordinatör yalnız M3/S3 rezervasyon).
  // Yeni vakada henüz atanan doktor YOK → tüm doktorlara yayın yerine yalnız vakanın BRANŞINDAKİ
  // portal doktorlarına kişisel bildirim (atama Nöbetçi/İcapçı kapınca yapılır).
  await notifyDoctorsByBranch(a.branch, {
    type: "NEW_CASE",
    title: `${a.urgency >= 4 ? "🔴 " : ""}Yeni vaka`, // isim bildirime gömülmez (E2EE inc.2c) → personel kokpitte görür
    body: `${a.branch} · aciliyet ${a.urgency}/5`,
    href: `/doktor/vaka/${created.id}`,
  });

  // Eksik belge bildirim botu: branşa özel zorunlu belge eksikse koordinatöre bildir (operasyon takibi)
  const missingDocs: string[] = Array.isArray(body.missingDocs)
    ? body.missingDocs.filter((d: unknown) => typeof d === "string").map((d: string) => d.slice(0, 80)).slice(0, 12)
    : [];
  if (missingDocs.length) {
    await notifyDoctorsByBranch(a.branch, {
      type: "MISSING_DOCS",
      title: `📄 Eksik belge`,
      body: `${a.branch} · eksik: ${missingDocs.join(", ")}`,
      href: `/doktor/vaka/${created.id}`,
    });
  }

  await stampPatientJourney(user.id, user.role, "GENERAL"); // nav bileşimi başvurulan akıştan

  return NextResponse.json(created, { status: 201 });
}
