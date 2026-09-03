import { NextResponse } from "next/server";
import { getCurrentUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordConsent } from "@/lib/consent";
import { gateConsentVersion, recordDoctoriumConsent } from "@/lib/doctorium-consent";
import { refreshActivation } from "@/lib/doctor-activation";

export const dynamic = "force-dynamic";

// Onam kaydet + oturumu yeniden imzala (cv güncel) → kullanıcı bir daha sorulmaz.
//
// v6.211 (onam mimarisi A + C, 👤 03.09.2026) — gövde `kind`:
//   · (yok) / "general" → GENERAL_KVKK (hasta/personel; DOCTOR için KLİNİK onam = Aşama 2 ön koşulu →
//                         kayıt sonrası refreshActivation: belgeler tamsa activatedAt artık yazılır)
//   · "doctorium"       → Doctorium seti (DOCTORIUM_KVKK + DOCTORIUM_TERMS; yalnız DOCTOR)
//   · "resign"          → kayıt YAZMAZ; yalnız cv'yi DB'den yeniden hesaplar (eski JWT'yle gelen ama
//                         seti tam olan kullanıcı /onam'da döngüye girmesin — sayfa bunu tetikler)
// cv her hâlde gateConsentVersion'dan gelir: gerekli set tamsa CONSENT_VERSION, değilse 0 (kapı kapalı).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = typeof body?.kind === "string" ? body.kind : "general";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) || null;

  if (kind === "doctorium") {
    if (user.role !== "DOCTOR") return NextResponse.json({ error: "Doctorium onamı yalnız doktor/öğrenci hesapları içindir." }, { status: 400 });
    await recordDoctoriumConsent(user.id, ip, userAgent);
  } else if (kind !== "resign") {
    await recordConsent(user.id, ip, userAgent);
    if (user.role === "DOCTOR") {
      // Klinik onam verildi → aktivasyon şartı artık sağlanıyor olabilir (belgeler tamsa activatedAt yazılır).
      const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      if (me?.doctorId) await refreshActivation(me.doctorId);
    }
  }

  const cv = await gateConsentVersion(user.id, user.role);
  // preserveSv: sv'yi getCurrentUser'ın doğruladığı değerden koru (DB'den tekrar OKUMA) → eşzamanlı
  // logout-all ile TOCTOU iptal-kaçışını kapat (bkz. createSession yorumu). user.sv token'dan gelir.
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, cv, sv: user.sv }, { preserveSv: true });

  return NextResponse.json({ ok: true, cv });
}
