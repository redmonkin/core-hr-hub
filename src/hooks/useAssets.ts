import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface Asset {
  id: string;
  name: string;
  type: "laptop" | "monitor" | "phone" | "accessory";
  serialNumber: string;
  purchaseDate: string;
  cost: number;
  status: "available" | "assigned" | "maintenance" | "retired";
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select(`
          id,
          name,
          category,
          serial_number,
          purchase_date,
          purchase_cost,
          status
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get current assignments
      const { data: assignments } = await supabase
        .from("asset_assignments")
        .select(`
          asset_id,
          employee:employees(first_name, last_name, avatar_url)
        `)
        .is("returned_date", null);

      type EmployeeAssignment = {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      };

      const assignmentMap = new Map<string, EmployeeAssignment | null>(
        (assignments || []).map((a) => [a.asset_id, a.employee as EmployeeAssignment | null])
      );

      return (data || []).map((asset): Asset => {
        const assignedEmployee = assignmentMap.get(asset.id);
        return {
          id: asset.id,
          name: asset.name,
          type: asset.category.toLowerCase() as Asset["type"],
          serialNumber: asset.serial_number || "",
          purchaseDate: asset.purchase_date
            ? format(new Date(asset.purchase_date), "MMM d, yyyy")
            : "Unknown",
          cost: Number(asset.purchase_cost) || 0,
          status: asset.status as Asset["status"],
          assignedTo: assignedEmployee
            ? {
                name: `${assignedEmployee.first_name} ${assignedEmployee.last_name}`,
                avatar: assignedEmployee.avatar_url || undefined,
              }
            : undefined,
        };
      });
    },
  });
}

export function useAssetStats() {
  return useQuery({
    queryKey: ["asset-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, category, status");

      if (error) throw error;

      const total = data?.length || 0;
      const laptops = data?.filter((a) => a.category.toLowerCase() === "laptop").length || 0;
      const monitors = data?.filter((a) => a.category.toLowerCase() === "monitor").length || 0;
      const phones = data?.filter((a) => a.category.toLowerCase() === "phone").length || 0;

      return { total, laptops, monitors, phones };
    },
  });
}

export interface CreateAssetData {
  name: string;
  category: string;
  serial_number?: string;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  warranty_end_date?: string;
  notes?: string;
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAssetData) => {
      // Generate asset code
      const prefix = data.category.substring(0, 3).toUpperCase();
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
      const asset_code = `${prefix}-${randomNum}`;

      const { error } = await supabase.from("assets").insert({
        ...data,
        asset_code,
        status: "available",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}
