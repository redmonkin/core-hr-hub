import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface AssetReportRecord {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyEndDate: string;
  vendor: string;
  assignedTo?: string;
}

export interface AssetReport {
  totalAssets: number;
  totalValue: number;
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  records: AssetReportRecord[];
}

export function useAssetReport() {
  return useQuery({
    queryKey: ["asset-report"],
    queryFn: async (): Promise<AssetReport> => {
      // Fetch all assets
      const { data: assets, error } = await supabase
        .from("assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch current assignments
      const { data: assignments } = await supabase
        .from("asset_assignments")
        .select(`
          asset_id,
          employee:employees(first_name, last_name)
        `)
        .is("returned_date", null);

      type EmployeeAssignment = {
        first_name: string;
        last_name: string;
      };

      const assignmentMap = new Map<string, string>(
        (assignments || []).map((a) => {
          const emp = a.employee as EmployeeAssignment | null;
          return [a.asset_id, emp ? `${emp.first_name} ${emp.last_name}` : ""];
        })
      );

      // Calculate stats
      const totalAssets = assets?.length || 0;
      const totalValue = assets?.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0) || 0;

      // Group by status
      const statusCounts = new Map<string, number>();
      assets?.forEach((a) => {
        const count = statusCounts.get(a.status) || 0;
        statusCounts.set(a.status, count + 1);
      });
      const byStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      // Group by category
      const categoryCounts = new Map<string, number>();
      assets?.forEach((a) => {
        const count = categoryCounts.get(a.category) || 0;
        categoryCounts.set(a.category, count + 1);
      });
      const byCategory = Array.from(categoryCounts.entries()).map(([category, count]) => ({
        category,
        count,
      }));

      // Map records
      const records: AssetReportRecord[] = (assets || []).map((asset) => ({
        id: asset.id,
        assetCode: asset.asset_code,
        name: asset.name,
        category: asset.category,
        serialNumber: asset.serial_number || "-",
        status: asset.status,
        purchaseDate: asset.purchase_date
          ? format(new Date(asset.purchase_date), "MMM d, yyyy")
          : "-",
        purchaseCost: Number(asset.purchase_cost) || 0,
        warrantyEndDate: asset.warranty_end_date
          ? format(new Date(asset.warranty_end_date), "MMM d, yyyy")
          : "-",
        vendor: asset.vendor || "-",
        assignedTo: assignmentMap.get(asset.id) || "-",
      }));

      return {
        totalAssets,
        totalValue,
        byStatus,
        byCategory,
        records,
      };
    },
  });
}
