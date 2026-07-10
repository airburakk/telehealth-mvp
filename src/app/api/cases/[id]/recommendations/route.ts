import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { isValidCode, floorPrice, ceilPrice, getByCodes } from "@/lib/procedures";
import { notifyRoles } from "@/lib/notify";

const STAFF = ["DOCTOR", "COORDINATOR", "ADMIN"];

// POST /api/cases/:id/recommendations — tedavi kararı kaydı (FAZ 2'de genişledi, 2026-07-10).
// body: { treatments: [{code, priceTRY}], treatmentDaysMin?, treatmentDaysMax?,
//         hospitalRegistryId?, hospitalName?, sendToAgency? }
// Doktorun seçtiği işlem+ücret listesine ek olarak öngörülen tedavi süresi (gün aralığı) ve
// hastane seçimi kaydedilir; sendToAgency=true ise dosya Sağlık Turizmi Acentesine (AGENCY)
// iletilir (agencySentAt damgası + rol bildirimi — isim gömülmez, E2EE inc.2c).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !STAFF.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // BOLA düzeltmesi: rol tek başına yetmez — doktor yalnız kendisine atanmış/kuyruk vakasına tavsiye yazabilir.
  if (!(await canCaseBeAccessedBy(user, c))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const raw = Array.isArray(b?.treatments) ? b.treatments : [];

  const codes: string[] = [];
  const priceByCode: Record<string, number> = {};
  for (const t of raw) {
    const code = String(t?.code ?? "");
    if (!isValidCode(code) || code in priceByCode) continue;
    const floor = floorPrice(code);
    let price = Math.round(Number(t?.priceTRY));
    if (!Number.isFinite(price) || price < 0) price = floor ?? 0;
    if (floor != null && floor > 0) price = Math.min(ceilPrice(floor), Math.max(floor, price));
    priceByCode[code] = price;
    codes.push(code);
    if (codes.length >= 200) break;
  }

  // İsimleri katalogdan çöz, ₺ fiyatı doktorun belirlediği değer
  const items = getByCodes(codes).map((p) => ({ code: p.code, name: p.name, priceTRY: priceByCode[p.code] }));

  // Öngörülen tedavi süresi (gün aralığı, ör. 3–7). 1-365 clamp; min>max ise takas.
  const clampDay = (v: unknown): number | null => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 1 ? Math.min(365, n) : null;
  };
  let daysMin = clampDay(b.treatmentDaysMin);
  let daysMax = clampDay(b.treatmentDaysMax);
  if (daysMin != null && daysMax != null && daysMin > daysMax) [daysMin, daysMax] = [daysMax, daysMin];

  // Hastane seçimi (RegistryHospital gevşek bağ + ad snapshot'ı; registry boşsa serbest metin ad gelebilir)
  const hospId = Number.isFinite(Number(b.hospitalRegistryId)) && Number(b.hospitalRegistryId) > 0
    ? Math.round(Number(b.hospitalRegistryId)) : null;
  const hospName = String(b.hospitalName ?? "").trim().slice(0, 300) || null;

  const sendToAgency = b.sendToAgency === true;

  await db.case.update({
    where: { id: c.id },
    data: {
      recommendedProcedures: items.length ? JSON.stringify(items) : null,
      treatmentDaysMin: daysMin,
      treatmentDaysMax: daysMax,
      hospitalRegistryId: hospId,
      hospitalName: hospName,
      // İlk iletim damgası korunur (tekrar kaydet güncelleme sayılır, kuyruk sırası değişmez)
      ...(sendToAgency && !c.agencySentAt ? { agencySentAt: new Date() } : {}),
    },
  });

  // Doktor fiyat hafızası: kararda belirlenen fiyatlar Doctor.procedures'a merge edilir —
  // onboarding artık ücret toplamadığından "sizin fiyatınız" önerisi buradan beslenir.
  if (user.role === "DOCTOR" && codes.length) {
    try {
      const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      if (dbUser?.doctorId) {
        const doc = await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { procedures: true } });
        let mem: Record<string, number> = {};
        try { mem = doc?.procedures ? JSON.parse(doc.procedures) : {}; } catch { mem = {}; }
        for (const code of codes) mem[code] = priceByCode[code];
        await db.doctor.update({ where: { id: dbUser.doctorId }, data: { procedures: JSON.stringify(mem) } });
      }
    } catch { /* hafıza güncellenemezse karar kaydı bozulmaz (fire-safe) */ }
  }

  if (sendToAgency) {
    // STA'ya rol bildirimi — hasta adı/klinik detay gömülmez; acente dosyayı kendi kuyruğunda açar.
    await notifyRoles(["AGENCY"], {
      type: "AGENCY_FILE",
      title: "🧳 Yeni tedavi dosyası",
      body: `${c.branch} · ${items.length} işlem${daysMin != null && daysMax != null ? ` · ${daysMin}–${daysMax} gün` : ""} — teklif hazırlanması bekleniyor`,
      href: `/acente/dosya/${c.id}`,
    });
  }

  return NextResponse.json({ ok: true, count: items.length, sentToAgency: sendToAgency ? true : undefined });
}
