import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, parseISO } from "date-fns";
import { Laptop, Monitor, Smartphone, Tablet, Headphones, Package, PcCase, AlertTriangle } from "lucide-react";
import { ASSET_STATUS_LABELS, assetStatusTone, type Asset, type AssetType } from "@/hooks/useAssets";
import { formatCurrency } from "@/lib/currency";
import { statusBadgeClass } from "@/lib/statusStyles";
import { AssetActionsMenu, type AssetAction } from "./AssetActionsMenu";

export type { Asset };

interface AssetCardProps {
  asset: Asset;
  onAction: (action: AssetAction, asset: Asset) => void;
  canManage: boolean;
}
const typeIcons: Record<AssetType, JSX.Element> = {
  laptop: <Laptop className="h-6 w-6" aria-hidden="true" />,
  desktop: <PcCase className="h-6 w-6" aria-hidden="true" />,
  monitor: <Monitor className="h-6 w-6" aria-hidden="true" />,
  phone: <Smartphone className="h-6 w-6" aria-hidden="true" />,
  tablet: <Tablet className="h-6 w-6" aria-hidden="true" />,
  accessory: <Headphones className="h-6 w-6" aria-hidden="true" />,
  other: <Package className="h-6 w-6" aria-hidden="true" />,
};

export function AssetCard({ asset, onAction, canManage }: AssetCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              title={asset.category}
            >
              {typeIcons[asset.type] ?? typeIcons.other}
            </div>
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-foreground">{asset.name}</h3>
              <p className="truncate text-sm text-muted-foreground">
                {asset.assetCode}
                {asset.serialNumber ? ` · SN ${asset.serialNumber}` : ""}
              </p>
            </div>
          </div>
          <AssetActionsMenu asset={asset} canManage={canManage} onAction={onAction} triggerClassName="-mr-2 -mt-2 h-10 w-10 shrink-0 sm:h-8 sm:w-8" />
        </div>

        {asset.openRepair && (
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            In repair: {asset.openRepair.problem}
            {asset.openRepair.expectedReturn && ` · back ${format(parseISO(asset.openRepair.expectedReturn), "MMM d")}`}
          </p>
        )}

        {asset.notes && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{asset.notes}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Purchase date</p>
            <p className="text-sm font-medium text-foreground">{asset.purchaseDate}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(asset.cost)}</p>
            {asset.repairCount > 0 && (
              <p className="text-xs text-muted-foreground">+ {formatCurrency(asset.repairSpend)} repairs</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
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
          {asset.assignedTo && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={asset.assignedTo.avatar} />
                <AvatarFallback className="text-xs">
                  {asset.assignedTo.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-muted-foreground">{asset.assignedTo.name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
