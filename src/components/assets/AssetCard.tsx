import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Laptop, Monitor, Smartphone, Headphones, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Asset {
  id: string;
  name: string;
  type: "laptop" | "monitor" | "phone" | "accessory";
  serialNumber: string;
  purchaseDate: string;
  cost: number;
  status: "available" | "assigned" | "maintenance";
  assignedTo?: {
    name: string;
    avatar?: string;
  };
}

interface AssetCardProps {
  asset: Asset;
  onAssign?: (asset: Asset) => void;
  onReturn?: (asset: Asset) => void;
  onEdit?: (asset: Asset) => void;
}

const typeIcons = {
  laptop: <Laptop className="h-6 w-6" />,
  monitor: <Monitor className="h-6 w-6" />,
  phone: <Smartphone className="h-6 w-6" />,
  accessory: <Headphones className="h-6 w-6" />,
};

const statusStyles = {
  available: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  assigned: "bg-primary/10 text-primary border-primary/20",
  maintenance: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function AssetCard({ asset, onAssign, onReturn, onEdit }: AssetCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {typeIcons[asset.type]}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{asset.name}</h3>
              <p className="text-sm text-muted-foreground">SN: {asset.serialNumber}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(asset)}>Edit Asset</DropdownMenuItem>
              {asset.status === "available" && (
                <DropdownMenuItem onClick={() => onAssign?.(asset)}>
                  Assign to Employee
                </DropdownMenuItem>
              )}
              {asset.status === "assigned" && (
                <DropdownMenuItem onClick={() => onReturn?.(asset)}>
                  Mark as Returned
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Purchase Date</p>
            <p className="text-sm font-medium text-foreground">{asset.purchaseDate}</p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-sm font-medium text-foreground">${asset.cost.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Badge variant="outline" className={statusStyles[asset.status]}>
            {asset.status}
          </Badge>
          {asset.assignedTo && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={asset.assignedTo.avatar} />
                <AvatarFallback className="text-xs">
                  {asset.assignedTo.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{asset.assignedTo.name}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
