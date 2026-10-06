import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Eye, Loader2, Mail, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type EmailPreview,
  type ExitReason,
  type ExitRecipients,
  previewChecklistEmail,
} from "@/hooks/useOffboarding";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string | null;
}

/** Employees who can receive the offboarding email (anyone not offboarded). */
function useRecipientDirectory() {
  return useQuery({
    queryKey: ["offboarding-recipient-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, designation")
        .neq("status", "offboarded")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });
}

interface OffboardingEmailFieldsProps {
  /** The person leaving: never offered as a recipient. */
  employeeId: string;
  reason: ExitReason;
  lastWorkingDay: string;
  recipients: ExitRecipients;
  onRecipientsChange: (recipients: ExitRecipients) => void;
  note: string;
  onNoteChange: (note: string) => void;
  idPrefix: string;
}

/**
 * "Email the offboarding checklist to" picker (employees + outside addresses),
 * an optional note for the email, and a preview of exactly what will be sent.
 */
export function OffboardingEmailFields({
  employeeId,
  reason,
  lastWorkingDay,
  recipients,
  onRecipientsChange,
  note,
  onNoteChange,
  idPrefix,
}: OffboardingEmailFieldsProps) {
  const { data: people = [] } = useRecipientDirectory();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const candidates = people.filter((p) => p.id !== employeeId);
  const byId = new Map(people.map((p) => [p.id, p]));
  const selected = new Set(recipients.employeeIds);
  const total = recipients.employeeIds.length + recipients.emails.length;

  const toggle = (id: string) =>
    onRecipientsChange({
      ...recipients,
      employeeIds: selected.has(id) ? recipients.employeeIds.filter((x) => x !== id) : [...recipients.employeeIds, id],
    });

  const addEmail = () => {
    const email = emailDraft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (!recipients.emails.includes(email)) {
      onRecipientsChange({ ...recipients, emails: [...recipients.emails, email] });
    }
    setEmailDraft("");
    setEmailError(null);
  };

  const showPreview = async () => {
    if (!lastWorkingDay) {
      toast.error("Choose the last working day first");
      return;
    }
    setPreviewing(true);
    try {
      setPreview(await previewChecklistEmail({ employeeId, reason, lastWorkingDay, emailNote: note, recipients }));
    } catch (e) {
      toast.error("Couldn't build the preview", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Email the offboarding checklist</p>
          <p className="text-xs text-muted-foreground">
            Sent now with the department-wise checklist, and again as a reminder on the last working day. Replies come
            to you.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-recipients`}>To</Label>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
          <PopoverTrigger asChild>
            <Button
              id={`${idPrefix}-recipients`}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              className="w-full justify-between font-normal"
            >
              <span className="truncate text-muted-foreground">Add people from your team…</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search people…" />
              <CommandList>
                <CommandEmpty>Nobody found.</CommandEmpty>
                <CommandGroup>
                  {candidates.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.first_name} ${p.last_name} ${p.email} ${p.designation ?? ""}`}
                      onSelect={() => toggle(p.id)}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", selected.has(p.id) ? "opacity-100" : "opacity-0")}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {p.first_name} {p.last_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.designation ? `${p.designation} · ` : ""}
                          {p.email}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex gap-2">
          <Label htmlFor={`${idPrefix}-outside-email`} className="sr-only">
            Outside email address
          </Label>
          <Input
            id={`${idPrefix}-outside-email`}
            type="email"
            value={emailDraft}
            onChange={(e) => {
              setEmailDraft(e.target.value);
              setEmailError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addEmail();
              }
            }}
            placeholder="Or add an email address"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? `${idPrefix}-outside-email-error` : undefined}
          />
          <Button type="button" variant="outline" onClick={addEmail} aria-label="Add email address">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="ml-2 hidden sm:inline">Add</span>
          </Button>
        </div>
        {emailError && (
          <p id={`${idPrefix}-outside-email-error`} className="text-xs text-destructive">
            {emailError}
          </p>
        )}

        {total > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Recipients">
            {recipients.employeeIds.map((id) => {
              const p = byId.get(id);
              const name = p ? `${p.first_name} ${p.last_name}` : "Employee";
              return (
                <li key={id}>
                  <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 font-normal">
                    {name}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="rounded-full p-0.5 hover:bg-background/70"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Badge>
                </li>
              );
            })}
            {recipients.emails.map((email) => (
              <li key={email}>
                <Badge variant="outline" className="gap-1 py-1 pl-2.5 pr-1 font-normal">
                  {email}
                  <button
                    type="button"
                    onClick={() =>
                      onRecipientsChange({ ...recipients, emails: recipients.emails.filter((e) => e !== email) })
                    }
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Nobody yet. Without recipients, no email is sent.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email-note`}>Note in the email</Label>
        <Textarea
          id={`${idPrefix}-email-note`}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional, e.g. They'll hand over the laptop on their last day; please confirm separately once received."
          maxLength={2000}
          rows={2}
        />
      </div>

      <Button type="button" variant="outline" size="sm" onClick={showPreview} disabled={previewing}>
        {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" aria-hidden="true" />}
        Preview email
      </Button>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.subject}</DialogTitle>
            <DialogDescription>
              To: {preview?.to.length ? preview.to.join(", ") : "nobody yet"}
              {preview?.reply_to ? ` · Replies to ${preview.reply_to}` : ""}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={preview.html}
              className="h-[60vh] w-full rounded-md border bg-white"
            />
          )}
          <DialogFooter>
            <Button onClick={() => setPreview(null)}>Close preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
