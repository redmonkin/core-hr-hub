import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LocationData } from "@/hooks/useAttendance";

export interface AttendanceBreak {
  id: string;
  attendance_record_id: string;
  pause_time: string;
  resume_time: string | null;
  pause_latitude: number | null;
  pause_longitude: number | null;
  pause_location_name: string | null;
  resume_latitude: number | null;
  resume_longitude: number | null;
  resume_location_name: string | null;
  created_at: string;
}

export function useActiveBreak(attendanceRecordId?: string) {
  return useQuery({
    queryKey: ["active-break", attendanceRecordId],
    queryFn: async () => {
      if (!attendanceRecordId) return null;
      const { data, error } = await supabase
        .from("attendance_breaks")
        .select("*")
        .eq("attendance_record_id", attendanceRecordId)
        .is("resume_time", null)
        .maybeSingle();

      if (error) throw error;
      return data as AttendanceBreak | null;
    },
    enabled: !!attendanceRecordId,
  });
}

export function useBreaksForRecord(attendanceRecordId?: string) {
  return useQuery({
    queryKey: ["attendance-breaks", attendanceRecordId],
    queryFn: async () => {
      if (!attendanceRecordId) return [];
      const { data, error } = await supabase
        .from("attendance_breaks")
        .select("*")
        .eq("attendance_record_id", attendanceRecordId)
        .order("pause_time", { ascending: true });

      if (error) throw error;
      return (data || []) as AttendanceBreak[];
    },
    enabled: !!attendanceRecordId,
  });
}

export function usePause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attendanceRecordId,
      location,
    }: {
      attendanceRecordId: string;
      location?: LocationData;
    }) => {
      const { data, error } = await supabase
        .from("attendance_breaks")
        .insert({
          attendance_record_id: attendanceRecordId,
          pause_time: new Date().toISOString(),
          pause_latitude: location?.latitude,
          pause_longitude: location?.longitude,
          pause_location_name: location?.locationName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-breaks"] });
    },
  });
}

export function useResume() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      breakId,
      location,
    }: {
      breakId: string;
      location?: LocationData;
    }) => {
      const { data, error } = await supabase
        .from("attendance_breaks")
        .update({
          resume_time: new Date().toISOString(),
          resume_latitude: location?.latitude,
          resume_longitude: location?.longitude,
          resume_location_name: location?.locationName,
        })
        .eq("id", breakId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-breaks"] });
    },
  });
}

/** Calculate total break duration in hours for a set of breaks */
export function calculateTotalBreakHours(breaks: AttendanceBreak[]): number {
  return breaks.reduce((total, b) => {
    if (!b.resume_time) return total;
    const pauseMs = new Date(b.pause_time).getTime();
    const resumeMs = new Date(b.resume_time).getTime();
    return total + (resumeMs - pauseMs) / (1000 * 60 * 60);
  }, 0);
}
