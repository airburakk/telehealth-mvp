import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isValidCode, floorPrice, ceilPrice, getByCodes } from "@/lib/procedures";

const STAFF = ["DOCTOR", "COORDINATOR", "ADMIN"];

// POST /api/cases/:id/recommendations
// Doktorun M2 görüşmesinde tavsiye ettiği tedaviler — body: { treatments: [{code, priceTRY}] }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !STAFF.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

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

  await db.case.update({
    where: { id: c.id },
    data: { recommendedProcedures: items.length ? JSON.stringify(items) : null },
  });

  return NextResponse.json({ ok: true, count: items.length });
}
