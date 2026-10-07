import { describe, expect, it } from "vitest";
import { DOCTOR_BRANCH_OPTIONS, isDoctorBranch } from "../../src/lib/doctor-branches";
import { BRANCH_LABELS, branchKeyFromLabel, getBranchProcedures } from "../../src/lib/procedures";
import { BRANCHES, PATIENT_BRANCHES } from "../../src/lib/triage";

const added=["Acil Tıp","Radyoloji","Anesteziyoloji ve Reanimasyon","Tıbbi Patoloji","Tıbbi Genetik"];
describe("physician and student branch taxonomy",()=>{
  it.each(added)("offers and accepts %s without changing its slug",label=>{
    expect(DOCTOR_BRANCH_OPTIONS).toContain(label);expect(isDoctorBranch(label)).toBe(true);
    expect(BRANCHES.find(b=>b.label===label)?.key).toBeTruthy();
  });
  it("keeps all previous choices and adds only the five missing branches",()=>{
    const prior=Object.values(BRANCH_LABELS);
    for(const label of prior) expect(DOCTOR_BRANCH_OPTIONS).toContain(label);
    expect(DOCTOR_BRANCH_OPTIONS.filter(label=>!prior.includes(label)).sort()).toEqual([...added].sort());
    expect(new Set(DOCTOR_BRANCH_OPTIONS).size).toBe(DOCTOR_BRANCH_OPTIONS.length);
  });
  it("keeps historical labels accepted and mapped to their existing slug",()=>{
    expect(isDoctorBranch("Estetik Cerrahi")).toBe(true);
    expect(branchKeyFromLabel("Estetik Cerrahi")).toBe("estetik");
    expect(branchKeyFromLabel("Kardiyoloji")).toBe("kardiyoloji");
  });
  it.each(["","unknown branch","radyoloji","__proto__","<script>"])("rejects non-label input %s",label=>{
    expect(isDoctorBranch(label)).toBe(false);
  });
  it("keeps doctor-only specialities out of patient choices and procedure prices",()=>{
    for(const label of added){
      const branch=BRANCHES.find(b=>b.label===label)!;
      expect(branch.doctorOnly).toBe(true);expect(branch.keywords).toEqual([]);
      expect(PATIENT_BRANCHES.some(b=>b.key===branch.key)).toBe(false);
      expect(BRANCH_LABELS[branch.key]).toBeUndefined();expect(getBranchProcedures(branch.key)).toEqual([]);
    }
  });
});
