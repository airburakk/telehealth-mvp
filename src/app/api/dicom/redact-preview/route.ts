import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { loadDocument } from "@/lib/storage";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { decodePixels, renderPreviewPng, DicomPixelError } from "@/lib/dicom-pixels";
import { analyzeBurnIn } from "@/lib/dicom-burnin";

// POST /api/dicom/redact-preview — burned-in PHI redaksiyon editörünün önizlemesi (v6.37).
//
// ⚠️ Bu ucun döndürdüğü PNG **PHI İÇERİR** (amaç zaten hastayı tanımlayan yazıyı göstermek):
// her istek self-auth'lu, yanıt `private, no-store`, gövde ASLA loglanmaz.
//
// İki kaynak modu:
//   { caseId, docId } → vakadaki DICOM (doktor akışı) — vaka erişim kapısı + post-op daraltma
//   { dataUrl }       → partner formunda yeni seçilen dosya (henüz DB'de yok) — PARTNER/DOCTOR rolü
//
// Yanıttaki autoRects, kayıt anında sunucunun ZATEN uygulayacağı kurallardır (istemciye yalnız
// gösterilir; istemci onları göndermese de uygulanır — client'a güven yok).
const UPLOAD_ROLES = new Set(["PARTNER", "DOCTOR"]);
const MAX_BYTES = 12_000_000; // ~8 MB dosya + base64 payı

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  // WASM decode + tam kare çözme pahalı → sıkı fren.
  const rl = await rateLimit(`dicom-preview:${user.id}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const frameIndex = Math.max(0, Math.min(999, Number(b.frame) || 0));

  let buffer: ArrayBuffer | null = null;

  if (typeof b.caseId === "string" && typeof b.docId === "string") {
    const c = await db.case.findUnique({
      where: { id: b.caseId },
      select: { id: true, userId: true, doctorId: true, branch: true, deletionLockedAt: true },
    });
    if (!c) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    const closed = await staffAccessClosed(b.caseId, user);
    if (closed.closed) {
      return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
    }
    const doc = await db.caseDocument.findUnique({
      where: { id: b.docId },
      select: { caseId: true, mimeType: true, content: true },
    });
    if (!doc || doc.caseId !== b.caseId || doc.mimeType !== "application/dicom" || !doc.content) {
      return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    }
    const dataUri = await loadDocument(doc.content);
    const b64 = typeof dataUri === "string" ? dataUri.replace(/^data:[^;]*;base64,/, "") : "";
    if (!b64) return NextResponse.json({ error: "Belge okunamadı." }, { status: 500 });
    const buf = Buffer.from(b64, "base64");
    buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } else if (typeof b.dataUrl === "string") {
    if (!UPLOAD_ROLES.has(user.role)) return NextResponse.json({ error: "Yetki yok." }, { status: 403 });
    const b64 = b.dataUrl.replace(/^data:[^;]*;base64,/, "");
    if (!b64 || b64.length > MAX_BYTES * 1.4) return NextResponse.json({ error: "Dosya çok büyük." }, { status: 413 });
    const buf = Buffer.from(b64, "base64");
    if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: "Dosya okunamadı." }, { status: 400 });
    buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  if (!buffer) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    const analysis = analyzeBurnIn(buffer);
    const dec = await decodePixels(buffer);
    const preview = renderPreviewPng(dec, frameIndex);
    return NextResponse.json(
      {
        ok: true,
        png: `data:image/png;base64,${Buffer.from(preview.png).toString("base64")}`,
        width: preview.width,
        height: preview.height,
        frames: dec.info.frames,
        modality: dec.info.modality,
        autoRects: analysis.autoRects,
        notes: analysis.notes,
        declaredBurnedIn: analysis.declaredBurnedIn,
        highRisk: analysis.highRisk,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    // Görüntü çözülemedi → editör açılamaz. Kullanıcı yine de yükleyebilir; kayıt yolunda kutu
    // gerekiyorsa (otomatik kural) aynı hata orada FAIL-CLOSED davranır.
    const msg = e instanceof DicomPixelError ? e.message : "Görüntü önizlemesi oluşturulamadı.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
