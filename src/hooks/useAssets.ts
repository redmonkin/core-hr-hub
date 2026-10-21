import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

export const ASSET_TYPES = ["laptop", "desktop", "monitor", "phone", "tablet", "accessory", "other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** assets.category is free text in the DB; map anything we don't know to "other". */
export function normalizeAssetType(category: string | null | undefined): AssetType {
  const value = (category ?? "").trim().toLowerCase();
  return (ASSET_TYPES as readonly string[]).includes(value) ? (value as AssetType) : "other";
}

export const ASSET_STATUSES = ["available", "assigned", "in_repair", "damaged", "lost", "retired"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  in_repair: "In repair",
  damaged: "Damaged",
  lost: "Lost",
  retired: "Retired",
};

/** Badge tone for an asset status (statusStyles knows the common words). */
export function assetStatusTone(status: AssetStatus): string {
  return status === "in_repair" ? "maintenance" : status === "damaged" || status === "lost" ? "rejected" : status;
}

export const RETIRE_REASONS = [
  { value: "end_of_life", label: "End of life" },
  { value: "beyond_repair", label: "Beyond repair" },
  { value: "lost", label: "Lost and not recovered" },
  { value: "sold", label: "Sold" },
  { value: "donated", label: "Donated" },
  { value: "other", label: "Other" },
] as const;

export const ISSUE_KINDS = [
  { value: "damage", label: "It's damaged" },
  { value: "not_working", label: "It's not working properly" },
  { value: "lost", label: "I've lost it" },
  { value: "other", label: "Something else" },
] as const;

export const issueKindLabel = (kind: string) =>
  ({ damage: "Damaged", not_working: "Not working", lost: "Lost", other: "Other" })[kind] ?? kind;

export interface OpenRepair {
  id: string;
  problem: string;
  vendor: string | null;
  sentDate: string;
  expectedReturn: string | null;
  estimatedCost: number | null;
}

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  type: AssetType;
  /** Raw category as stored, so editing an unknown category doesn't silently rename it. */
  category: string;
  serialNumber: string;
  /** Display date ("MMM d, yyyy") or "Unknown". */
  purchaseDate: string;
  /** ISO date (yyyy-MM-dd) as stored, or "" when not set. */
  purchaseDateRaw: string;
  vendor: string;
  cost: number;
  status: AssetStatus;
  notes?: string;
  /** yyyy-MM-dd or "" */
  warrantyEnd: string;
  retiredAt: string | null;
  retireReason: string | null;
  /** Total actual cost of finished repairs */
  repairSpend: number;
  /** Finished repairs */
  repairCount: number;
  openRepair: OpenRepair | null;
  openIssues: number;
  assignedTo?: {
    employeeId: string;
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
          asset_code,
          name,
          category,
          warranty_end_date,
          retired_at,
          retire_reason,
          serial_number,
          purchase_date,
          purchase_cost,
          vendor,
          status,
          notes
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Current assignments, repairs and open problem reports
      const [{ data: assignments }, { data: repairs }, { data: issues }] = await Promise.all([
        supabase
          .from("asset_assignments")
          .select("asset_id, employee_id, employee:employees(first_name, last_name, avatar_url)")
          .is("returned_date", null),
        supabase
          .from("asset_repairs")
          .select("id, asset_id, problem, vendor, sent_date, expected_return, estimated_cost, actual_cost, returned_date"),
        supabase.from("asset_issues").select("asset_id").in("status", ["open", "in_repair"]),
      ]);

      type EmployeeAssignment = {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      };

      const assignmentMap = new Map(
        (assignments || []).map((a) => [a.asset_id, { employeeId: a.employee_id, employee: a.employee as EmployeeAssignment | null }])
      );
      const repairMap = new Map<string, { spend: number; count: number; open: OpenRepair | null }>();
      for (const r of repairs || []) {
        const entry = repairMap.get(r.asset_id) ?? { spend: 0, count: 0, open: null };
        if (r.returned_date) {
          entry.count += 1;
          entry.spend += Number(r.actual_cost) || 0;
        } else {
          entry.open = {
            id: r.id,
            problem: r.problem,
            vendor: r.vendor,
            sentDate: r.sent_date,
            expectedReturn: r.expected_return,
            estimatedCost: r.estimated_cost === null ? null : Number(r.estimated_cost),
          };
        }
        repairMap.set(r.asset_id, entry);
      }
      const issueCount = new Map<string, number>();
      for (const i of issues || []) issueCount.set(i.asset_id, (issueCount.get(i.asset_id) ?? 0) + 1);

      return (data || []).map((asset): Asset => {
        const assignment = assignmentMap.get(asset.id);
        const assignedEmployee = assignment?.employee;
        const repair = repairMap.get(asset.id);
        return {
          id: asset.id,
          assetCode: asset.asset_code,
          name: asset.name,
          type: normalizeAssetType(asset.category),
          category: asset.category,
          serialNumber: asset.serial_number || "",
          purchaseDate: asset.purchase_date
            ? format(parseISO(asset.purchase_date), "MMM d, yyyy")
            : "Unknown",
          purchaseDateRaw: asset.purchase_date || "",
          vendor: asset.vendor || "",
          cost: Number(asset.purchase_cost) || 0,
          status: asset.status as Asset["status"],
          notes: asset.notes || undefined,
          warrantyEnd: asset.warranty_end_date || "",
          retiredAt: asset.retired_at,
          retireReason: asset.retire_reason,
          repairSpend: repair?.spend ?? 0,
          repairCount: repair?.count ?? 0,
          openRepair: repair?.open ?? null,
          openIssues: issueCount.get(asset.id) ?? 0,
          assignedTo: assignment && assignedEmployee
            ? {
                employeeId: assignment.employeeId,
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

      const counts: Record<AssetType, number> = {
        laptop: 0, desktop: 0, monitor: 0, phone: 0, tablet: 0, accessory: 0, other: 0,
      };
      for (const a of data || []) counts[normalizeAssetType(a.category)] += 1;

      const total = data?.length || 0;
      // Buckets always add up to `total`.
      return {
        total,
        computers: counts.laptop + counts.desktop,
        monitors: counts.monitor,
        mobile: counts.phone + counts.tablet,
        other: counts.accessory + counts.other,
        counts,
      };
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

export interface UpdateAssetData {
  id: string;
  name?: string;
  category?: string;
  // null clears the field; undefined leaves it untouched.
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  vendor?: string | null;
  notes?: string | null;
  warranty_end_date?: string | null;
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAssetData) => {
      const { error } = await supabase
        .from("assets")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export interface AssignAssetData {
  assetId: string;
  employeeId: string;
  notes?: string;
}

export function useAssignAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assetId, employeeId, notes }: AssignAssetData) => {
      // Create assignment record
      const { error: assignError } = await supabase
        .from("asset_assignments")
        .insert({
          asset_id: assetId,
          employee_id: employeeId,
          notes: notes || null,
        });

      if (assignError) throw assignError;

      // Update asset status to assigned
      const { error: updateError } = await supabase
        .from("assets")
        .update({ status: "assigned" })
        .eq("id", assetId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export function useReturnAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      // Update assignment record with returned date
      const { error: assignError } = await supabase
        .from("asset_assignments")
        .update({ returned_date: new Date().toISOString().split("T")[0] })
        .eq("asset_id", assetId)
        .is("returned_date", null);

      if (assignError) throw assignError;

      // Update asset status to available
      const { error: updateError } = await supabase
        .from("assets")
        .update({ status: "available" })
        .eq("id", assetId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-stats"] });
    },
  });
}

export interface AssetAssignment {
  id: string;
  assignedDate: string;
  returnedDate: string | null;
  notes: string | null;
  employee: {
    name: string;
    avatar?: string;
  };
}

export function useAssetHistory(assetId: string | null) {
  return useQuery({
    queryKey: ["asset-history", assetId],
    queryFn: async () => {
      if (!assetId) return [];

      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          assigned_date,
          returned_date,
          notes,
          employee:employees(first_name, last_name, avatar_url)
        `)
        .eq("asset_id", assetId)
        .order("assigned_date", { ascending: false });

      if (error) throw error;

      return (data || []).map((assignment): AssetAssignment => {
        const emp = assignment.employee as { first_name: string; last_name: string; avatar_url: string | null } | null;
        return {
          id: assignment.id,
          assignedDate: format(parseISO(assignment.assigned_date), "MMM d, yyyy"),
          returnedDate: assignment.returned_date
            ? format(parseISO(assignment.returned_date), "MMM d, yyyy")
            : null,
          notes: assignment.notes,
          employee: emp
            ? {
                name: `${emp.first_name} ${emp.last_name}`,
                avatar: emp.avatar_url || undefined,
              }
            : { name: "Unknown" },
        };
      });
    },
    enabled: !!assetId,
  });
}

// ---------------------------------------------------------------------------
// Lifecycle actions (database functions record the reason in the history)
// ---------------------------------------------------------------------------

function useAssetAction<T>(run: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      for (const key of ["assets", "asset-stats", "asset-issues", "asset-history", "asset-events", "asset-report", "my-asset-issues"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

const rpcError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function useSendForRepair() {
  return useAssetAction(
    async (input: {
      assetId: string;
      problem: string;
      vendor?: string;
      expectedReturn?: string;
      estimatedCost?: number;
      issueId?: string;
    }) => {
      const { error } = await supabase.rpc("asset_send_for_repair", {
        _asset_id: input.assetId,
        _problem: input.problem,
        _vendor: input.vendor || undefined,
        _expected_return: input.expectedReturn || undefined,
        _estimated_cost: input.estimatedCost,
        _issue_id: input.issueId,
      });
      rpcError(error);
    },
  );
}

export function useCompleteRepair() {
  return useAssetAction(
    async (input: { repairId: string; outcome: "repaired" | "beyond_repair"; actualCost?: number; notes?: string }) => {
      const { error } = await supabase.rpc("asset_complete_repair", {
        _repair_id: input.repairId,
        _outcome: input.outcome,
        _actual_cost: input.actualCost,
        _notes: input.notes || undefined,
      });
      rpcError(error);
    },
  );
}

export function useSetAssetCondition() {
  return useAssetAction(async (input: { assetId: string; status: "damaged" | "lost" | "available"; reason: string }) => {
    const { error } = await supabase.rpc("asset_set_condition", {
      _asset_id: input.assetId,
      _status: input.status,
      _reason: input.reason,
    });
    rpcError(error);
  });
}

export function useRetireAsset() {
  return useAssetAction(
    async (input: { assetId: string; reason: string; notes?: string; retiredOn?: string; disposalValue?: number }) => {
      const { error } = await supabase.rpc("asset_retire", {
        _asset_id: input.assetId,
        _reason: input.reason,
        _notes: input.notes || undefined,
        _retired_on: input.retiredOn || undefined,
        _disposal_value: input.disposalValue,
      });
      rpcError(error);
    },
  );
}

export function useReportAssetIssue() {
  return useAssetAction(async (input: { assetId: string; kind: string; description: string }) => {
    const { error } = await supabase.rpc("asset_report_issue", {
      _asset_id: input.assetId,
      _kind: input.kind,
      _description: input.description,
    });
    rpcError(error);
  });
}

export function useCloseAssetIssue() {
  return useAssetAction(async (input: { issueId: string; status: "resolved" | "dismissed"; notes?: string }) => {
    const { error } = await supabase.rpc("asset_close_issue", {
      _issue_id: input.issueId,
      _status: input.status,
      _notes: input.notes || undefined,
    });
    rpcError(error);
  });
}

// ---------------------------------------------------------------------------
// Problem reports and history
// ---------------------------------------------------------------------------

export interface AssetIssue {
  id: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  kind: string;
  description: string;
  status: "open" | "in_repair" | "resolved" | "dismissed";
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reportedBy: string | null;
}

const ISSUE_SELECT =
  "id, asset_id, kind, description, status, resolution_notes, created_at, resolved_at, asset:assets(name, asset_code), employee:employees(first_name, last_name)";

type IssueRow = {
  id: string;
  asset_id: string;
  kind: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  asset: { name: string; asset_code: string } | null;
  employee: { first_name: string; last_name: string } | null;
};

const mapIssue = (row: IssueRow): AssetIssue => ({
  id: row.id,
  assetId: row.asset_id,
  assetName: row.asset?.name ?? "Asset",
  assetCode: row.asset?.asset_code ?? "",
  kind: row.kind,
  description: row.description,
  status: row.status as AssetIssue["status"],
  resolutionNotes: row.resolution_notes,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
  reportedBy: row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : null,
});

/** Open problem reports (for people managing assets). */
export function useAssetIssues(enabled = true) {
  return useQuery({
    queryKey: ["asset-issues"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_issues")
        .select(ISSUE_SELECT)
        .in("status", ["open", "in_repair"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapIssue(row as unknown as IssueRow));
    },
  });
}

/** Problems the signed-in employee reported. */
export function useMyAssetIssues(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["my-asset-issues", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_issues")
        .select(ISSUE_SELECT)
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => mapIssue(row as unknown as IssueRow));
    },
  });
}

export interface AssetEvent {
  id: string;
  event: string;
  fromStatus: AssetStatus | null;
  toStatus: AssetStatus | null;
  reason: string | null;
  amount: number | null;
  employeeName: string | null;
  createdAt: string;
}

export function useAssetEvents(assetId: string | null) {
  return useQuery({
    queryKey: ["asset-events", assetId],
    enabled: !!assetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_events")
        .select("id, event, from_status, to_status, reason, amount, created_at, employee:employees(first_name, last_name)")
        .eq("asset_id", assetId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row): AssetEvent => {
        const emp = row.employee as { first_name: string; last_name: string } | null;
        return {
          id: row.id,
          event: row.event,
          fromStatus: row.from_status as AssetStatus | null,
          toStatus: row.to_status as AssetStatus | null,
          reason: row.reason,
          amount: row.amount === null ? null : Number(row.amount),
          employeeName: emp ? `${emp.first_name} ${emp.last_name}` : null,
          createdAt: row.created_at,
        };
      });
    },
  });
}
