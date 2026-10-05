import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass } from "@/lib/statusStyles";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Calendar, Tag, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface MyAssetsProps {
  employeeId: string;
}

interface AssetAssignment {
  id: string;
  assigned_date: string;
  returned_date: string | null;
  notes: string | null;
  asset: {
    id: string;
    name: string;
    asset_code: string;
    category: string;
    serial_number: string | null;
  } | null;
}

export function MyAssets({ employeeId }: MyAssetsProps) {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["my-assets", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_assignments")
        .select(`
          id,
          assigned_date,
          returned_date,
          notes,
          asset:assets!asset_assignments_asset_id_fkey (
            id,
            name,
            asset_code,
            category,
            serial_number
          )
        `)
        .eq("employee_id", employeeId)
        .order("assigned_date", { ascending: false });

      if (error) throw error;
      return data as AssetAssignment[];
    },
    enabled: !!employeeId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden="true" />
            My assets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentAssets = assignments?.filter((a) => !a.returned_date) || [];
  const returnedAssets = assignments?.filter((a) => a.returned_date) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" aria-hidden="true" />
            Currently assigned assets
          </CardTitle>
          <CardDescription>Assets currently in your possession</CardDescription>
        </CardHeader>
        <CardContent>
          {currentAssets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {currentAssets.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{assignment.asset?.name || "Unknown asset"}</h4>
                      <p className="text-sm text-muted-foreground">{assignment.asset?.asset_code}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs capitalize">
                      {assignment.asset?.category}
                    </Badge>
                  </div>
                  {assignment.asset?.serial_number && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>S/N: {assignment.asset.serial_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Assigned: {format(new Date(assignment.assigned_date), "MMM d, yyyy")}</span>
                  </div>
                  {assignment.notes && (
                    <p className="text-xs text-muted-foreground italic">{assignment.notes}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No assets currently assigned</p>
            </div>
          )}
        </CardContent>
      </Card>

      {returnedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previously assigned assets</CardTitle>
            <CardDescription>Assets you have returned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {returnedAssets.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-lg border border-dashed p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium">{assignment.asset?.name || "Unknown asset"}</h4>
                      <p className="text-sm text-muted-foreground">{assignment.asset?.asset_code}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${statusBadgeClass("returned")}`}>
                      Returned
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Returned: {format(new Date(assignment.returned_date!), "MMM d, yyyy")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
