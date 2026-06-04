import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/session";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "E-posta veya parola hatalı." }, { status: 401 });
  }

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role });
  return NextResponse.json({ ok: true, role: user.role, home: roleHome(user.role as Role) });
}
