import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storeDocument, deleteDocument, purgedRef } from "@/lib/storage";
import { detectDocumentKind, DOC_REJECT_MESSAGE } from "@/lib/document-mime";
import { ALL_DOC_TYPES, refreshActivation, hasDoctoriumAccess } from "@/lib/doctor-activation";
import {
  parseEdevletBelge, degerlendir, pdfMetniOku, onayKarari, type EdevletSonuc,
} from "@/lib/edevlet-belge";
import { edevletDogrula, type EdevletDogrulamaSonucu } from "@/lib/edevlet-dogrula";
import { encryptField } from "@/lib/crypto";
import { recordAccess, reqMeta } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

// Object storage (S3) henüz yok → küçük dosyalar base64 olarak DB'de (data URI). Kaba sınır ~8.5 MB.
const MAX_FILE_CHARS = 12_000_000;

// e-Devlet barkodlu belge otomatik doğrulaması hangi tiplerde denenir (v6.119).
// DIPLOMA: klinik kapıyı açar (canActivate). v6.143: STUDENT_CERT bu uçtan TAMAMEN kaldırıldı —
// öğrenci kapısı artık burada değil, üniversite e-postası doğrulaması (lib/universities.ts +
// api/auth/verify-student-email).
const OTOMATIK_DOGRULANAN = new Set(["DIPLOMA"]);

// Oturumdaki doktorun doctorId'si (yalnız kendi belgelerine erişir — IDOR engeli).
async function myDoctorId(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  return u?.doctorId ?? null;
}

// Güncel Doctorium erişimi (v6.143: bu uçtan yalnız diploma tarafı değişebilir — STUDENT_CERT
// kalktığından studentVerifiedAt bu route'ta hiç dokunulmaz, yine de taze okunur — tek doğruluk
// kaynağı hasDoctoriumAccess).
async function currentDoctoriumAccess(doctorId: string): Promise<boolean> {
  const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true } });
  return hasDoctoriumAccess(d ?? { diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null });
}

