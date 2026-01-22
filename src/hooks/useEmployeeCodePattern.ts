import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeCodePattern {
  prefix: string;
  min_digits: number;
  separator: string;
}

const DEFAULT_PATTERN: EmployeeCodePattern = {
  prefix: "ACQ",
  min_digits: 3,
  separator: "",
};

interface SystemSettingRow {
  id: string;
  setting_key: string;
  setting_value: EmployeeCodePattern;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook to fetch the employee code pattern from system settings
 */
export function useEmployeeCodePattern() {
  return useQuery({
    queryKey: ["employee-code-pattern"],
    queryFn: async (): Promise<EmployeeCodePattern> => {
      // Use raw SQL query since the table isn't in generated types
      const { data, error } = await supabase
        .from("system_settings" as "profiles") // Type cast to bypass type check
        .select("setting_value")
        .eq("setting_key" as "id", "employee_code_pattern")
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const row = data as unknown as { setting_value: EmployeeCodePattern };
        return row.setting_value;
      }
      
      return DEFAULT_PATTERN;
    },
  });
}

/**
 * Hook to update the employee code pattern
 */
export function useUpdateEmployeeCodePattern() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pattern: EmployeeCodePattern) => {
      const { error } = await supabase
        .from("system_settings" as "profiles") // Type cast to bypass type check
        .update({ setting_value: pattern } as Record<string, unknown>)
        .eq("setting_key" as "id", "employee_code_pattern");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-code-pattern"] });
      queryClient.invalidateQueries({ queryKey: ["next-employee-code"] });
    },
  });
}

/**
 * Format employee code based on pattern
 */
export const formatEmployeeCodeWithPattern = (
  num: number,
  pattern: EmployeeCodePattern
): string => {
  const paddedNum = String(num).padStart(pattern.min_digits, "0");
  return `${pattern.prefix}${pattern.separator}${paddedNum}`;
};

/**
 * Create regex pattern for validation based on settings
 */
export const createValidationRegex = (pattern: EmployeeCodePattern): RegExp => {
  const escapedPrefix = pattern.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSeparator = pattern.separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedPrefix}${escapedSeparator}\\d{${pattern.min_digits},}$`, "i");
};

/**
 * Validate employee code against pattern
 */
export const isValidEmployeeCodeWithPattern = (
  code: string,
  pattern: EmployeeCodePattern
): boolean => {
  const regex = createValidationRegex(pattern);
  return regex.test(code);
};
