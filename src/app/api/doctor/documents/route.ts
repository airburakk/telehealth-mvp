import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storeDocument, deleteDocument } from "@/lib/storage";
import { detectDocumentKind, DOC_REJECT_MESSAGE } from "@/lib/document-mime";
import { ALL_DOC_TYPES, refreshActivation, refreshChamberLetter } from "@/lib/doctor-activation";

// Object storage (S3) henüz yok → küçük dosyalar base64 olarak DB'de (data URI). Kaba sınır ~8.5 MB.
const MAX_FILE_CHARS = 12_000_000;

// Oturumdaki doktorun doctorId'si (yalnız kendi belgelerine erişir — IDOR engeli).
async function myDoctorId(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  return u?.doctorId ?? null;
}

// GET /api/doctor/documents — kendi belgelerinin meta listesi (içerik DÖNMEZ).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  const docs = await db.doctorDocument.findMany({
    where: { doctorId },
    select: { id: true, type: true, label: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents: docs });
}

// POST /api/doctor/documents — mesleki belge yükle (diploma/MMSS/sertifika/akademik). İçerik base64 + şifreli.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const type = String(b.type ?? "");
  const label = (b.label ? String(b.label) : "Belge").slice(0, 200);
  const content = String(b.content ?? "");

  if (!ALL_DOC_TYPES.includes(type as (typeof ALL_DOC_TYPES)[number])) {
    return NextResponse.json({ error: "Geçersiz belge tipi." }, { status: 400 });
  }
  if (!content.startsWith("data:")) return NextResponse.json({ error: "Dosya verisi geçersiz (data URI bekleniyor)." }, { status: 400 });
  if (content.length > MAX_FILE_CHARS) {
    return NextResponse.json({ error: "Dosya çok büyük (~8 MB üzeri). Lütfen küçültün." }, { status: 413 });
  }
  // İçerik-tipi kapısı (2026-08-03 P0): tip istemcinin beyanından DEĞİL dosya imzasından tespit edilir
  // (diploma/MMSS belgeleri admin onay ekranında açılıyor → aynı depolanmış-XSS yüzeyi).
  const kind = detectDocumentKind(content);
  if (!kind) return NextResponse.json({ error: DOC_REJECT_MESSAGE }, { status: 415 });
  const mimeType = kind.mime;

  // Tekil belgeler (diploma + MMSS + tabip odası yazısı): tek geçerli kopya → yeni yükleme eskisini değiştirir.
  if (type === "DIPLOMA" || type === "MMSS" || type === "CHAMBER") {
    const old = await db.doctorDocument.findMany({ where: { doctorId, type }, select: { content: true } });
    await Promise.all(old.map((o) => deleteDocument(o.content))); // eski Blob nesnelerini temizle (T11)
    await db.doctorDocument.deleteMany({ where: { doctorId, type } });
  }

  const stored = await storeDocument(content, { keyPrefix: "doctor-doc" }); // object storage / inline şifreli (T11)
  const doc = await db.doctorDocument.create({
    data: { doctorId, type, label, mimeType, content: stored as string },
  });

  // İki kapı ayrı damgalanır: activated = Aşama 2 (klinik), doctorium = Aşama 1 (CHAMBER ∨ aktivasyon).
  const activated = await refreshActivation(doctorId);
  const doctorium = await refreshChamberLetter(doctorId);
  // base64 yükü yanıtta geri gönderme — yalnız meta + güncel kapı durumları
  return NextResponse.json(
    { id: doc.id, type: doc.type, label: doc.label, mimeType: doc.mimeType, activated, doctorium },
    { status: 201 },
  );
}

// DELETE /api/doctor/documents?id=... — kendi belgeni kaldır. Zorunlu belge silinirse aktivasyon düşer.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const doc = await db.doctorDocument.findUnique({ where: { id }, select: { id: true, doctorId: true, content: true } });
  if (!doc || doc.doctorId !== doctorId) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });

  await db.doctorDocument.delete({ where: { id } });
  await deleteDocument(doc.content); // Blob nesnesini de kaldır (T11)
  const activated = await refreshActivation(doctorId);
  const doctorium = await refreshChamberLetter(doctorId); // CHAMBER silindiyse Doctorium kapısı da düşer
  return NextResponse.json({ ok: true, activated, doctorium });
}
