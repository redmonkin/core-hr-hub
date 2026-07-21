import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailDomainAllowed } from "@/lib/domainWhitelist";

const emailSchema = z.string().trim().email("Please enter a valid email address");

interface ChangeEmailDialogProps {
  currentEmail: string;
}

export function ChangeEmailDialog({ currentEmail }: ChangeEmailDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const result = emailSchema.safeParse(newEmail);
    if (!result.success) {
      toast({ title: "Error", description: result.error.errors[0].message, variant: "destructive" });
      return;
    }

    if (result.data.toLowerCase() === currentEmail.toLowerCase()) {
      toast({ title: "Error", description: "That's already your current email.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const domainCheck = await checkEmailDomainAllowed(result.data);
    if (!domainCheck.allowed) {
      setIsSubmitting(false);
      toast({ title: "Domain Not Allowed", description: domainCheck.message, variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: result.data });
    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Confirmation Sent",
      description: "Check your inbox to confirm the new address. Your email won't change until you confirm.",
    });
    setOpen(false);
    setNewEmail("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          Change Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Email Address</DialogTitle>
          <DialogDescription>
            We'll send a confirmation link to your new address. Your login email won't change until you confirm it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Current Email</Label>
            <Input value={currentEmail} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New Email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !newEmail}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
