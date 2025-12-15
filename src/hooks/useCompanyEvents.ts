import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  event_type: string;
  is_holiday: boolean;
  is_recurring: boolean;
  created_at: string;
}

export function useCompanyEvents(month?: Date) {
  const targetMonth = month || new Date();
  const start = format(startOfMonth(targetMonth), "yyyy-MM-dd");
  const end = format(endOfMonth(targetMonth), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["company-events", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_events")
        .select("*")
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as CompanyEvent[];
    },
  });
}

export function useAllCompanyEvents() {
  return useQuery({
    queryKey: ["company-events-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as CompanyEvent[];
    },
  });
}

export function useCreateCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: {
      title: string;
      description?: string;
      event_date: string;
      end_date?: string;
      event_type: string;
      is_holiday: boolean;
    }) => {
      const { data, error } = await supabase
        .from("company_events")
        .insert(event)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-events"] });
      queryClient.invalidateQueries({ queryKey: ["company-events-all"] });
    },
  });
}

export function useUpdateCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...event
    }: {
      id: string;
      title: string;
      description?: string;
      event_date: string;
      end_date?: string;
      event_type: string;
      is_holiday: boolean;
    }) => {
      const { data, error } = await supabase
        .from("company_events")
        .update(event)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-events"] });
      queryClient.invalidateQueries({ queryKey: ["company-events-all"] });
    },
  });
}

export function useDeleteCompanyEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("company_events")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-events"] });
      queryClient.invalidateQueries({ queryKey: ["company-events-all"] });
    },
  });
}
