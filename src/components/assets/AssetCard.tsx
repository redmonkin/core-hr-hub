import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Laptop, Monitor, Smartphone, Tablet, Headphones, Package, PcCase, MoreVertical, Edit, Trash2, UserPlus, RotateCcw, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset, AssetType } from "@/hooks/useAssets";
import { statusBadgeClass, formatStatus } from "@/lib/statusStyles";

export type { Asset };

interface AssetCardProps {
  asset: Asset;
  onAssign?: (asset: Asset) => void;
  onReturn?: (asset: Asset) => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onViewHistory?: (asset: Asset) => void;
  showAdminActions?: boolean;
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

export function AssetCard({ asset, onAssign, onReturn, onEdit, onDelete, onViewHistory, showAdminActions = true }: AssetCardProps) {
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
                {asset.serialNumber ? `SN: ${asset.serialNumber}` : "No serial number"}
              </p>
            </div>
          </div>
          {showAdminActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-2 h-10 w-10 shrink-0 sm:h-8 sm:w-8"
                  aria-label={`Actions for ${asset.name}`}
                  title="Asset actions"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(asset)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit asset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewHistory?.(asset)}>
                  <History className="mr-2 h-4 w-4" />
                  View history
                </DropdownMenuItem>
                {asset.status === "available" && (
                  <DropdownMenuItem onClick={() => onAssign?.(asset)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign to employee
                  </DropdownMenuItem>
                )}
                {asset.status === "assigned" && (
                  <DropdownMenuItem onClick={() => onReturn?.(asset)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Mark as returned
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(asset)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete asset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

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
            <p className="text-sm font-medium text-foreground">₹{asset.cost.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Badge variant="outline" className={statusBadgeClass(asset.status)}>
            {formatStatus(asset.status)}
          </Badge>
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
