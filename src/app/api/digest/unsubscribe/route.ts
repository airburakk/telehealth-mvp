import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAccess } from "@/lib/audit";
import { verifyDigestUnsubToken, DIGEST_NAME } from "@/lib/daily-digest";

// Doctorium Post — e-posta aboneliğinden çıkış (2026-08-24). Tasarım belgesi §6.
//
// İki yol, tek sonuç (digestChannel → null; tercihlerden yeniden açılabilir):
//  · POST = RFC 8058 tek-tık — Gmail/Yahoo "Abonelikten çık" düğmesi arayüzsüz POST atar;
//    anında işlenir (⚖️ ETK "çıkış ≤2 gün" şartının çok altında — pratikte anlık).
//  · GET = e-posta GÖVDESİNDEKİ link — DOĞRUDAN işlem YAPMAZ: e-posta istemcileri/güvenlik
//    tarayıcıları linkleri ön-yükler (prefetch); GET'te işlem yapmak kazara çıkışa yol açar.
//    GET onay sayfası döndürür, asıl işlem sayfadaki formun POST'uyla olur.
//
// Auth = token (HMAC(doctorId), lib/daily-digest.ts) — oturum ARANMAZ (e-posta istemcisi
// çerezsiz POST atar; RFC 8058 böyle çalışır). Token doktora özel ve tahmin edilemez;
// yanlış token 403. Çıkış audit zincirine yazılır (⚖️ işlem tarihi ispatı).

function checkParams(url: URL): { doctorId: string; token: string } | null {
  const doctorId = url.searchParams.get("d") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!doctorId || !token) return null;
  return { doctorId, token };
}

async function unsubscribe(doctorId: string): Promise<boolean> {
  const doctor = await db.doctor.findUnique({ where: { id: doctorId }, select: { id: true, digestChannel: true } });
  if (!doctor) return false;
  if (doctor.digestChannel !== null) {
    await db.doctor.update({ where: { id: doctorId }, data: { digestChannel: null } });
  }
  await recordAccess({
    actor: null, // e-posta üzerinden token'lı işlem — oturum yok
    action: "DIGEST_UNSUBSCRIBE",
    resourceType: "DOCTOR",
    resourceId: doctorId,
    subjectUserId: null,
    detail: `Doctorium Post e-posta aboneliğinden çıkış (önceki kanal: ${doctor.digestChannel ?? "kapalı"})`,
  });
  return true;
}

export async function POST(req: Request) {
  const p = checkParams(new URL(req.url));
  if (!p) return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
  if (!verifyDigestUnsubToken(p.doctorId, p.token)) {
    return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 403 });
  }
  const ok = await unsubscribe(p.doctorId);
  if (!ok) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true, message: `${DIGEST_NAME} e-posta aboneliği kapatıldı.` });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = checkParams(url);
  const valid = p ? verifyDigestUnsubToken(p.doctorId, p.token) : false;
  const html = valid
    ? `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${DIGEST_NAME} — Abonelikten çık</title></head>
<body style="margin:0;font-family:Georgia,serif;background:#f4f6f5;color:#1a1d1c;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:420px;padding:36px 28px;background:#fff;border:1px solid #d9dedb;border-radius:12px;text-align:center;">
<div style="font-size:22px;font-weight:700;letter-spacing:3px;">DOCTORIUM <span style="color:#0c7a5b;">POST</span></div>
<p style="font-size:14.5px;line-height:1.6;color:#4a524f;margin:18px 0 22px;">Günlük özet e-postalarını almayı bırakmak istediğinizden emin misiniz? Aboneliği daha sonra Akış Tercihleri sayfanızdan yeniden açabilirsiniz.</p>
<form method="post" action="${url.pathname}?d=${encodeURIComponent(p!.doctorId)}&amp;t=${encodeURIComponent(p!.token)}">
<button type="submit" style="font-family:inherit;font-size:14px;font-weight:600;color:#fff;background:#0c7a5b;border:0;border-radius:8px;padding:10px 22px;cursor:pointer;">Abonelikten çık</button>
</form></div></body></html>`
    : `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Geçersiz bağlantı</title></head>
<body style="margin:0;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;color:#1a1d1c;">
<p style="font-size:15px;">Bu bağlantı geçersiz ya da süresi dolmuş. Aboneliğinizi Akış Tercihleri sayfanızdan yönetebilirsiniz.</p></body></html>`;
  return new NextResponse(html, {
    status: valid ? 200 : 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
