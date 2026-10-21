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
  repairSpend: number;
}

export interface AssetRepairRecord {
  id: string;
  assetName: string;
  assetCode: string;
  problem: string;
  vendor: string | null;
  sentDate: string;
  returnedDate: string | null;
  outcome: string | null;
  cost: number | null;
  /** Estimate while it's still out for repair */
  estimatedCost: number | null;
}

export interface AssetReport {
  totalAssets: number;
  totalValue: number;
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  records: AssetReportRecord[];
  repairs: AssetRepairRecord[];
  repairSpendTotal: number;
  repairSpendThisYear: number;
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

      const { data: repairRows, error: repairError } = await supabase
        .from("asset_repairs")
        .select("id, asset_id, problem, vendor, sent_date, returned_date, outcome, actual_cost, estimated_cost, asset:assets(name, asset_code)")
        .order("sent_date", { ascending: false });
      if (repairError) throw repairError;

      const thisYear = String(new Date().getFullYear());
      const spendByAsset = new Map<string, number>();
      let repairSpendTotal = 0;
      let repairSpendThisYear = 0;
      const repairs: AssetRepairRecord[] = (repairRows || []).map((r) => {
        const cost = r.actual_cost === null ? null : Number(r.actual_cost);
        if (cost) {
          repairSpendTotal += cost;
          // Counted in the year it came back
          if ((r.returned_date ?? "").startsWith(thisYear)) repairSpendThisYear += cost;
          spendByAsset.set(r.asset_id, (spendByAsset.get(r.asset_id) ?? 0) + cost);
        }
        const asset = r.asset as { name: string; asset_code: string } | null;
        return {
          id: r.id,
          assetName: asset?.name ?? "Asset",
          assetCode: asset?.asset_code ?? "",
          problem: r.problem,
          vendor: r.vendor,
          sentDate: r.sent_date,
          returnedDate: r.returned_date,
          outcome: r.outcome,
          cost,
          estimatedCost: r.estimated_cost === null ? null : Number(r.estimated_cost),
        };
      });

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
        repairSpend: spendByAsset.get(asset.id) ?? 0,
      }));

      return {
        totalAssets,
        totalValue,
        byStatus,
        byCategory,
        records,
        repairs,
        repairSpendTotal,
        repairSpendThisYear,
      };
    },
  });
}
