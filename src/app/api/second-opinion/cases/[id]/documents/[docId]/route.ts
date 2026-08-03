import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canSoCaseBeAccessedBy } from "@/lib/ownership";
import { logSoEvent } from "@/lib/second-opinion-service";
import { loadDocument } from "@/lib/storage";
import { detectDocumentKind, documentResponseHeaders } from "@/lib/document-mime";
import { safeExternalUrl } from "@/lib/external-url";

// GET /api/second-opinion/cases/[id]/documents/[docId] — belgeyi görüntüle (sahip hasta, ATANMIŞ doktor
// veya koordinatör/admin — BOLA düzeltmesi: doktor yalnız kendisine atanmış vakanın belgesini açabilir).
// EXTERNAL_LINK → harici bağlantıya yönlendir; FILE_UPLOAD → base64'ü çöz, dosyayı döndür.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id }, select: { patientId: true, assignedDoctorId: true, deletionLockedAt: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canSoCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const doc = await db.secondOpinionDocument.findFirst({ where: { id: docId, caseId: id } });
  if (!doc) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });

  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "DOC_VIEW", detail: doc.type });

  if (doc.deliveryMethod === "EXTERNAL_LINK" && doc.externalRef) {
    // Yönlendirmeden ÖNCE yeniden doğrula (2026-08-03): yazım anındaki regex tek savunma olmasın —
    // satır başka bir yoldan/eski bir sürümden gelmiş olabilir. Yalnız http(s), kimlik bilgisi
    // gömülmemiş URL'ler geçer; aksi halde yönlendirme yapılmaz.
    const safe = safeExternalUrl(doc.externalRef);
    if (!safe) {
      return NextResponse.json({ error: "Bu belgeye ait bağlantı güvenli değil; açılmadı." }, { status: 400 });
    }
    return NextResponse.redirect(safe);
  }
  if (!doc.fileRef) return NextResponse.json({ error: "Dosya yok." }, { status: 404 });

  const dataUri = await loadDocument(doc.fileRef); // object storage'tan (varsa) yükle + çöz (T11)
  const m = dataUri ? dataUri.match(/^data:([^;]+);base64,([\s\S]*)$/) : null;
  if (!m) return NextResponse.json({ error: "Dosya biçimi geçersiz." }, { status: 400 });

  // İçerik-tipi (2026-08-03 P0): eskiden `Content-Type: m[1]` yani İSTEMCİNİN yüklerken verdiği tip
  // `inline` döndürülüyordu → `data:text/html` yükleyen hasta, belgeyi açan personelin oturumunda
  // kod çalıştırabiliyordu. Tip artık dosya imzasından tespit edilir; tanınmayan içerik
  // `application/octet-stream` + indirme olarak sunulur (denetim öncesi yüklenmiş kayıtlar dahil).
  const kind = detectDocumentKind(dataUri!);
  if (!kind) {
    return NextResponse.json(
      { error: "Bu belge güvenli bir dosya türü olarak tanınmadı ve gösterilemiyor." },
      { status: 415 },
    );
  }
  const buf = Buffer.from(m[2], "base64");
  return new Response(new Uint8Array(buf), {
    headers: documentResponseHeaders(kind.mime, `${doc.type.toLowerCase()}-${docId.slice(0, 6)}.${kind.ext}`),
  });
}
