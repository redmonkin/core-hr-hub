import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppModule, AppRole, MODULES } from "@/lib/permissions";
import {
  LEVEL_CHOICES,
  LevelChoice,
  RolePermissionRow,
  USER_PERMISSIONS_KEY,
  UserPermissionRow,
  levelFromRoles,
  levelLabel,
  levelRank,
  maxLevel,
} from "./permissionsData";

export interface PermissionsDialogUser {
  id: string;
  full_name: string | null;
  email: string;
  roles: AppRole[];
}

interface UserPermissionsDialogProps {
  user: PermissionsDialogUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolePermissions: RolePermissionRow[];
  userPermissions: UserPermissionRow[];
  loading: boolean;
}

const roleNames: Record<AppRole, string> = {
  admin: "Administrator",
  hr: "HR",
  manager: "Manager",
  employee: "Employee",
};

function LevelBadge({ level, muted }: { level: LevelChoice; muted?: boolean }) {
  if (level === "none") return <span className="text-xs text-muted-foreground">None</span>;
  return (
    <Badge variant={level === "manage" && !muted ? "default" : "secondary"} className="text-xs">
      {levelLabel(level)}
    </Badge>
  );
}

export function UserPermissionsDialog({
  user,
  open,
  onOpenChange,
  rolePermissions,
  userPermissions,
  loading,
}: UserPermissionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdminUser = !!user?.roles.includes("admin");

  // Current direct grants for this user
  const existing = useMemo(() => {
    const map: Partial<Record<AppModule, LevelChoice>> = {};
    if (!user) return map;
    for (const row of userPermissions) {
      if (row.user_id === user.id) map[row.module] = row.level;
    }
    return map;
  }, [user, userPermissions]);

  const [draft, setDraft] = useState<Partial<Record<AppModule, LevelChoice>>>({});

  // Reset the draft whenever the dialog opens for a user
  useEffect(() => {
    if (open) setDraft(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, loading]);

  const changed = MODULES.some((m) => (draft[m.key] ?? "none") !== (existing[m.key] ?? "none"));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const upserts: { user_id: string; module: AppModule; level: "view" | "manage"; granted_by: string | null }[] = [];
      const deletes: AppModule[] = [];
      for (const m of MODULES) {
        const before = existing[m.key] ?? "none";
        const after = draft[m.key] ?? "none";
        if (before === after) continue;
        if (after === "none") deletes.push(m.key);
        else upserts.push({ user_id: user.id, module: m.key, level: after, granted_by: currentUser?.id ?? null });
      }
      if (upserts.length > 0) {
        const { error } = await supabase.from("user_permissions").upsert(upserts, { onConflict: "user_id,module" });
        if (error) throw error;
      }
      if (deletes.length > 0) {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", user.id)
          .in("module", deletes);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_PERMISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      onOpenChange(false);
      toast({
        title: "Access updated",
        description: `Module access for ${user?.full_name || user?.email} has been saved.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const displayName = user?.full_name || user?.email;
  const nonAdminRoles = user?.roles.filter((r) => r !== "admin") ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !saveMutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Module access</DialogTitle>
          <DialogDescription>
            Extra access for {displayName}. Direct grants are added on top of what their role
            {nonAdminRoles.length > 1 ? "s already give" : " already gives"}
            {nonAdminRoles.length > 0 ? ` (${nonAdminRoles.map((r) => roleNames[r]).join(", ")})` : ""}; they never
            take access away.
          </DialogDescription>
        </DialogHeader>

        {isAdminUser ? (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Administrators have full access to every module.</p>
              <p className="text-muted-foreground">
                This can't be edited. To limit what this person can do, change their role first.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>View</strong> lets them see the module's data across the whole organisation;{" "}
                <strong>Manage</strong> also lets them edit and approve. Everyone keeps their own self-service and
                team access without any grant.
              </span>
            </div>

            {/* Column headings (desktop) */}
            <div className="hidden grid-cols-[1fr_88px_132px_88px] items-center gap-3 px-3 text-xs font-medium text-muted-foreground sm:grid">
              <span>Module</span>
              <span>From role</span>
              <span>Direct grant</span>
              <span>Effective</span>
            </div>

            <div className="divide-y rounded-lg border">
              {MODULES.map((m) => {
                const fromRole = levelFromRoles(user?.roles ?? [], rolePermissions, m.key);
                const direct = draft[m.key] ?? "none";
                const effective = maxLevel(fromRole, direct);
                const redundant = direct !== "none" && levelRank(fromRole) >= levelRank(direct);
                return (
                  <div
                    key={m.key}
                    className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 sm:grid-cols-[1fr_88px_132px_88px] sm:items-center"
                  >
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:block">
                      <span className="text-xs text-muted-foreground sm:hidden">From role:</span>
                      <LevelBadge level={fromRole} muted />
                    </div>
                    <div className="flex items-center gap-2 sm:hidden">
                      <span className="text-xs text-muted-foreground">Effective:</span>
                      <LevelBadge level={effective} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Select
                        value={direct}
                        onValueChange={(v) => setDraft((prev) => ({ ...prev, [m.key]: v as LevelChoice }))}
                        disabled={saveMutation.isPending}
                      >
                        <SelectTrigger className="h-9" aria-label={`Direct grant for ${m.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVEL_CHOICES.map((l) => (
                            <SelectItem key={l.key} value={l.key}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {redundant && (
                        <p className="mt-1 text-[11px] text-muted-foreground">Already covered by role</p>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      <LevelBadge level={effective} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
            {isAdminUser ? "Close" : "Cancel"}
          </Button>
          {!isAdminUser && (
            <Button onClick={() => saveMutation.mutate()} disabled={!changed || loading || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save access
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
