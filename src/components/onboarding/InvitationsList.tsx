import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Ban, Loader2, MailPlus, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { inviteEmployee } from "./inviteEmployee";
import { statusBadgeClass } from "@/lib/statusStyles";

type Invitation = Database["public"]["Tables"]["user_invitations"]["Row"];
type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

const INVITATIONS_KEY = ["user-invitations"] as const;

function invitationStatus(inv: Invitation): InvitationStatus {
  if (inv.revoked_at) return "revoked";
  if (inv.accepted_at) return "accepted";
  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) return "expired";
  return "pending";
}

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Account created",
  revoked: "Revoked",
  expired: "Expired",
};

function StatusBadge({ status }: { status: InvitationStatus }) {
  return (
    <Badge variant="outline" className={`whitespace-nowrap ${statusBadgeClass(status)}`}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function useInvitations() {
  return useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const invitations = data ?? [];

      // Resolve "invited by" names. Employee records are readable by anyone with
      // module access; profiles only with employees:view, so try both.
      const inviterIds = [...new Set(invitations.map((i) => i.invited_by).filter(Boolean) as string[])];
      const names = new Map<string, string>();
      if (inviterIds.length > 0) {
        const [{ data: emps }, { data: profiles }] = await Promise.all([
          supabase.from("employees").select("user_id, first_name, last_name").in("user_id", inviterIds),
          supabase.from("profiles").select("id, full_name, email").in("id", inviterIds),
        ]);
        for (const p of profiles ?? []) names.set(p.id, p.full_name || p.email);
        for (const e of emps ?? []) if (e.user_id) names.set(e.user_id, `${e.first_name} ${e.last_name}`);
      }
      return { invitations, names };
    },
  });
}

interface InvitationsListProps {
  canManage: boolean;
}

export function InvitationsList({ canManage }: InvitationsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useInvitations();
  const invitations = data?.invitations ?? [];
  const names = data?.names ?? new Map<string, string>();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });
  const [toRevoke, setToRevoke] = useState<Invitation | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async () =>
      inviteEmployee({
        email: form.email.trim(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        redirect_url: `${window.location.origin}/`,
        mode: "self_onboarding",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["unlinked-users"] });
      setInviteOpen(false);
      setForm({ email: "", firstName: "", lastName: "" });
      toast({
        title: result.already_exists ? "Already has an account" : "Invitation sent",
        description: result.already_exists
          ? `${form.email.trim()} already has an account. They can sign in and submit their onboarding details from the dashboard.`
          : `${form.firstName.trim()} will get an email to set a password, then fill in their onboarding details. Their request will appear under Requests for approval.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Invitation not sent", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invitation revoked", description: "The invitation can no longer be used to create an account." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INVITATIONS_KEY });
      setToRevoke(null);
    },
  });

  const showActions = canManage && invitations.some((inv) => invitationStatus(inv) === "pending");

  // Only name an inviter when we actually know who it was.
  const inviterName = (inv: Invitation) => (inv.invited_by ? names.get(inv.invited_by) ?? null : null);

  const renderRevoke = (inv: Invitation) => (
    <Button
      variant="outline"
      size="sm"
      className="h-9 text-red-700 hover:bg-red-50 hover:text-red-800"
      onClick={() => setToRevoke(inv)}
      disabled={revokeMutation.isPending}
      aria-label={`Revoke invitation for ${inv.full_name || inv.email}`}
    >
      <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
      Revoke
    </Button>
  );

  const handleInvite = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: "Error", description: "First and last name are required", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast({ title: "Error", description: "Enter a valid email address", variant: "destructive" });
      return;
    }
    inviteMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 p-4 sm:flex-row sm:p-6 sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            Accounts are invite-only. Invite someone to set up an account and submit their own onboarding details.
          </CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)} className="self-start shrink-0 sm:self-auto">
            <MailPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            Invite to self-onboard
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Couldn't load invitations: {(error as Error).message}
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Send className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">No invitations yet</h3>
            <p className="text-muted-foreground">Invitations you send will show up here.</p>
          </div>
        ) : (
          <>
          {/* Table (sm and up) */}
          <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitee</TableHead>
                <TableHead className="hidden md:table-cell">Invited by</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                {showActions && <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => {
                const status = invitationStatus(inv);
                const inviter = inviterName(inv);
                return (
                  <TableRow key={inv.id} data-invitation-row>
                    <TableCell>
                      <p className="break-words font-medium">{inv.full_name || inv.email}</p>
                      {inv.full_name && (
                        <p className="break-words text-xs text-muted-foreground">{inv.email}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {inviter ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(new Date(inv.created_at), "MMM d, yyyy")}
                      {inv.expires_at && status === "pending" && (
                        <p className="text-xs">Expires {format(new Date(inv.expires_at), "MMM d")}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    {showActions && (
                      <TableCell className="w-[1%] whitespace-nowrap text-right">
                        {status === "pending" && renderRevoke(inv)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          {/* Cards (mobile) */}
          <ul className="space-y-3 sm:hidden">
            {invitations.map((inv) => {
              const status = invitationStatus(inv);
              const inviter = inviterName(inv);
              return (
                <li key={inv.id} data-invitation-row className="rounded-lg border p-3">
                  <p className="truncate font-medium" title={inv.full_name || inv.email}>
                    {inv.full_name || inv.email}
                  </p>
                  {inv.full_name && (
                    <p className="truncate text-sm text-muted-foreground" title={inv.email}>{inv.email}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={status} />
                    <span>
                      Sent {format(new Date(inv.created_at), "MMM d, yyyy")}
                      {inviter && <> by {inviter}</>}
                      {inv.expires_at && status === "pending" && <> · Expires {format(new Date(inv.expires_at), "MMM d")}</>}
                    </span>
                  </div>
                  {canManage && status === "pending" && <div className="mt-2">{renderRevoke(inv)}</div>}
                </li>
              );
            })}
          </ul>
          </>
        )}
        {invitations.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            "Account created" means the invitation email went out and their account exists; they still need to open
            the email to set a password. Revoke only applies to invitations that haven't been used yet.
          </p>
        )}
      </CardContent>

      {/* Invite to self-onboard */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !inviteMutation.isPending && setInviteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to self-onboard</DialogTitle>
            <DialogDescription>
              They'll get an email to set a password, then fill in the onboarding form themselves. You approve their
              request under Requests and create their employee record from it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-first">First name *</Label>
                <Input
                  id="invite-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  disabled={inviteMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last">Last name *</Label>
                <Input
                  id="invite-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  disabled={inviteMutation.isPending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={inviteMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!toRevoke} onOpenChange={(open) => !open && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {toRevoke?.email} won't be able to create an account with this invitation. You can invite them again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toRevoke && revokeMutation.mutate(toRevoke.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
