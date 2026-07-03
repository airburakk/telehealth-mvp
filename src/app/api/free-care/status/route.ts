import { NextResponse } from "next/server";
import { availableDoctorCount } from "@/lib/free-care";

// Canlı DB sayımı döndürür → ASLA statik cache'lenmemeli (yoksa hep build-anı değeri 0 döner).
export const dynamic = "force-dynamic";

// GET /api/free-care/status — ücretsiz sağlık hizmeti hizmetinin canlı durumu (public; hasta "Başvur" butonu + indikatörü için).
// Auth gerektirmez: yalnız müsait gönüllü doktor SAYISINI döner (hassas veri yok).
export async function GET() {
  const online = await availableDoctorCount();
  return NextResponse.json({ online });
}
