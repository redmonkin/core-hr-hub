import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useEmployeeCodePattern,
  formatEmployeeCodeWithPattern,
  isValidEmployeeCodeWithPattern,
  EmployeeCodePattern,
} from "./useEmployeeCodePattern";

const DEFAULT_PATTERN: EmployeeCodePattern = {
  prefix: "ACQ",
  min_digits: 3,
  separator: "",
};

/**
 * Extract the numeric part from an employee code based on pattern
 */
const extractNumber = (code: string, pattern: EmployeeCodePattern): number => {
  const escapedPrefix = pattern.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSeparator = pattern.separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedPrefix}${escapedSeparator}(\\d+)$`, "i");
  const match = code.match(regex);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Format a number as padded employee code (legacy function for backwards compatibility)
 */
export const formatEmployeeCode = (num: number): string => {
  return formatEmployeeCodeWithPattern(num, DEFAULT_PATTERN);
};

/**
 * Hook to get the next available employee code based on pattern settings
 */
export function useNextEmployeeCode() {
  const { data: pattern = DEFAULT_PATTERN } = useEmployeeCodePattern();
  
  return useQuery({
    queryKey: ["next-employee-code", pattern],
    queryFn: async () => {
      // Fetch all employee codes that start with the current prefix
      const { data, error } = await supabase
        .from("employees")
        .select("employee_code")
        .ilike("employee_code", `${pattern.prefix}${pattern.separator}%`);

      if (error) throw error;

      // Find the highest number
      let maxNumber = 0;
      for (const emp of data || []) {
        const num = extractNumber(emp.employee_code, pattern);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }

      // Next code is max + 1
      return formatEmployeeCodeWithPattern(maxNumber + 1, pattern);
    },
  });
}

/**
 * Validate that an employee code is in the correct format (legacy function)
 * This now uses the default pattern for backwards compatibility
 * For dynamic validation, use isValidEmployeeCodeWithPattern from useEmployeeCodePattern
 */
export const isValidEmployeeCode = (code: string): boolean => {
  // Accept both the default ACQ pattern and any pattern with prefix + digits
  return /^[A-Z]{2,10}[-_]?\d{1,}$/i.test(code);
};
