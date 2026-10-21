import {
  Archive,
  CheckCircle2,
  Edit,
  History,
  MoreVertical,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset } from "@/hooks/useAssets";

export type AssetAction =
  | "edit"
  | "history"
  | "assign"
  | "return"
  | "repair"
  | "complete-repair"
  | "damaged"
  | "lost"
  | "found"
  | "back-in-use"
  | "retire"
  | "delete";

interface AssetActionsMenuProps {
  asset: Asset;
  onAction: (action: AssetAction, asset: Asset) => void;
  /** Only history for people who can view but not manage assets */
  canManage: boolean;
  triggerClassName?: string;
}

/** The actions available for an asset in its current status. */
export function AssetActionsMenu({ asset, onAction, canManage, triggerClassName }: AssetActionsMenuProps) {
  const s = asset.status;
  const item = (action: AssetAction, label: string, Icon: typeof Edit, destructive = false) => (
    <DropdownMenuItem
      onClick={() => onAction(action, asset)}
      className={destructive ? "text-destructive focus:text-destructive" : undefined}
    >
      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName ?? "h-10 w-10 shrink-0 sm:h-8 sm:w-8"}
          aria-label={`Actions for ${asset.name}`}
          title="Asset actions"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {item("history", "View history", History)}
        {canManage && (
          <>
            {item("edit", "Edit details", Edit)}
            <DropdownMenuSeparator />
            {s === "available" && item("assign", "Assign to employee", UserPlus)}
            {s === "assigned" && item("return", "Mark as returned", RotateCcw)}
            {s === "in_repair" && item("complete-repair", "Back from repair", CheckCircle2)}
            {(s === "available" || s === "assigned" || s === "damaged") && item("repair", "Send for repair", Wrench)}
            {(s === "available" || s === "assigned") && item("damaged", "Mark as damaged", ShieldAlert)}
            {(s === "available" || s === "assigned") && item("lost", "Mark as lost", Search)}
            {s === "damaged" && item("back-in-use", "Back in use", CheckCircle2)}
            {s === "lost" && item("found", "Found it", CheckCircle2)}
            {s !== "retired" && s !== "in_repair" && item("retire", "Retire asset", Archive)}
            <DropdownMenuSeparator />
            {item("delete", "Delete asset", Trash2, true)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
