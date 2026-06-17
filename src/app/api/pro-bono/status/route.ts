import { NextResponse } from "next/server";
import { availableDoctorCount } from "@/lib/pro-bono";

// Canlı DB sayımı döndürür → ASLA statik cache'lenmemeli (yoksa hep build-anı değeri 0 döner).
export const dynamic = "force-dynamic";

// GET /api/pro-bono/status — pro bono hizmetinin canlı durumu (public; hasta "Başvur" butonu + indikatörü için).
// Auth gerektirmez: yalnız müsait gönüllü hekim SAYISINI döner (hassas veri yok).
export async function GET() {
  const online = await availableDoctorCount();
  return NextResponse.json({ online });
}
