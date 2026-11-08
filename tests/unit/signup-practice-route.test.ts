import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({ find:vi.fn(), create:vi.fn(), verify:vi.fn(), hash:vi.fn() }));
vi.mock("@/lib/db",()=>({db:{user:{findUnique:m.find}}}));
vi.mock("@/lib/auth",()=>({hashPassword:m.hash,createSession:vi.fn()}));
vi.mock("@/lib/doctor-signup",()=>({createDoctorAccount:m.create}));
vi.mock("@/lib/doctorium-consent",()=>({gateConsentVersion:vi.fn()}));
vi.mock("@/lib/doctor-branches",()=>({isDoctorBranch:(b:string)=>b==="Kardiyoloji"}));
vi.mock("@/lib/cities",()=>({isAllowedCity:(c:string)=>c==="Ankara"}));
vi.mock("@/lib/email",()=>({isEmailConfigured:()=>true}));
vi.mock("@/lib/signup-email-gate",()=>({signupEmailBlocked:()=>null}));
vi.mock("@/lib/email-verification",()=>({issueVerificationEmail:m.verify}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:async()=>({ok:true}),clientIp:()=>"fixture",tooMany:vi.fn()}));
import {POST} from "@/app/api/auth/signup/route";
const body={name:"Fixture Doktor",email:"fixture@example.test",password:"fixture-password",title:"Dr.",branch:"Kardiyoloji",city:"Ankara"};
const post=(extra:object)=>POST(new Request("https://example.test/api/auth/signup",{method:"POST",body:JSON.stringify({...body,...extra})}));
beforeEach(()=>{vi.clearAllMocks();m.find.mockResolvedValue(null);m.hash.mockResolvedValue("hashed");m.create.mockResolvedValue({id:"user",email:body.email,name:body.name});});
describe("classic doctor signup practice choice",()=>{
 it.each(["asm","egitim-arastirma","diger",null,undefined])("accepts optional setting %s",async practiceSetting=>{
  expect((await post({practiceSetting})).status).toBe(200);
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({practiceSetting,branch:"Kardiyoloji"}));
 });
 it.each(["", "invalid", [], {}, true])("rejects invalid setting %s",async practiceSetting=>{
  expect((await post({practiceSetting})).status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(m.verify).not.toHaveBeenCalled();
 });
});
