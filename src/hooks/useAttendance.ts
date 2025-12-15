import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
  notes: string | null;
}

export function useAttendance(month?: Date) {
  const targetMonth = month || new Date();
  const start = format(startOfMonth(targetMonth), "yyyy-MM-dd");
  const end = format(endOfMonth(targetMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });
}

export function useTodayAttendance() {
  const today = format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("date", today)
        .maybeSingle();

      if (error) throw error;
      return data as AttendanceRecord | null;
    },
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("attendance_records")
        .insert({
          employee_id: employeeId,
          date: today,
          clock_in: now,
          status: "present",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recordId, clockIn }: { recordId: string; clockIn: string }) => {
      const now = new Date();
      const clockInTime = new Date(clockIn);
      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      const { data, error } = await supabase
        .from("attendance_records")
        .update({
          clock_out: now.toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
        })
        .eq("id", recordId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    },
  });
}

export function useAttendanceReport(month: Date) {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(endOfMonth(month), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance-report", start, end],
    queryFn: async () => {
      const { data: records, error } = await supabase
        .from("attendance_records")
        .select(`
          *,
          employee:employees(first_name, last_name, employee_code, department:departments(name))
        `)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (error) throw error;

      // Group by employee
      const employeeMap = new Map<string, {
        employeeId: string;
        employeeName: string;
        employeeCode: string;
        department: string;
        records: AttendanceRecord[];
        totalDays: number;
        totalHours: number;
        presentDays: number;
        lateDays: number;
      }>();

      records?.forEach((record) => {
        const emp = record.employee as { first_name: string; last_name: string; employee_code: string; department: { name: string } | null } | null;
        if (!emp) return;

        const key = record.employee_id;
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            employeeId: record.employee_id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            employeeCode: emp.employee_code,
            department: emp.department?.name || "-",
            records: [],
            totalDays: 0,
            totalHours: 0,
            presentDays: 0,
            lateDays: 0,
          });
        }

        const empData = employeeMap.get(key)!;
        empData.records.push(record);
        empData.totalDays++;
        empData.totalHours += record.total_hours || 0;
        if (record.status === "present") empData.presentDays++;
        if (record.status === "late") empData.lateDays++;
      });

      return Array.from(employeeMap.values());
    },
  });
}
