import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canSoCaseBeAccessedBy } from "@/lib/ownership";
import { logSoEvent } from "@/lib/second-opinion-service";
import { storeDocument } from "@/lib/storage";

const DOC_TYPES = ["EPICRISIS", "IMAGING", "PATHOLOGY", "MEDICATION_LIST"];
const DELIVERY = ["FILE_UPLOAD", "EXTERNAL_LINK"];
// Object storage (S3) henüz yok → küçük dosyalar base64 olarak DB'de (data URI). Kaba sınır ~8MB.
const MAX_FILE_CHARS = 12_000_000; // base64 data URI uzunluğu (≈ 8.5 MB ham dosya)

// Belge ekleme aşamaları: hasta hazırlarken (DRAFT) veya bir talebe yanıt verirken.
const ADDABLE = ["DRAFT", "AWAITING_DOCUMENTS", "AWAITING_ADDITIONAL_TESTS"];

// POST /api/second-opinion/cases/[id]/documents — tipli belge ekle (dosya base64 veya harici link)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canSoCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  if (!ADDABLE.includes(c.status)) {
    return NextResponse.json({ error: "Bu aşamada belge eklenemez." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const deliveryMethod = String(body.deliveryMethod ?? "");
  const label = body.label ? String(body.label).slice(0, 200) : null;

  if (!DOC_TYPES.includes(type)) return NextResponse.json({ error: "Geçersiz belge tipi." }, { status: 400 });
  if (!DELIVERY.includes(deliveryMethod)) return NextResponse.json({ error: "Geçersiz iletim yöntemi." }, { status: 400 });

  let fileRef: string | null = null;
  let externalRef: string | null = null;

  if (deliveryMethod === "EXTERNAL_LINK") {
    const url = String(body.externalRef ?? "").trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      return NextResponse.json({ error: "Geçerli bir bağlantı (http/https) girin." }, { status: 400 });
    }
    externalRef = url.slice(0, 2000);
  } else {
    const data = String(body.fileRef ?? "");
    if (!data.startsWith("data:")) {
      return NextResponse.json({ error: "Dosya verisi geçersiz." }, { status: 400 });
    }
    if (data.length > MAX_FILE_CHARS) {
      return NextResponse.json(
        { error: "Dosya çok büyük (~8 MB üzeri). Lütfen küçültün veya bağlantı olarak ekleyin." },
        { status: 413 },
      );
    }
    fileRef = data;
  }

  const doc = await db.secondOpinionDocument.create({
    // fileRef → object storage'a (varsa) taşınır; yoksa at-rest şifreli inline (E2EE Faz 1). externalRef = sadece link, PHI değil. T11.
    data: { caseId: id, type, deliveryMethod, fileRef: await storeDocument(fileRef, { keyPrefix: "so-doc" }), externalRef, label, uploadedBy: user.id },
  });
  await logSoEvent(id, {
    actorId: user.id,
    actorRole: user.role,
    action: "DOC_UPLOAD",
    detail: `${type} (${deliveryMethod})`,
  });

  // base64 yükü yanıtta geri gönderme — yalnız meta
  return NextResponse.json(
    { id: doc.id, type: doc.type, deliveryMethod: doc.deliveryMethod, externalRef: doc.externalRef, label: doc.label },
    { status: 201 },
  );
}
