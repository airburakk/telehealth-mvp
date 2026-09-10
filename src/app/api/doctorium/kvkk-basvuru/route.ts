import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { reqMeta } from "@/lib/audit";
import { submitKvkkApplication } from "@/lib/kvkk-applications";

// KVKK m.11 başvuru formu (06-veri-sahibi-basvuru-usul-esaslari.md madde A.2) — yalnız oturum açmış
// üyeye açık; kimlik doğrulaması OTURUMdur (KVKK ikincil düzenlemesinin öngördüğü "sistemde kayıtlı
// e-posta/oturum" yolu). /doctorium/kvkk-basvuru sayfasındaki KvkkApplicationForm bu ucu çağırır.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Bu formu kullanmak için giriş yapmalısınız." }, { status: 401 });

  const rl = await rateLimit(`kvkk-basvuru:${user.id}`, 5, 60 * 60_000); // 5/saat/kullanıcı — spam freni
  if (!rl.ok) return tooMany(rl.retryAfter);

  const b = await req.json().catch(() => ({}));
  try {
    const { ip, userAgent } = reqMeta(req);
    const app = await submitKvkkApplication(user, String(b.requestType ?? ""), String(b.message ?? ""), ip, userAgent);
    return NextResponse.json({ ok: true, id: app.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Başvuru gönderilemedi." }, { status: 400 });
  }
}
