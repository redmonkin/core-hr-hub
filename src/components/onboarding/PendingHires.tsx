import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format, parseISO, subDays } from "date-fns";
import { CalendarDays, CheckCircle2, Eye, Loader2, Mail, Send, UserCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { toneClass } from "@/lib/statusStyles";
import { cancelInvitation, sendInvitation } from "./inviteEmployee";

/** Invitation links from Supabase Auth stay valid for 24 hours. */
const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface PendingHire {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
  hire_date: string | null;
  user_id: string | null;
  departments: { name: string } | null;
}

interface Invitation {
  id: string;
  email: string;
  employee_id: string | null;
  created_at: string;
  last_sent_at: string | null;
  send_count: number;
  accepted_at: string | null;
  accepted_user_id: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  full_name: string | null;
}

type InviteState =
  | { kind: "sent"; sentAt: string; count: number }
  | { kind: "expired"; sentAt: string }
  | { kind: "not_sent" }
  | { kind: "cancelled"; at: string };

function inviteState(hire: PendingHire, invitations: Invitation[]): InviteState {
  const mine = invitations
    .filter((i) => i.employee_id === hire.id || i.email.toLowerCase() === hire.email.toLowerCase())
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = mine.find((i) => !i.accepted_at && !i.revoked_at);
  if (!open) {
    const cancelled = mine.find((i) => i.revoked_at);
    return cancelled ? { kind: "cancelled", at: cancelled.revoked_at! } : { kind: "not_sent" };
  }
  // Invitations from before send tracking: the account existing means it was sent.
  const sentAt = open.last_sent_at ?? (open.accepted_user_id ? open.created_at : null);
  if (!sentAt) return { kind: "not_sent" };
  const expired =
    Date.now() - new Date(sentAt).getTime() > LINK_LIFETIME_MS ||
    (open.expires_at !== null && new Date(open.expires_at).getTime() <= Date.now());
  return expired ? { kind: "expired", sentAt } : { kind: "sent", sentAt, count: Math.max(open.send_count, 1) };
}

function StatePill({ state }: { state: InviteState }) {
  const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
  switch (state.kind) {
    case "sent":
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="outline" className={toneClass("info")}>Invitation sent</Badge>
          <span className="text-xs text-muted-foreground">
            {ago(state.sentAt)}
            {state.count > 1 ? ` · sent ${state.count} times` : ""}
          </span>
        </div>
      );
    case "expired":
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="outline" className={toneClass("warning")}>Link expired</Badge>
          <span className="text-xs text-muted-foreground">Sent {ago(state.sentAt)}</span>
        </div>
      );
    case "cancelled":
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="outline" className={toneClass("neutral")}>Invitation cancelled</Badge>
          <span className="text-xs text-muted-foreground">{ago(state.at)}</span>
        </div>
      );
    default:
      return <Badge variant="outline" className={toneClass("danger")}>Not invited yet</Badge>;
  }
}

const initials = (h: { first_name: string; last_name: string }) =>
  `${h.first_name[0] ?? ""}${h.last_name[0] ?? ""}`.toUpperCase();

interface PendingHiresProps {
  hires: PendingHire[];
  isLoading: boolean;
  canManage: boolean;
  onOpenDetails: (id: string) => void;
  onAddEmployee?: () => void;
}

/**
 * New hires who've been added but haven't set up their account yet, with the
 * state of their invitation and actions to resend or cancel it. Below them,
 * people who joined in the last 30 days.
 */
export function PendingHires({ hires, isLoading, canManage, onOpenDetails, onAddEmployee }: PendingHiresProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<PendingHire | null>(null);

  const { data: invitations = [], isLoading: loadingInvites } = useQuery({
    queryKey: ["user-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("id, email, employee_id, created_at, last_sent_at, send_count, accepted_at, accepted_user_id, revoked_at, expires_at, full_name")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

  const recentlyJoinedIds = invitations
    .filter((i) => i.accepted_at && i.employee_id && parseISO(i.accepted_at) > subDays(new Date(), 30))
    .map((i) => i.employee_id!) ;
  const { data: recentlyJoined = [] } = useQuery({
    queryKey: ["recently-joined", recentlyJoinedIds],
    enabled: recentlyJoinedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, designation")
        .in("id", recentlyJoinedIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    queryClient.invalidateQueries({ queryKey: ["onboarding-employees"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  };

  const send = useMutation({
    mutationFn: (hire: PendingHire) => sendInvitation(hire.id),
    onSuccess: (result, hire) => {
      refresh();
      toast(
        result.status === "linked"
          ? { title: "Linked to an existing account", description: `${hire.email} already has an account, so ${hire.first_name} is now active.` }
          : { title: "Invitation sent", description: `${hire.first_name} will get an email at ${hire.email} to set up their account.` },
      );
    },
    onError: (error: Error) => toast({ title: "Invitation not sent", description: error.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (hire: PendingHire) => cancelInvitation(hire.id),
    onSuccess: (_result, hire) => {
      refresh();
      toast({ title: "Invitation cancelled", description: `Links sent to ${hire.email} no longer work. You can send a new one any time.` });
    },
    onError: (error: Error) => toast({ title: "Couldn't cancel the invitation", description: error.message, variant: "destructive" }),
  });

  if (isLoading || loadingInvites) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hires.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Everyone's set up</p>
              <p className="text-sm text-muted-foreground">New hires appear here until they accept their invitation.</p>
            </div>
            {canManage && onAddEmployee && <Button onClick={onAddEmployee}>Add employee</Button>}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Waiting to set up their account">
          {hires.map((hire) => {
            const state = inviteState(hire, invitations);
            const sending = send.isPending && send.variables?.id === hire.id;
            const canCancel = state.kind === "sent" || state.kind === "expired";
            return (
              <li key={hire.id} data-pending-hire>
                <Card>
                  <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(hire)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {hire.first_name} {hire.last_name}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[hire.designation, hire.departments?.name].filter(Boolean).join(" · ") || "No role set"}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{hire.email}</span>
                          </span>
                          {hire.hire_date && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" aria-hidden="true" />
                              Joins {format(parseISO(hire.hire_date), "MMM d, yyyy")}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="md:w-44">
                      <StatePill state={state} />
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {canManage && (
                        <Button size="sm" className="h-10 sm:h-9" onClick={() => send.mutate(hire)} disabled={sending}>
                          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
                          {state.kind === "not_sent" || state.kind === "cancelled" ? "Send invitation" : "Resend"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-10 sm:h-9" onClick={() => onOpenDetails(hire.id)}>
                        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                        Details
                      </Button>
                      {canManage && canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 text-red-700 hover:bg-red-50 hover:text-red-800 sm:h-9"
                          onClick={() => setToCancel(hire)}
                        >
                          <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                          Cancel invitation
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {recentlyJoined.length > 0 && (
        <section aria-labelledby="recently-joined-heading">
          <h2 id="recently-joined-heading" className="mb-3 text-sm font-semibold text-muted-foreground">
            Joined in the last 30 days
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentlyJoined.map((person) => {
              const invite = invitations.find((i) => i.employee_id === person.id && i.accepted_at);
              return (
                <li key={person.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {person.first_name} {person.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {person.designation}
                      {invite?.accepted_at ? ` · joined ${formatDistanceToNow(new Date(invite.accepted_at), { addSuffix: true })}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AlertDialog open={!!toCancel} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {toCancel?.first_name}'s invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Links already emailed to {toCancel?.email} will stop working. Their employee record stays here, and you can send a
              new invitation later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invitation</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toCancel) cancel.mutate(toCancel);
                setToCancel(null);
              }}
            >
              Cancel invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
