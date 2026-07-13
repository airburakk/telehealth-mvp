// MASTER API kapısı — YALNIZ route handler'lar (app/api/master/*) import eder. NextResponse (next/server)
// burada izole edilir; saf env yardımcıları lib/master.ts'te (server component'ler oradan import eder ki
// next/server bir server component'e sızmasın → prod runtime hatası). Bkz. [[master-account-impersonation]].
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { isMasterEnabled, isMasterEmail } from "./master";
import type { SessionUser } from "./session";

type Ok = { user: SessionUser; error: null };
type Err = { user: null; error: NextResponse };

// Yalnız (bürünmemiş) master geçer. Enabled değilse 404 (özelliğin varlığını sızdırmamak için);
// oturum yoksa 401; master değilse / bürünme oturumundaysa 403.
export async function requireMaster(): Promise<Ok | Err> {
  if (!isMasterEnabled()) {
    return { user: null, error: NextResponse.json({ error: "Bulunamadı." }, { status: 404 }) };
  }
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) };
  if (user.imp || !isMasterEmail(user.email)) {
    return { user: null, error: NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 }) };
  }
  return { user, error: null };
}
