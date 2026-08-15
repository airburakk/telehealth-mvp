import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/doctor/media-upload — profil medyası client-upload token bekçisi (2026-08-14).
// Foto (≤5MB) ve tanıtım videosu (≤50MB) TARAYICIDAN DOĞRUDAN public Blob'a gider: Vercel
// fonksiyon gövde limiti (4.5MB) rota üzerinden dosya taşımayı imkânsız kılar, bu yüzden
// @vercel/blob/client deseni — bu uç yalnız tür+boyut sınırlı kısa ömürlü token üretir.
// Vitrin medyası PHI DEĞİL → public access bilinçli; klinik belgeler lib/storage.ts'in
// ŞİFRELİ private deseninde kalır (bu uca taşınmaz).
// DB yazımı burada YAPILMAZ: onUploadCompleted callback'i localhost'ta hiç çağrılmadığı için
// istemci, yükleme bitince dönen URL'i /api/doctor/preferences POST'uyla mühürler.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const kind = clientPayload === "video" ? "video" : "photo";
        return kind === "video"
          ? {
              allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
              maximumSizeInBytes: 50 * 1024 * 1024, // 50MB — ≤60 sn beyanının gerçek tavanı (süre sunucuda ölçülemez)
              addRandomSuffix: true,
              tokenPayload: me.doctorId,
            }
          : {
              allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
              maximumSizeInBytes: 5 * 1024 * 1024, // 5MB profil fotoğrafı
              addRandomSuffix: true,
              tokenPayload: me.doctorId,
            };
      },
      // Localhost'ta çağrılmaz (Vercel geri-çağrısı publik URL ister) — DB yazımı istemcide,
      // yükleme sonrası preferences POST'uyla yapılır; burada iş yok.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Yükleme reddedildi." }, { status: 400 });
  }
}
