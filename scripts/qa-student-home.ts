// Local HTTP smoke test, not a browser/layout test. Synthetic data only; never production.
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL ||
      !process.env.PROD_DB_FINGERPRINT || process.env.TEST_DATABASE_URL.includes(process.env.PROD_DB_FINGERPRINT)) {
    throw Error("Explicit isolated TEST_DATABASE_URL and production fingerprint required");
  }
  process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
  process.env.TSA_SECRET = randomBytes(48).toString("base64url");
  process.env.DATA_ENCRYPTION_KEK = randomBytes(32).toString("base64");
  process.env.STUDENT_CLUB_EVENTS_ENABLED = "true";
  const { signToken } = await import("../src/lib/session");
  const { CONSENT_VERSION } = await import("../src/lib/consent-config");
  const db = new PrismaClient();
  const run = "student-home-http-" + Date.now();
  const origin = "http://127.0.0.1:3122";
  const now = new Date(), today = now.toISOString().slice(0, 10);
  let doctorId: string | undefined, otherDoctorId: string | undefined, userId: string | undefined;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3122"], {
    env: { ...process.env, NODE_ENV: "production" }, windowsHide: true, stdio: "ignore",
  });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { await fetch(origin, { signal: AbortSignal.timeout(1000) }); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    assert.ok(ready, "Local server became ready");
    const doctor = await db.doctor.create({ data: { name: "Synthetic Student Home", title: "Student", branch: "Kardiyoloji", city: "Test", languages: "Turkish", studentVerifiedAt: now } });
    doctorId = doctor.id;
    const other = await db.doctor.create({ data: { name: "Other Synthetic Student", title: "Student", branch: "Kardiyoloji", city: "Test", languages: "Turkish", studentVerifiedAt: now } });
    otherDoctorId = other.id;
    const user = await db.user.create({ data: { email: run + "@itest.local", passwordHash: "no-login-synthetic-test", name: "Synthetic Student Home", role: "DOCTOR", doctorId } });
    userId = user.id;
    await db.calendarEntry.createMany({ data: [
      { doctorId, kind: "KISISEL", title: run + "-OWN", startAt: new Date(today + "T00:00:00Z") },
      { doctorId: otherDoctorId, kind: "KISISEL", title: run + "-OTHER", startAt: new Date(today + "T00:00:00Z") },
    ] });
    await db.studentClubEvent.createMany({ data: Array.from({ length: 4 }, (_, i) => ({
      id: run + "-" + i, sourceUrl: "https://sks.ogu.edu.tr/Etkinlik/Detay/999999999/" + run + "-" + i,
      title: run + "-CLUB-" + i, organizer: "Synthetic medical club " + i, venue: "Test Hall", city: "Test",
      startDay: today, endDay: today, evidenceHash: "synthetic", checkedAt: now,
    })) });
    const token = await signToken({ id: user.id, email: user.email, name: user.name, role: "DOCTOR", cv: CONSENT_VERSION, sv: 0 });
    const get = async (path: string, auth = true) => {
      const response = await fetch(origin + path, { headers: auth ? { Cookie: "session=" + token } : {}, redirect: "manual", signal: AbortSignal.timeout(30000) });
      return { status: response.status, html: await response.text() };
    };
    const home = await get("/doktor/doctorium");
    assert.equal(home.status, 200);
    assert.ok(home.html.includes('id="student-home-heading"'));
    assert.ok(home.html.includes("Öğrenci gündemin"));
    for (const href of ["/doktor/doctorium/tus", "/doktor/doctorium?m=kariyer&amp;tur=hepsi", "/doktor/doctorium/kaydettiklerim", "/doktor/doctorium/takvim"]) assert.ok(home.html.includes(href), "Existing student destination present");
    assert.ok(home.html.includes(run + "-OWN"), "Own calendar date visible");
    assert.ok(!home.html.includes(run + "-OTHER"), "Other account's calendar stays private");
    assert.ok(!home.html.includes('href="/doktor/doctorium/aile-hekimligi"'));
    const preview = home.html.match(/<section aria-labelledby="student-club-heading"[\s\S]*?<\/section>/)?.[0];
    assert.ok(preview, "Enabled club preview visible");
    assert.equal((preview.match(/<li /g) || []).length, 3);
    const events = await get("/doktor/doctorium?m=etkinlik");
    assert.equal(events.status, 200);
    assert.ok(events.html.includes(run + "-CLUB-3"), "Full events module retains fourth entry");
    assert.ok(!events.html.includes('id="student-home-heading"'));
    const career = await get("/doktor/doctorium?m=kariyer");
    assert.equal(career.status, 200);
    assert.ok(!career.html.includes('id="student-club-heading"'));
    await db.doctor.update({ where: { id: doctorId }, data: { diplomaVerifiedAt: now } });
    const doctorHome = await get("/doktor/doctorium");
    assert.equal(doctorHome.status, 200);
    assert.ok(!doctorHome.html.includes('id="student-home-heading"'));
    assert.ok(!doctorHome.html.includes('id="student-club-heading"'));
    assert.ok(doctorHome.html.includes('href="/doktor/doctorium/aile-hekimligi"'));
    const anonymous = await get("/doktor/doctorium", false);
    assert.ok([302, 303, 307, 308].includes(anonymous.status));
    assert.ok(!anonymous.html.includes('id="student-home-heading"'));
    console.log("PASS: authenticated Student HTTP rendering, four destinations, own-calendar isolation, three-event preview, full events, career separation, doctor and anonymous guards.");
  } finally {
    server.kill();
    await db.studentClubEvent.deleteMany({ where: { id: { startsWith: run } } });
    if (doctorId || otherDoctorId) await db.calendarEntry.deleteMany({ where: { doctorId: { in: [doctorId, otherDoctorId].filter((id): id is string => Boolean(id)) } } });
    if (userId) await db.user.delete({ where: { id: userId } });
    if (doctorId) await db.doctor.delete({ where: { id: doctorId } });
    if (otherDoctorId) await db.doctor.delete({ where: { id: otherDoctorId } });
    await db.$disconnect();
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "student-home-http-test-failed"); process.exitCode = 1; });
