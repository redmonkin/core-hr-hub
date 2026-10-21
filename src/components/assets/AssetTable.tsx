import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSET_STATUS_LABELS, assetStatusTone, type Asset } from "@/hooks/useAssets";
import { formatCurrency } from "@/lib/currency";
import { statusBadgeClass } from "@/lib/statusStyles";
import { AssetActionsMenu, type AssetAction } from "./AssetActionsMenu";

interface AssetTableProps {
  assets: Asset[];
  canManage: boolean;
  onAction: (action: AssetAction, asset: Asset) => void;
}

function Warranty({ date }: { date: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = differenceInCalendarDays(parseISO(date), new Date());
  return (
    <span className={days < 0 ? "text-muted-foreground" : days <= 60 ? "text-amber-700 dark:text-amber-400" : undefined}>
      {format(parseISO(date), "MMM d, yyyy")}
      <span className="block text-xs text-muted-foreground">
        {days < 0 ? "Expired" : days <= 60 ? `Ends in ${days} ${days === 1 ? "day" : "days"}` : ""}
      </span>
    </span>
  );
}

/** Desktop table of assets (the page shows cards below the sm breakpoint). */
export function AssetTable({ assets, canManage, onAction }: AssetTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>With</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Repairs</TableHead>
            <TableHead>Warranty</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id}>
              <TableCell className="min-w-[200px]">
                <p className="font-medium text-foreground">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.assetCode}
                  {asset.serialNumber && ` · SN ${asset.serialNumber}`}
                  <span className="capitalize"> · {asset.category}</span>
                </p>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={statusBadgeClass(assetStatusTone(asset.status))}>
                    {ASSET_STATUS_LABELS[asset.status]}
                  </Badge>
                  {asset.openIssues > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {asset.openIssues} reported
                    </span>
                  )}
                </div>
                {asset.openRepair?.expectedReturn && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Back {format(parseISO(asset.openRepair.expectedReturn), "MMM d")}
                  </p>
                )}
              </TableCell>
              <TableCell>
                {asset.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={asset.assignedTo.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {asset.assignedTo.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="whitespace-nowrap text-sm">{asset.assignedTo.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {asset.cost ? formatCurrency(asset.cost) : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {asset.repairCount > 0 ? (
                  <>
                    {formatCurrency(asset.repairSpend)}
                    <span className="block text-xs text-muted-foreground">
                      {asset.repairCount} {asset.repairCount === 1 ? "repair" : "repairs"}
                    </span>
                  </>
                ) : asset.openRepair ? (
                  <span className="text-xs text-muted-foreground">In progress</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Warranty date={asset.warrantyEnd} />
              </TableCell>
              <TableCell>
                <AssetActionsMenu asset={asset} canManage={canManage} onAction={onAction} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
