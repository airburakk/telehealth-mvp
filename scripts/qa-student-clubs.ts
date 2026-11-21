// Local-only authenticated UI smoke test. Requires the dedicated TEST_DATABASE_URL and an already built app.
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw Error("Dedicated test database required");
  if (process.env.PROD_DB_FINGERPRINT && process.env.TEST_DATABASE_URL.includes(process.env.PROD_DB_FINGERPRINT)) throw Error("Production database rejected");
  const port = 3119;
  const origin = `http://127.0.0.1:${port}`;
  process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
  process.env.TSA_SECRET = randomBytes(48).toString("base64url");
  process.env.DATA_ENCRYPTION_KEK = randomBytes(32).toString("base64");
  process.env.STUDENT_CLUB_EVENTS_ENABLED = "true";
  const { signToken } = await import("../src/lib/session");
  const { CONSENT_VERSION } = await import("../src/lib/consent-config");
  const db = new PrismaClient();
  const run = `student-ui-${Date.now()}`;
  let doctorId: string | undefined;
  let userId: string | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, NODE_ENV: "production" }, windowsHide: true, stdio: "ignore",
  });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); ready = true; break; } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    if (!ready) throw Error("Local server did not become ready");
    const doctor = await db.doctor.create({ data: { name: "Synthetic Student UI", title: "Öğrenci", branch: "Kardiyoloji", city: "Eskişehir", languages: "Türkçe", studentVerifiedAt: new Date() } });
    doctorId = doctor.id;
    const user = await db.user.create({ data: { email: `${run}@itest.local`, passwordHash: "no-login-test-fixture", name: "Synthetic Student UI", role: "DOCTOR", doctorId } });
    userId = user.id;
    const now = new Date();
    const future = new Date(now.getTime() + 10 * 86400000).toISOString().slice(0, 10);
    await db.studentClubEvent.create({ data: { id: run, sourceUrl: `https://sks.ogu.edu.tr/Etkinlik/Detay/999999999/${run}`, title: "Sentetik UI Test Etkinliği", organizer: "Test Tıp Öğrencileri Kulübü", venue: "Test Üniversite Salonu", city: "Eskişehir", startDay: future, endDay: future, evidenceHash: "synthetic", checkedAt: now } });
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addCookies([{ name: "session", value: await signToken({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv: CONSENT_VERSION, sv: 0 }), url: origin, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    await page.goto(`${origin}/doktor/doctorium?m=etkinlik`);
    const section = page.locator('section[aria-labelledby="student-club-heading"]');
    await expect(section).toBeVisible({ timeout: 30000 });
    await expect(section).toContainText("Sentetik UI Test Etkinliği");
    await expect(section.getByRole("link", { name: /Resmî duyuruyu aç/ }).last()).toHaveAttribute("rel", "noopener noreferrer");
    mkdirSync(".aura-preview/student-clubs", { recursive: true });
    await section.screenshot({ path: ".aura-preview/student-clubs/desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(section).toBeVisible();
    if (await section.evaluate(el => el.scrollWidth > el.clientWidth + 1)) throw Error("Student section horizontal overflow");
    await section.screenshot({ path: ".aura-preview/student-clubs/mobile.png" });
    await page.goto(`${origin}/doktor/doctorium?m=kariyer`);
    await expect(page.locator('#student-club-heading')).toHaveCount(0);
    await page.goBack();
    await expect(section).toContainText("Sentetik UI Test Etkinliği");
    await db.studentClubEvent.update({ where: { id: run }, data: { status: "HIDDEN" } });
    await page.reload();
    await expect(section).not.toContainText("Sentetik UI Test Etkinliği");
    await db.doctor.update({ where: { id: doctorId }, data: { diplomaVerifiedAt: new Date() } });
    await page.reload();
    await expect(page.locator('#student-club-heading')).toHaveCount(0);
    const anon = await browser.newContext();
    const anonymousPage = await anon.newPage();
    await anonymousPage.goto(`${origin}/doktor/doctorium?m=etkinlik`);
    await expect(anonymousPage.locator('#student-club-heading')).toHaveCount(0);
    console.log("PASS: authenticated student desktop/mobile, link safety, navigation/back, withdrawn item, doctor and anonymous isolation");
  } finally {
    await browser?.close();
    server.kill();
    await db.studentClubEvent.deleteMany({ where: { id: run } });
    if (userId) await db.user.delete({ where: { id: userId } });
    if (doctorId) await db.doctor.delete({ where: { id: doctorId } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "student-ui-test-failed"); process.exitCode = 1; });

