import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({find:vi.fn(),create:vi.fn(),doctorUpdate:vi.fn(),userUpdate:vi.fn(),transaction:vi.fn(),mail:vi.fn(),verify:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{user:{findUnique:m.find,update:m.userUpdate,updateMany:m.userUpdate},doctor:{update:m.doctorUpdate},$transaction:m.transaction}}));
vi.mock("@/lib/auth",()=>({hashPassword:async()=>"fixture-hash",createSession:vi.fn(),getCurrentUser:async()=>({id:"fixture",role:"DOCTOR"})}));
vi.mock("@/lib/doctor-signup",()=>({createDoctorAccount:m.create,DOCTOR_TITLES:["Dr.","Uzm. Dr."],studentTitleFor:()=>"Tıp Öğr."}));
vi.mock("@/lib/crypto",()=>({encryptField:(s:string)=>s}));
vi.mock("@/lib/doctorium-consent",()=>({gateConsentVersion:async()=>0}));
vi.mock("@/lib/signup-email-gate",()=>({signupEmailBlocked:()=>null}));
vi.mock("@/lib/email",()=>({isEmailConfigured:()=>true,sendEmail:m.mail}));
vi.mock("@/lib/email-verification",()=>({issueVerificationEmail:m.verify,hashVerifyToken:()=>"fixture-token-hash"}));
vi.mock("@/lib/doctorium-trial-flag",()=>({isTrialEnabled:()=>true}));
vi.mock("@/lib/login-link",()=>({loginLinkChannelReady:()=>true,loginLinkCooldownActive:()=>false,canUseLoginLink:()=>false,issueLoginLinkEmail:vi.fn(),issueExistingAccountEmail:vi.fn()}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:async()=>({ok:true}),clientIp:()=>"fixture",tooMany:()=>new Response(null,{status:429})}));
import { POST as doctor } from "@/app/api/auth/signup/route";
import { POST as trial } from "@/app/api/auth/signup-trial/route";
import { POST as student } from "@/app/api/auth/signup-student/route";
import { POST as profile } from "@/app/api/doctor/complete-profile/route";
const branches=["Acil Tıp","Radyoloji","Anesteziyoloji ve Reanimasyon","Tıbbi Patoloji","Tıbbi Genetik"];
const routes=[{name:"doctor",handler:doctor},{name:"trial",handler:trial},{name:"student",handler:student},{name:"profile",handler:profile}];
const body={name:"Fixture",email:"fixture@hacettepe.edu.tr",password:"fixture-password",title:"Dr.",city:"Ankara",department:"tip",university:"Hacettepe Üniversitesi",birthDate:"2000-01-01"};
beforeEach(()=>{
  vi.clearAllMocks();m.find.mockImplementation(async({where}:{where:{id?:string}})=>where.id?{doctorId:"fixture-doctor"}:null);
  m.create.mockResolvedValue({id:"new-fixture",doctorId:"fixture-doctor",name:body.name,email:body.email});
  m.transaction.mockImplementation(async(fn:(tx:unknown)=>Promise<unknown>)=>fn({doctor:{update:m.doctorUpdate},user:{update:m.userUpdate}}));
});
for(const route of routes) describe(`${route.name} branch contract`,()=>{
  const post=(branch:string)=>route.handler(new Request("http://localhost/api/fixture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,branch})}));
  it.each(branches)("accepts %s and retains the label",async branch=>{
    expect((await post(branch)).status).toBe(200);
    if(route.name==="profile") expect(m.doctorUpdate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({branch})}));
    else expect(m.create).toHaveBeenCalledWith(expect.objectContaining({branch}));
    if(route.name==="student") expect(m.create).toHaveBeenCalledWith(expect.objectContaining({studentTrack:true,studentDepartment:"tip",title:"Tıp Öğr."}));
  });
  it("rejects an unknown branch before creating or updating anything",async()=>{
    expect((await post("Invented Speciality")).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled();expect(m.doctorUpdate).not.toHaveBeenCalled();expect(m.verify).not.toHaveBeenCalled();
  });
  it("accepts the historical aesthetic label without renaming stored input",async()=>{
    expect((await post("Estetik Cerrahi")).status).toBe(200);
    if(route.name==="profile") expect(m.doctorUpdate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({branch:"Estetik Cerrahi"})}));
    else expect(m.create).toHaveBeenCalledWith(expect.objectContaining({branch:"Estetik Cerrahi"}));
  });
});
