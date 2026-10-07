import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  congressIds: new Set<string>(), edu: [] as object[], eduFollows: [] as {id:string;doctorId:string;opportunityId:string;sentAlerts:string}[],
  congress: [] as object[], congressFollows: [] as {id:string;doctorId:string;congressId:string;sentAlerts:string}[],
  users: [] as object[], prefs: [] as object[], notify: vi.fn(), email: vi.fn(), eduFind: vi.fn(), entriesFind: vi.fn(),
}));
vi.mock("@/lib/doctorium", () => ({followedCongressIds:async()=>m.congressIds}));
vi.mock("@/lib/tus", () => ({tusCalendarItems:()=>[{key:"tus-fixture",kind:"tus",title:"Synthetic TUS",start:"2030-06-23",end:"2030-06-23"}]}));
vi.mock("@/lib/notify",()=>({notifyUser:m.notify}));
vi.mock("@/lib/email",()=>({sendEmail:m.email}));
vi.mock("@/lib/db",()=>({db:{
  eduOpportunity:{findMany:m.eduFind}, calendarEntry:{findMany:m.entriesFind},
  medicalCongress:{findMany:async()=>m.congress}, user:{findMany:async()=>m.users},doctor:{findMany:async()=>m.prefs},
  eduOpportunityFollow:{findMany:async()=>m.eduFollows,update:async({where,data}:{where:{id:string};data:{sentAlerts:string}})=>{m.eduFollows.find(f=>f.id===where.id)!.sentAlerts=data.sentAlerts}},
  congressFollow:{findMany:async()=>m.congressFollows,update:async({where,data}:{where:{id:string};data:{sentAlerts:string}})=>{m.congressFollows.find(f=>f.id===where.id)!.sentAlerts=data.sentAlerts}},
}}));
import { dayKey, parseMonth, parseCalendarDay, monthWindow, doctorCalendarMonth } from "@/lib/calendar";
import { remindEduFollows, daysUntilUtc, dueEduAlert } from "@/lib/edu-reminder";
import { remindCongressFollows } from "@/lib/congress-reminder";
const D=(s:string)=>new Date(s+"T00:00:00Z");
beforeEach(()=>{vi.clearAllMocks();m.congressIds=new Set();m.edu=[];m.eduFollows=[];m.congress=[];m.congressFollows=[];m.users=[];m.prefs=[];m.eduFind.mockImplementation(async()=>m.edu);m.entriesFind.mockResolvedValue([]);m.notify.mockResolvedValue(undefined);m.email.mockResolvedValue({sent:true})});

