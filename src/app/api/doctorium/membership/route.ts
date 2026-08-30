// POST /api/doctorium/membership — Doctorium üyeliğini kapat (hesap dahil) veya üyelikten çık.
// body: { intent: "close" | "leave", confirm: "KAPAT" | "ÇIK" }
//
// İKİ YOL, TEK UÇ — hangisinin geçerli olduğunu SUNUCU belirler (lib/doctorium-membership):
//   · close → yalnız Doctorium üyeliği olan hesap (Aşama 1 doktoru / tıp öğrencisi): hesap + üyelik
//     verisi O ANDA silinir. Onay kuyruğu ve bekleme süresi yoktur — Doctorium'da saklanması gereken
//     klinik kayıt bulunmadığı için bekletmenin dayanağı da yok.
//   · leave → AURA klinik hesabı da olan (Aşama 2) doktor: hesap KAPANMAZ, yalnız Doctorium katmanı
//     silinir ve erişim kapanır.
//
// 🔴 FAIL-CLOSED: istemci "close" dese bile klinik bağ ölçülür; bağ varsa istek 409 ile REDDEDİLİR
// (sessizce "leave"e çevrilmez — kullanıcı hangi işlemi onayladığını bilerek onaylamalı, arayüz de
// zaten bu durumda "üyelikten çık" varyantını çizer).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { destroySession } from "@/lib/auth";
import { reqMeta } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  closeDoctoriumAccount,
  countClinicalTies,
  hasClinicalTies,
  leaveDoctorium,
} from "@/lib/doctorium-membership";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;

  // Yıkıcı + geri dönüşsüz → dar limit (kaza/otomasyon tekrarı).
  const limited = await rateLimit(`doctorium-membership:${user.id}`, 3, 60 * 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok fazla deneme. Lütfen sonra tekrar deneyin." }, { status: 429 });
  }

  if (user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Bu uç yalnız Doctorium üyeleri içindir." }, { status: 403 });
  }
  // Bürünme (master) ile kapatma YASAK — geri dönüşsüz işlemi kullanıcı adına başkası tetikleyemez.
  if (user.imp) {
    return NextResponse.json({ error: "Bürünme oturumunda üyelik kapatılamaz." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const intent = b?.intent === "leave" ? "leave" : b?.intent === "close" ? "close" : null;
  if (!intent) {
    return NextResponse.json({ error: 'Geçersiz istek: intent "close" veya "leave" olmalı.' }, { status: 400 });
  }

  const expected = intent === "close" ? "KAPAT" : "ÇIK";
  if (String(b?.confirm ?? "").trim().toLocaleUpperCase("tr-TR") !== expected) {
    return NextResponse.json({ error: `Onaylamak için "${expected}" yazın.` }, { status: 400 });
  }

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Bu hesaba bağlı bir Doctorium üyeliği yok." }, { status: 400 });
  }

  const meta = reqMeta(req);

  if (intent === "leave") {
    const counts = await leaveDoctorium(user, me.doctorId, meta.ip, meta.userAgent);
    return NextResponse.json({ ok: true, mode: "leave", counts });
  }

  // intent === "close": klinik bağ korkuluğu ÖNCE ölçülür ki kullanıcıya doğru gerekçe dönsün.
  const ties = await countClinicalTies(me.doctorId);
  if (hasClinicalTies(ties)) {
    return NextResponse.json(
      {
        error:
          "Bu hesap AURA klinik hizmetinde de kullanılıyor; buradan hesap kapatılamaz. Yalnız Doctorium üyeliğinizi sonlandırabilirsiniz.",
        code: "CLINICAL_TIES",
      },
      { status: 409 },
    );
  }

  const r = await closeDoctoriumAccount(user, meta.ip, meta.userAgent);
  if (!r.ok) {
    // Yarış: ölçüm ile silme arasında bağ oluşmuş olabilir (fail-closed davranış aynı).
    return NextResponse.json(
      { error: "Üyelik kapatılamadı. Lütfen sayfayı yenileyip tekrar deneyin.", code: r.reason },
      { status: 409 },
    );
  }

  // Hesap gitti → bu cihazın çerezi de silinir (aksi halde token silinmiş kullanıcıyı gösterirdi;
  // getCurrentUser zaten reddederdi ama kullanıcıyı boş bir kabukta gezdirmenin anlamı yok).
  await destroySession();
  return NextResponse.json({ ok: true, mode: "close", counts: r.counts });
}
