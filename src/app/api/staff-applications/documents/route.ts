import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storeDocument, deleteDocument } from "@/lib/storage";
import { detectDocumentKind, DOC_REJECT_MESSAGE } from "@/lib/document-mime";
import { isStaffSignupRole } from "@/lib/roles";
import { STAFF_ROLE_CONFIGS } from "@/lib/staff-application-config";

// Kurumsal başvuru belgeleri (2026-08-12) — /api/doctor/documents eşleniği.
// Self-auth (middleware /api'yi korumaz): yalnız KENDİ başvurusuna yükler/listeler (IDOR engeli:
// applicationId istemciden ALINMAZ, oturumdan çözülür). İçerik imza-tabanlı MIME kapısından geçer
// (depolanmış-XSS dersi) ve object-storage/inline ŞİFRELİ saklanır (storeDocument).
const MAX_FILE_CHARS = 12_000_000; // ~8.5 MB (doctor/documents ile aynı kaba sınır)

async function myApplication(userId: string) {
  return db.staffApplication.findUnique({
    where: { userId },
    select: { id: true, role: true, status: true },
  });
}

// GET — kendi başvuru belgelerinin meta listesi (içerik DÖNMEZ).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isStaffSignupRole(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const app = await myApplication(user.id);
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  const docs = await db.staffDocument.findMany({
    where: { applicationId: app.id },
    select: { id: true, type: true, label: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents: docs });
}

// POST — başvuru belgesi yükle. Her tip TEK kopya: yeni yükleme eskisini değiştirir.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isStaffSignupRole(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const app = await myApplication(user.id);
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  if (app.status === "APPROVED") {
    return NextResponse.json({ error: "Başvurunuz onaylanmış — belge güncellemesi gerekmiyor." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const type = String(b.type ?? "");
  const label = (b.label ? String(b.label) : "Belge").slice(0, 200);
  const content = String(b.content ?? "");

  const allowedTypes = STAFF_ROLE_CONFIGS[app.role as keyof typeof STAFF_ROLE_CONFIGS]?.docs.map((d) => d.type) ?? [];
  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ error: "Geçersiz belge tipi." }, { status: 400 });
  }
  if (!content.startsWith("data:")) return NextResponse.json({ error: "Dosya verisi geçersiz (data URI bekleniyor)." }, { status: 400 });
  if (content.length > MAX_FILE_CHARS) {
    return NextResponse.json({ error: "Dosya çok büyük (~8 MB üzeri). Lütfen küçültün." }, { status: 413 });
  }
  const kind = detectDocumentKind(content);
  if (!kind) return NextResponse.json({ error: DOC_REJECT_MESSAGE }, { status: 415 });

  const old = await db.staffDocument.findMany({ where: { applicationId: app.id, type }, select: { content: true } });
  await Promise.all(old.map((o) => deleteDocument(o.content)));
  await db.staffDocument.deleteMany({ where: { applicationId: app.id, type } });

  const stored = await storeDocument(content, { keyPrefix: "staff-doc" });
  const doc = await db.staffDocument.create({
    data: { applicationId: app.id, type, label, mimeType: kind.mime, content: stored as string },
  });

  return NextResponse.json(
    { id: doc.id, type: doc.type, label: doc.label, mimeType: doc.mimeType },
    { status: 201 },
  );
}
