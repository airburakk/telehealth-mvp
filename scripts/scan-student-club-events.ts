// Read-only discovery: no database, student identities, email, approval or publication writes.
import { scanStudentClubEvents } from "../src/lib/student-club-events";
scanStudentClubEvents().then(result => {
  console.log(JSON.stringify(result, null, 2));
  if (!result.complete) process.exitCode = 2;
}).catch(() => { console.error("student-scan-failed"); process.exitCode = 1; });
