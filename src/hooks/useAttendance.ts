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
  employee?: {
    first_name: string;
    last_name: string;
    employee_code: string;
    working_hours_start: string | null;
    working_hours_end: string | null;
  };
}

export interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

export type WorkMode = 'wfh' | 'wfo';

export function useAttendance(month?: Date, employeeId?: string) {
  const targetMonth = month || new Date();
  const start = format(startOfMonth(targetMonth), "yyyy-MM-dd");
  const end = format(endOfMonth(targetMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance", start, end, employeeId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("attendance_records")
        .select(`
          *,
          employee:employees(first_name, last_name, employee_code, working_hours_start, working_hours_end)
        `)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as AttendanceRecord[];
    },
    enabled: employeeId === undefined ? true : !!employeeId,
  });
}

export function useTodayAttendance(employeeId?: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance-today", today, employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      
      // First check today's record
      const { data: todayData, error: todayError } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("date", today)
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (todayError) throw todayError;
      if (todayData) return todayData as unknown as AttendanceRecord | null;

      // If no today record, check for yesterday's unclosed record (cross-midnight shifts)
      const { data: yesterdayData, error: yesterdayError } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("date", yesterday)
        .eq("employee_id", employeeId)
        .is("clock_out", null)
        .maybeSingle();

      if (yesterdayError) throw yesterdayError;
      return yesterdayData as unknown as AttendanceRecord | null;
    },
    enabled: !!employeeId,
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
    mutationFn: async ({ recordId, clockIn, location, customClockOut }: { recordId: string; clockIn: string; location?: LocationData; customClockOut?: Date }) => {
      const clockOutTime = customClockOut || new Date();
      const clockInTime = new Date(clockIn);
      const grossHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // Auto-resume any open break before clocking out
      const { data: openBreak } = await supabase
        .from("attendance_breaks" as any)
        .select("id")
        .eq("attendance_record_id", recordId)
        .is("resume_time", null)
        .maybeSingle();

      if (openBreak) {
        await supabase
          .from("attendance_breaks" as any)
          .update({ resume_time: clockOutTime.toISOString() } as any)
          .eq("id", (openBreak as any).id);
      }

      // Calculate total break duration
      const { data: breaks } = await supabase
        .from("attendance_breaks" as any)
        .select("pause_time, resume_time")
        .eq("attendance_record_id", recordId);

      let breakHours = 0;
      if (breaks) {
        breakHours = (breaks as any[]).reduce((total: number, b: any) => {
          const resumeMs = b.resume_time ? new Date(b.resume_time).getTime() : clockOutTime.getTime();
          const pauseMs = new Date(b.pause_time).getTime();
          return total + (resumeMs - pauseMs) / (1000 * 60 * 60);
        }, 0);
      }

      const totalHours = Math.max(0, grossHours - breakHours);

      const { data, error } = await supabase
        .from("attendance_records")
        .update({
          clock_out: clockOutTime.toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-breaks"] });
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
          employee:employees(first_name, last_name, employee_code, department:departments!employees_department_id_fkey(name))
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
        wfoDays: number;
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
            wfoDays: 0,
          });
        }

        const empData = employeeMap.get(key)!;
        empData.records.push(record as unknown as AttendanceRecord);
        empData.totalDays++;
        empData.totalHours += record.total_hours || 0;
        if (record.status === "present") empData.presentDays++;
        if (record.status === "late") empData.lateDays++;
        if (record.work_mode === "wfo") empData.wfoDays++;
      });

      return Array.from(employeeMap.values());
    },
  });
}
