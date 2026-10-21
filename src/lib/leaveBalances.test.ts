import { describe, expect, it } from "vitest";
import { buildLeaveBalanceRecords, formatBalanceCell, usedShare } from "./leaveBalances";

const leaveTypes = [
  { id: "annual", days_per_year: 12 },
  { id: "unpaid", days_per_year: 0 },
];
const employees = [
  { id: "e1", employee_code: "A1", first_name: "Asha", last_name: "Rao", department: "Ops" },
  { id: "e2", employee_code: "A2", first_name: "Ravi", last_name: "K", department: "Ops" },
];
const requests = [
  { employee_id: "e1", leave_type_id: "annual", days_count: 3, status: "approved" },
  { employee_id: "e1", leave_type_id: "annual", days_count: 1.5, status: "approved" },
  { employee_id: "e1", leave_type_id: "annual", days_count: 2, status: "pending" },
  { employee_id: "e1", leave_type_id: "unpaid", days_count: 2, status: "approved" },
];

describe("leave balance report", () => {
  it("adds up used and pending days per type", () => {
    const [asha] = buildLeaveBalanceRecords({ leaveTypes, employees, requests, eligibility: [] });
    expect(asha.balances[0]).toMatchObject({ eligible: true, total: 12, used: 4.5, pending: 2, remaining: 7.5 });
    expect(formatBalanceCell(asha.balances[0])).toBe("4.5 / 12");
    expect(usedShare(asha.balances[0])).toBeCloseTo(0.375);
  });

  it("shows uncapped types as days taken", () => {
    const [asha] = buildLeaveBalanceRecords({ leaveTypes, employees, requests, eligibility: [] });
    expect(formatBalanceCell(asha.balances[1])).toBe("2 taken");
    expect(usedShare(asha.balances[1])).toBe(0);
  });

  it("treats everyone as eligible until eligibility is set up", () => {
    const records = buildLeaveBalanceRecords({ leaveTypes, employees, requests, eligibility: [] });
    expect(records.every((r) => r.balances.every((b) => b.eligible))).toBe(true);
  });

  it("follows eligibility once it's set up", () => {
    const [, ravi] = buildLeaveBalanceRecords({
      leaveTypes,
      employees,
      requests,
      eligibility: [{ employee_id: "e2", leave_type_id: "annual" }],
    });
    expect(ravi.balances[0].eligible).toBe(true);
    expect(ravi.balances[1].eligible).toBe(false);
    expect(formatBalanceCell(ravi.balances[1])).toBe("—");
  });
});
