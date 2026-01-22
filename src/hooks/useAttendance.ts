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
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_location_name: string | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_out_location_name: string | null;
  work_mode: 'wfh' | 'wfo' | null;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

export type WorkMode = 'wfh' | 'wfo';

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
      return (data || []) as unknown as AttendanceRecord[];
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
      return data as unknown as AttendanceRecord | null;
    },
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ employeeId, location, workMode }: { employeeId: string; location?: LocationData; workMode?: WorkMode }) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("attendance_records")
        .insert({
          employee_id: employeeId,
          date: today,
          clock_in: now,
          status: "present",
          clock_in_latitude: location?.latitude,
          clock_in_longitude: location?.longitude,
          clock_in_location_name: location?.locationName,
          work_mode: workMode,
        } as any)
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
    mutationFn: async ({ recordId, clockIn, location }: { recordId: string; clockIn: string; location?: LocationData }) => {
      const now = new Date();
      const clockInTime = new Date(clockIn);
      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      const { data, error } = await supabase
        .from("attendance_records")
        .update({
          clock_out: now.toISOString(),
          total_hours: Math.round(totalHours * 100) / 100,
          clock_out_latitude: location?.latitude,
          clock_out_longitude: location?.longitude,
          clock_out_location_name: location?.locationName,
        } as any)
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
        empData.records.push(record as unknown as AttendanceRecord);
        empData.totalDays++;
        empData.totalHours += record.total_hours || 0;
        if (record.status === "present") empData.presentDays++;
        if (record.status === "late") empData.lateDays++;
      });

      return Array.from(employeeMap.values());
    },
  });
}
