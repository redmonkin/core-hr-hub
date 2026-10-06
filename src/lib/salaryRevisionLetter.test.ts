import { describe, expect, it } from "vitest";
import { generateSalaryRevisionLetter } from "./salaryRevisionLetter";
import { toComponents } from "./salaryRevision";

const data = {
  employeeName: "Ananya Iyer",
  employeeFirstName: "Ananya",
  employeeCode: "RMK004",
  designation: "Senior Engineer",
  department: "Engineering",
  revisionType: "annual_appraisal",
  effectiveFrom: "2026-04-01",
  letterDate: "2026-10-06",
  previous: toComponents({ basic_salary: 120000, hra: 48000, tax_deduction: 9600, pf_deduction: 1800 }),
  revised: toComponents({ basic_salary: 134400, hra: 53760, tax_deduction: 9600, pf_deduction: 1800 }),
  companyName: "Redmonk",
};

describe("salary revision letter", () => {
  it("states the revision, the effective date and the old and new pay", () => {
    const doc = generateSalaryRevisionLetter(data);
    if (process.env.LETTER_OUT) doc.save(process.env.LETTER_OUT);
    const text = doc.output();
    expect(text).toContain("Salary Revision Letter");
    expect(text).toContain("following your annual appraisal");
    expect(text).toContain("1 April 2026");
    expect(text).toContain("Rs. 1,68,000.00");
    expect(text).toContain("Rs. 1,88,160.00");
    expect(text).toContain("+12.0%");
  });

  it("uses neutral wording when pay goes down", () => {
    const text = generateSalaryRevisionLetter({ ...data, revisionType: "adjustment", previous: data.revised, revised: data.previous }).output();
    expect(text).toContain("This is to confirm");
    expect(text).not.toContain("pleased");
  });
});
