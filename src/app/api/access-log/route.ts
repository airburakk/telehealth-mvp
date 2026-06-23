import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAccessLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET /api/access-log — giriş yapan kullanıcının KENDİ verisine yapılan erişimlerin denetim kaydı
// ("verime kim, ne zaman, neye erişti") + giriş-başına bütünlük/zaman-damgası doğrulaması.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const entries = await getAccessLog(user.id, user.id);
  return NextResponse.json({ subjectUserId: user.id, count: entries.length, entries });
}