describe("calendar day contract and scope",()=>{
  it("uses UTC boundaries including leap/year rollover",()=>{
    expect(monthWindow(2030,12)).toEqual({start:D("2030-12-01"),end:D("2031-01-01")});
    expect(dayKey(new Date("2030-06-01T01:00:00+03:00"))).toBe("2030-05-31");
    expect(parseMonth("0000-06").year).toBe(new Date().getUTCFullYear());
    expect(parseMonth("2030-13").month).toBe(new Date().getUTCMonth()+1);
    expect(parseCalendarDay("2028-02-29",2028,2)).toBe("2028-02-29");
    for(const day of ["2030-02-29","2030-02-31","2030-07-01",["2030-06-01"]])expect(parseCalendarDay(day,2030,6)).toBeNull();
  });
  it("student EDU scope queries all approved deadlines in a half-open month without follow restriction",async()=>{
    m.edu=[{id:"unfollowed",title:"Synthetic opportunity",deadline:D("2030-06-30")}];
    const items=await doctorCalendarMonth("student-own",2030,6,{includeEdu:true,includeTus:true});
    expect(items.map(i=>i.key)).toEqual(["tus-fixture","edu-unfollowed"]);
    expect(m.eduFind).toHaveBeenCalledWith({where:{approvedAt:{not:null},deadline:{gte:D("2030-06-01"),lt:D("2030-07-01")}},select:{id:true,title:true,deadline:true}});
    expect(m.entriesFind.mock.calls[0][0].where.doctorId).toBe("student-own");
  });
  it("physician default omits student opportunities and optional TUS",async()=>{
    expect(await doctorCalendarMonth("physician-own",2030,6)).toEqual([]);expect(m.eduFind).not.toHaveBeenCalled();
    expect((await doctorCalendarMonth("physician-own",2030,6,{includeTus:true}))[0].kind).toBe("tus");
  });
  it("followed event ranges/deadlines use the same UTC day keys across months",async()=>{
    m.congressIds=new Set(["event"]);m.congress=[{id:"event",title:"Synthetic event",startDate:D("2030-05-31"),endDate:D("2030-06-02"),abstractDeadline:D("2030-06-05"),earlyBirdDeadline:D("2030-07-01")}];
    const items=await doctorCalendarMonth("own",2030,6);expect(items.map(i=>i.kind)).toEqual(["etkinlik","bildiri"]);
    expect(items[0]).toMatchObject({start:"2030-05-31",end:"2030-06-02"});expect(items[1].start).toBe("2030-06-05");
  });
});
describe("reminder eligibility with mocked channels; never actual delivery",()=>{
  it("EDU sends only followed deadlines once per eligible 7/3/1 threshold and emails verified addresses",async()=>{
    m.edu=[{id:"opp",title:"Synthetic",organizer:"Fixture",deadline:D("2030-06-18"),sourceUrl:"https://example.test"}];
    m.eduFollows=[{id:"fa",doctorId:"a",opportunityId:"opp",sentAlerts:"[]"},{id:"fb",doctorId:"b",opportunityId:"opp",sentAlerts:"[]"}];
    m.users=[{id:"ua",doctorId:"a",name:"A",email:"a@example.test",emailVerifiedAt:D("2030-01-01")},{id:"ub",doctorId:"b",name:"B",email:"b@example.test",emailVerifiedAt:null}];
    expect(await remindEduFollows(D("2030-06-11"))).toMatchObject({sent:2,emailed:1});expect(m.notify.mock.calls.map(c=>c[0])).toEqual(["ua","ub"]);
    expect(await remindEduFollows(D("2030-06-11"))).toMatchObject({sent:0,emailed:0});
    expect(await remindEduFollows(D("2030-06-15"))).toMatchObject({sent:2,emailed:1});
    expect(await remindEduFollows(D("2030-06-17"))).toMatchObject({sent:2,emailed:1});
    expect(await remindEduFollows(D("2030-06-19"))).toMatchObject({sent:0});expect(m.email).toHaveBeenCalledTimes(3);
  });
  it("late EDU follows use remaining tight threshold; missing dates, past deadlines and no follows have no reminder",async()=>{
    expect(dueEduAlert(D("2030-06-13"),new Set(),D("2030-06-11"))).toMatchObject({key:"3",markKeys:["3","7"]});
    expect(daysUntilUtc(new Date("2030-06-12T01:00:00+03:00"),new Date("2030-06-11T23:00:00Z"))).toBe(0);
    expect(dueEduAlert(D("2030-06-10"),new Set(),D("2030-06-11"))).toBeNull();
    expect(await remindEduFollows(D("2030-06-11"))).toEqual({checked:0,sent:0,emailed:0,failed:0});expect(m.notify).not.toHaveBeenCalled();
  });
  it("congress has separate configured start/abstract/earlybird thresholds, disabled means no alert",async()=>{
    m.congress=[{id:"c",title:"Synthetic",startDate:D("2030-06-18"),abstractDeadline:D("2030-06-14"),earlyBirdDeadline:D("2030-06-12")}];m.congressFollows=[{id:"f",doctorId:"a",congressId:"c",sentAlerts:"[]"}];m.users=[{id:"ua",doctorId:"a"}];m.prefs=[{id:"a",congressAlertDays:7,congressAbstractAlertDays:3,congressEarlyBirdAlertDays:null}];
    expect(await remindCongressFollows(D("2030-06-11"))).toMatchObject({start:1,abstract:1,earlybird:0});
    expect(await remindCongressFollows(D("2030-06-11"))).toMatchObject({start:0,abstract:0,earlybird:0});expect(m.email).not.toHaveBeenCalled();
    expect(m.notify.mock.calls.every(c=>c[0]==="ua")).toBe(true);
  });
  it("mocked email channel failure is not promised as delivered",async()=>{
    m.edu=[{id:"o",title:"Synthetic",organizer:"Fixture",deadline:D("2030-06-18"),sourceUrl:"https://example.test"}];m.eduFollows=[{id:"f",doctorId:"a",opportunityId:"o",sentAlerts:"[]"}];m.users=[{id:"u",doctorId:"a",email:"a@example.test",name:"A",emailVerifiedAt:D("2030-01-01")}];m.email.mockResolvedValue({sent:false});
    expect(await remindEduFollows(D("2030-06-11"))).toMatchObject({sent:1,emailed:0});expect(m.eduFollows[0].sentAlerts).toBe('["7"]');
  });
});
