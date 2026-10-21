// Leave balance report: days used out of each allowance, per employee and type.

export interface LeaveBalanceCell {
  leaveTypeId: string;
  /** False when the employee isn't eligible for this leave type */
  eligible: boolean;
  /** Days allowed per year; 0 means uncapped (e.g. unpaid leave) */
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

export interface LeaveBalanceRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  balances: LeaveBalanceCell[];
}

export interface LeaveBalanceType {
  id: string;
  name: string;
  daysPerYear: number;
}

/** Share of the allowance used, 0..1 (0 for uncapped types). */
export function usedShare(cell: LeaveBalanceCell): number {
  if (!cell.eligible || cell.total <= 0) return 0;
  return Math.min(1, cell.used / cell.total);
}

/** "3 / 12" for capped types, "3 taken" for uncapped ones, "—" when not eligible. */
export function formatBalanceCell(cell: LeaveBalanceCell): string {
  if (!cell.eligible) return "—";
  if (cell.total <= 0) return `${cell.used} taken`;
  return `${cell.used} / ${cell.total}`;
}

export function buildLeaveBalanceRecords(input: {
  leaveTypes: { id: string; days_per_year: number }[];
  employees: { id: string; employee_code: string; first_name: string; last_name: string; department: string }[];
  requests: { employee_id: string; leave_type_id: string; days_count: number; status: string }[];
  eligibility: { employee_id: string; leave_type_id: string }[];
}): LeaveBalanceRecord[] {
  // Eligibility only applies once it has been set up for someone; until then
  // everyone counts as eligible for every type.
  const useEligibility = input.eligibility.length > 0;
  const eligible = new Set(input.eligibility.map((e) => `${e.employee_id}:${e.leave_type_id}`));
  const days = new Map<string, { used: number; pending: number }>();
  for (const r of input.requests) {
    const key = `${r.employee_id}:${r.leave_type_id}`;
    const entry = days.get(key) ?? { used: 0, pending: 0 };
    if (r.status === "approved") entry.used += Number(r.days_count) || 0;
    else if (r.status === "pending") entry.pending += Number(r.days_count) || 0;
    days.set(key, entry);
  }

  return input.employees.map((emp) => ({
    employeeId: emp.id,
    employeeCode: emp.employee_code,
    employeeName: `${emp.first_name} ${emp.last_name}`,
    department: emp.department,
    balances: input.leaveTypes.map((lt) => {
      const key = `${emp.id}:${lt.id}`;
      const { used, pending } = days.get(key) ?? { used: 0, pending: 0 };
      const total = lt.days_per_year;
      return {
        leaveTypeId: lt.id,
        eligible: !useEligibility || eligible.has(key),
        total,
        used,
        pending,
        remaining: total > 0 ? total - used : 0,
      };
    }),
  }));
}
