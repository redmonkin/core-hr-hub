import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyHoliday {
  id: string;
  title: string;
  event_date: string;
}

export function useCompanyHolidays() {
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: ["company-holidays", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_events")
        .select("id, title, event_date")
        .eq("is_holiday", true)
        .gte("event_date", `${currentYear}-01-01`)
        .lte("event_date", `${currentYear}-12-31`)
        .order("event_date");

      if (error) throw error;
      return (data || []) as CompanyHoliday[];
    },
  });
}