// GET /api/doctor/documents — kendi belgelerinin meta listesi (içerik DÖNMEZ).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const doctorId = await myDoctorId(user.id);
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  const docs = await db.doctorDocument.findMany({
    where: { doctorId },
    // v6.119: status + verifiedSource istemciye ÇIKAR — doktor belgesinin hangi hâlde olduğunu
    // (doğrulandı / incelemede / yetersiz) görmeli. verifyCode ÇIKMAZ (şifreli, gösterilmez).
    select: {
      id: true, type: true, label: true, mimeType: true, createdAt: true,
      status: true, verifiedSource: true, reviewNote: true,
    },
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
  // (belgeler doktor-onay incelemesinde admin/doctors/[id]/documents/[docId]/raw ucundan inline
  // açılır [Faz 1, 2026-08-14] → depolanmış-XSS yüzeyi; bu kapı o sunumun ön şartıdır).
  const kind = detectDocumentKind(content);
  if (!kind) return NextResponse.json({ error: DOC_REJECT_MESSAGE }, { status: 415 });
  const mimeType = kind.mime;

  // Tekil belgeler (diploma + MMSS): tek geçerli kopya → yeni yükleme eskisini değiştirir.
  if (type === "DIPLOMA" || type === "MMSS") {
    const old = await db.doctorDocument.findMany({ where: { doctorId, type }, select: { content: true } });
    await Promise.all(old.map((o) => deleteDocument(o.content))); // eski Blob nesnelerini temizle (T11)
    await db.doctorDocument.deleteMany({ where: { doctorId, type } });
  }

  // ── e-Devlet barkodlu belge otomatik doğrulaması (v6.119 offline + v6.120 çevrimiçi teyit) ────
  // ⚠️ Şifrelenmiş/depolanmış hâlden ÖNCE ham `content` üzerinden çalışır (metin katmanı gerekiyor).
  // Katman 1 (offline, dış istek YOK): tür + program + barkod + ad — lib/edevlet-belge.ts.
  // Katman 2 (çevrimiçi, DORMANT — EDEVLET_VERIFY_ENABLED): offline geçtiyse barkod+TC devletin
  //   doğrulama akışına sorulur ve DEVLETİN DÖNDÜRDÜĞÜ ASIL değerlendirilir (lib/edevlet-dogrula.ts;
  //   ⚖️ hukuki zemin o dosyanın başlığında). Nihai kabul = onayKarari matrisi (birim testli).
  // Fail-closed: şüphede kapı KAPALI → belge PENDING kalır, /admin/doktor-onay incelemesine düşer.
  let dogrulama: EdevletSonuc | null = null;
  let cevrim: EdevletDogrulamaSonucu | null = null;
  if (OTOMATIK_DOGRULANAN.has(type)) {
    const prof = await db.doctor.findUnique({ where: { id: doctorId }, select: { name: true } });
    // 🔴 Beklenen TÜR açıkça verilir: diploma yerine başka bir belge (ör. ikametgah) yüklenmesi
    // otomatik geçemesin. Tür eşleşmezse sonuç ok:false → belge insan incelemesine düşer.
    // (v6.143: bu uçtan yalnız DIPLOMA geçer — "OGRENCI" dalı STUDENT_CERT'le birlikte kalktı.)
    const beklenen = "MEZUNIYET" as const;
    const metin = await pdfMetniOku(content);
    const belge = metin ? parseEdevletBelge(metin) : null;
    dogrulama = belge
      ? degerlendir(belge, prof?.name ?? null, beklenen)
      : { ok: false, tanindi: false, barcode: null, reason: "PDF metin katmanı okunamadı (görsel/taranmış belge)" };
    if (dogrulama.ok && belge) {
      // 🔒 belge.tckn YALNIZ bu çağrıda tüketilir — DB'ye/log'a/audit'e girmez (KVKK minimizasyonu).
      // Env kapalıyken edevletDogrula ağa dokunmadan KAPALI döner (masrafsız). TC belgede okunamadıysa
      // istemci BELIRSIZ döner → teyit açıkken kapı açılmaz (fail-closed, onayKarari).
      cevrim = await edevletDogrula(belge.barcode ?? "", belge.tckn ?? "", prof?.name ?? null, beklenen);
    }
  }
  // Nihai otomatik kabul kararı (saf matris — tests/unit/edevlet-belge.test.ts).
  const kabul = onayKarari(dogrulama?.ok ?? false, cevrim?.durum ?? null);

  // KVKK minimizasyonu (2026-08-30): otomatik doğrulama ANINDA geçtiyse belge dosyası HİÇ
  // depolanmaz — kolona doğrudan imha sentinel'i yazılır (lib/doc-purge kuralı). Karar +
  // şifreli barkod (verifyCode) kalır; belge e-Devlet'ten her an yeniden doğrulanabilir.
  // Geçmeyen belge incelemeci için saklanır (PENDING) — imhası inceleme kararına bağlı.
  const stored = kabul ? purgedRef() : await storeDocument(content, { keyPrefix: "doctor-doc" }); // object storage / inline şifreli (T11)
  const doc = await db.doctorDocument.create({
    data: {
      doctorId, type, label, mimeType, content: stored as string,
      // Barkod okunduysa geçmese bile saklanır — incelemeciye ipucudur. At-rest şifreli.
      verifyCode: dogrulama?.barcode ? encryptField(dogrulama.barcode) : null,
      // `kabul` = offline × çevrimiçi matrisi (onayKarari). Offline geçse bile çevrimiçi teyit
      // GECERSIZ/BELIRSIZ dediyse belge PENDING kalır → insan incelemesi.
      ...(kabul ? { status: "ACCEPTED", verifiedSource: "EDEVLET", verifiedAt: new Date() } : {}),
    },
  });

  // Denetim izi: otomatik doğrulama bir ERİŞİM KARARIDIR, zincire düşmeli.
  // ⚠️ `reason` TC/PHI içermez (birim testle kilitli) — ham belge metni ASLA loglanmaz.
  if (dogrulama) {
    await recordAccess({
      actor: user, action: "DOCTOR_DOC_AUTOVERIFY", resourceType: "DOCTOR", resourceId: doctorId,
      subjectUserId: user.id,
      // `tanindi=EVET sonuc=GECMEDI` = belge doğru türde ama ad tutmuyor → en şüpheli hâl, zincirde
      // ayrıca görünür olmalı (incelemeci ve denetim bunu arar).
      // `cevrimici`: devlet teyidinin sonucu (yoksa "-"). GECERSIZ = devlet iddiayı desteklemedi —
      // zincirde en ağır sinyal. Her iki `reason` da TC/PHI içermez (birim testle kilitli).
      detail: `belge=${type} sonuc=${kabul ? "GECTI" : "GECMEDI"} offline=${dogrulama.ok ? "OK" : "RET"} tanindi=${dogrulama.tanindi ? "EVET" : "HAYIR"} cevrimici=${cevrim?.durum ?? "-"} neden=${cevrim && cevrim.durum !== "KAPALI" ? cevrim.reason : dogrulama.reason}`,
      ...reqMeta(req),
    });
  }

  // İmha izi (2026-08-30): dosyanın depolanMAdığı da zincire düşer — "neyin ne zaman silindiği"
  // sorusu kalıcı kayıttan yanıtlanır (dosya içeriği/PHI audit'e girmez). depolama=HIC = anında yol.
  if (kabul) {
    await recordAccess({
      actor: user, action: "DOCTOR_DOC_PURGE", resourceType: "DOCTOR", resourceId: doctorId,
      subjectUserId: user.id, detail: `belge=${type} docId=${doc.id} neden=DOGRULAMA_ONAYI depolama=HIC`,
      ...reqMeta(req),
    });
  }

  // Kapılar ayrı damgalanır (v6.124): activated = Aşama 2 (klinik) · doctorium = Aşama 1
  // (DOĞRULANMIŞ diploma ∨ öğrenci — v6.143: öğrenci tarafı artık bu uçtan hiç etkilenmez).
  const activated = await refreshActivation(doctorId);
  const doctorium = await currentDoctoriumAccess(doctorId);

  // Zorunlu belge otomatik doğrulanıp hesap AÇILDIYSA müjdele (insan onayı beklemedi).
  if (type === "DIPLOMA" && kabul && activated) {
    await notifyUser(user.id, {
      type: "DOCTOR_ACTIVATED",
      title: "✅ Hesabınız aktifleşti",
      body: "e-Devlet barkodlu belgeniz doğrulandı — klinik panelleriniz açıldı.",
      href: "/doktor",
    });
  }

  // base64 yükü yanıtta geri gönderme — yalnız meta + güncel kapı durumları
  return NextResponse.json(
    {
      id: doc.id, type: doc.type, label: doc.label, mimeType: doc.mimeType,
      status: doc.status, verifiedSource: doc.verifiedSource, activated, doctorium,
      // İstemci "otomatik geçti mi, neden geçmedi" mesajını gösterir (PHI içermez).
      // Çevrimiçi teyit koştuysa onun gerekçesi esastır (devletin cevabı > yerel okuma).
      edevlet: dogrulama
        ? { ok: kabul, reason: cevrim && cevrim.durum !== "KAPALI" ? cevrim.reason : dogrulama.reason }
        : null,
    },
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
  const activated = await refreshActivation(doctorId); // DIPLOMA silindiyse diplomaVerifiedAt+activatedAt düşer
  const doctorium = await currentDoctoriumAccess(doctorId); // v6.143: STUDENT_CERT yok artık — yalnız diploma tarafı değişebilir
  return NextResponse.json({ ok: true, activated, doctorium });
}
