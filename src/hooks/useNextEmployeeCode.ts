import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "ACQ";

/**
 * Extract the numeric part from an employee code like ACQ001 → 1
 */
const extractNumber = (code: string): number => {
  const match = code.match(/^ACQ(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Format a number as padded employee code: 1 → ACQ001
 */
export const formatEmployeeCode = (num: number): string => {
  return `${PREFIX}${String(num).padStart(3, "0")}`;
};

/**
 * Hook to get the next available employee code in ACQ001 format
 */
export function useNextEmployeeCode() {
  return useQuery({
    queryKey: ["next-employee-code"],
    queryFn: async () => {
      // Fetch all employee codes that match the ACQ pattern
      const { data, error } = await supabase
        .from("employees")
        .select("employee_code")
        .ilike("employee_code", "ACQ%");

      if (error) throw error;

      // Find the highest number
      let maxNumber = 0;
      for (const emp of data || []) {
        const num = extractNumber(emp.employee_code);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }

      // Next code is max + 1
      return formatEmployeeCode(maxNumber + 1);
    },
  });
}

/**
 * Validate that an employee code is in the correct format
 */
export const isValidEmployeeCode = (code: string): boolean => {
  return /^ACQ\d{3,}$/i.test(code);
};
