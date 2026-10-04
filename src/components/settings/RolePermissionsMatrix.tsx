import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppModule, MODULES } from "@/lib/permissions";
import {
  CONFIGURABLE_ROLES,
  LEVEL_CHOICES,
  LevelChoice,
  ROLE_PERMISSIONS_KEY,
  levelLabel,
  levelRank,
  moduleLabel,
  useRolePermissions,
} from "./permissionsData";

type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number]["key"];
type Matrix = Record<string, LevelChoice>; // key `${role}:${module}`

const cellKey = (role: ConfigurableRole, module: AppModule) => `${role}:${module}`;
const get = (m: Matrix, role: ConfigurableRole, module: AppModule): LevelChoice => m[cellKey(role, module)] ?? "none";

function LevelSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: LevelChoice;
  onChange: (v: LevelChoice) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as LevelChoice)} disabled={disabled}>
      <SelectTrigger className="h-9 w-full min-w-[96px]" aria-label={label}>
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
  );
}

export function RolePermissionsMatrix() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: rows = [], isLoading, error } = useRolePermissions();

  const saved = useMemo<Matrix>(() => {
    const m: Matrix = {};
    for (const r of rows) {
      if (r.role !== "admin") m[cellKey(r.role, r.module)] = r.level;
    }
    return m;
  }, [rows]);

  const [draft, setDraft] = useState<Matrix>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const changes = useMemo(() => {
    const list: { role: ConfigurableRole; module: AppModule; before: LevelChoice; after: LevelChoice }[] = [];
    for (const r of CONFIGURABLE_ROLES) {
      for (const m of MODULES) {
        const before = get(saved, r.key, m.key);
        const after = get(draft, r.key, m.key);
        if (before !== after) list.push({ role: r.key, module: m.key, before, after });
      }
    }
    return list;
  }, [saved, draft]);

  const hrReductions = changes.filter((c) => c.role === "hr" && levelRank(c.after) < levelRank(c.before));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts = changes
        .filter((c) => c.after !== "none")
        .map((c) => ({
          role: c.role,
          module: c.module,
          level: c.after as "view" | "manage",
          updated_by: currentUser?.id ?? null,
        }));
      if (upserts.length > 0) {
        const { error } = await supabase.from("role_permissions").upsert(upserts, { onConflict: "role,module" });
        if (error) throw error;
      }
      for (const c of changes.filter((c) => c.after === "none")) {
        const { error } = await supabase.from("role_permissions").delete().eq("role", c.role).eq("module", c.module);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Role defaults saved", description: "Changes apply to everyone with these roles." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      // Refetch even on partial failure so the matrix shows what's really stored
      queryClient.invalidateQueries({ queryKey: ROLE_PERMISSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });

  const handleSave = () => {
    if (hrReductions.length > 0) setConfirmOpen(true);
    else saveMutation.mutate();
  };

  const setCell = (role: ConfigurableRole, module: AppModule, value: LevelChoice) =>
    setDraft((prev) => ({ ...prev, [cellKey(role, module)]: value }));

  const busy = saveMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Defaults for each role</CardTitle>
          <CardDescription>
            Changes here apply to everyone with that role. To give just one person more access, use{" "}
            <span className="font-medium text-foreground">Extra access</span> on their row in the list above.
            Administrators always have full access.
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            Managers and employees always keep self-service and team access without any grant; anything set here gives
            organisation-wide access to everyone with that role.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setDraft(saved)} disabled={busy || changes.length === 0}>
            <Undo2 className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={busy || changes.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save{changes.length > 0 ? ` (${changes.length})` : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading role access...</div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Couldn't load role access: {(error as Error).message}
          </div>
        ) : (
          <>
            {/* Desktop / tablet: matrix */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    {CONFIGURABLE_ROLES.map((r) => (
                      <TableHead key={r.key} className="w-36">
                        {r.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULES.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell>
                        <p className="font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </TableCell>
                      {CONFIGURABLE_ROLES.map((r) => (
                        <TableCell key={r.key}>
                          <LevelSelect
                            value={get(draft, r.key, m.key)}
                            onChange={(v) => setCell(r.key, m.key, v)}
                            disabled={busy}
                            label={`${r.label} access to ${m.label}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone: one block per module */}
            <div className="space-y-3 md:hidden">
              {MODULES.map((m) => (
                <div key={m.key} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{m.description}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {CONFIGURABLE_ROLES.map((r) => (
                      <div key={r.key} className="min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground">{r.label}</p>
                        <LevelSelect
                          value={get(draft, r.key, m.key)}
                          onChange={(v) => setCell(r.key, m.key, v)}
                          disabled={busy}
                          label={`${r.label} access to ${m.label}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reduce HR access?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>This changes access for everyone with the HR role:</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {hrReductions.map((c) => (
                    <li key={c.module}>
                      {moduleLabel(c.module)}: {levelLabel(c.before)} → {levelLabel(c.after)}
                    </li>
                  ))}
                </ul>
                <p>HR users who need this access will have to be given it individually.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => saveMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reduce HR access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
