import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({role:"DOCTOR",stored:'{"practice":{"setting":"diger"},"ilac":{"d":"180"}}',find:vi.fn(),lock:vi.fn(),update:vi.fn(),userUpdate:vi.fn(),transaction:vi.fn()}));
vi.mock("@/lib/auth",()=>({getCurrentUser:async()=>({id:"user",role:m.role})}));
vi.mock("@/lib/db",()=>({db:{user:{findUnique:async()=>({doctorId:"doctor"})},$transaction:m.transaction}}));
vi.mock("@/lib/crypto",()=>({encryptField:(v:string)=>v}));
vi.mock("@/lib/doctor-signup",()=>({DOCTOR_TITLES:["Dr."]}));
vi.mock("@/lib/doctor-branches",()=>({isDoctorBranch:(b:string)=>b==="Kardiyoloji"}));
vi.mock("@/lib/cities",()=>({isAllowedCity:(c:string)=>c==="Ankara"}));
import {POST} from "@/app/api/doctor/complete-profile/route";
const body={name:"Fixture Doktor",title:"Dr.",branch:"Kardiyoloji",city:"Ankara"};
const post=(extra:object={})=>POST(new Request("https://example.test/api/doctor/complete-profile",{method:"POST",body:JSON.stringify({...body,...extra})}));
beforeEach(()=>{vi.clearAllMocks();m.role="DOCTOR";m.find.mockImplementation(async()=>({doctoriumViewPrefs:m.stored}));m.transaction.mockImplementation(fn=>fn({$queryRaw:m.lock,doctor:{findUnique:m.find,update:m.update},user:{update:m.userUpdate}}));});
describe("OAuth completion work setting",()=>{
 it("does not touch any stored preference when omitted",async()=>{
  expect((await post()).status).toBe(200);expect(m.update.mock.calls[0][0].data).not.toHaveProperty("doctoriumViewPrefs");expect(m.lock).not.toHaveBeenCalled();
 });
 it.each(["asm",null])("merges only explicitly submitted setting %s under the same row lock",async practiceSetting=>{
  expect((await post({practiceSetting})).status).toBe(200);
  expect(JSON.parse(m.update.mock.calls[0][0].data.doctoriumViewPrefs)).toEqual({practice:{setting:practiceSetting},ilac:{d:"180"}});
  expect(m.lock).toHaveBeenCalledTimes(1);expect(m.lock.mock.calls[0][1]).toBe("doctor");
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("digestChannel");expect(m.update.mock.calls[0][0].data).not.toHaveProperty("newsBranches");
 });
 it.each(["", "invalid", [], true])("rejects invalid choice before writes %s",async practiceSetting=>{expect((await post({practiceSetting})).status).toBe(400);expect(m.transaction).not.toHaveBeenCalled();});
 it("retains authentication requirement",async()=>{m.role="PATIENT";expect((await post({practiceSetting:"asm"})).status).toBe(401);expect(m.transaction).not.toHaveBeenCalled();});
});
