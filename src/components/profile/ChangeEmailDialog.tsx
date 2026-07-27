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
  const [step, setStep] = useState<"email" | "code">("email");
  const [newEmail, setNewEmail] = useState("");
  const [currentEmailCode, setCurrentEmailCode] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAndClose = () => {
    setOpen(false);
    setStep("email");
    setNewEmail("");
    setCurrentEmailCode("");
    setNewEmailCode("");
  };

  const handleSendCode = async () => {
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
      title: "Codes Sent",
      description: `Check both ${currentEmail} and ${result.data} — each got a different code, and both are needed to confirm the change.`,
    });
    setStep("code");
  };

  const handleVerifyCode = async () => {
    if (!currentEmailCode.trim() || !newEmailCode.trim()) {
      toast({
        title: "Error",
        description: "Enter both codes — one from your current email, one from your new email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { error: currentError } = await supabase.auth.verifyOtp({
      email: currentEmail,
      token: currentEmailCode,
      type: "email_change",
    });

    if (currentError) {
      setIsSubmitting(false);
      toast({
        title: "Error confirming current email",
        description: currentError.message,
        variant: "destructive",
      });
      return;
    }

    const { error: newError } = await supabase.auth.verifyOtp({
      email: newEmail,
      token: newEmailCode,
      type: "email_change",
    });
    setIsSubmitting(false);

    if (newError) {
      toast({ title: "Error confirming new email", description: newError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Email Updated", description: "Your email address has been changed." });
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          Change Email
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === "email" ? (
          <>
            <DialogHeader>
              <DialogTitle>Change Email Address</DialogTitle>
              <DialogDescription>
                We'll send confirmation codes to your current and new address. Your login email won't change until
                you confirm both.
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
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button onClick={handleSendCode} disabled={isSubmitting || !newEmail}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Code
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enter Confirmation Codes</DialogTitle>
              <DialogDescription>
                Two different codes were sent — one to your current email, one to your new email. Enter both to
                confirm the change.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="current-email-code">Code from {currentEmail}</Label>
                <Input
                  id="current-email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={currentEmailCode}
                  onChange={(e) => setCurrentEmailCode(e.target.value)}
                  placeholder="Enter code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email-code">Code from {newEmail}</Label>
                <Input
                  id="new-email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={newEmailCode}
                  onChange={(e) => setNewEmailCode(e.target.value)}
                  placeholder="Enter code"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("email")}>
                Back
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={isSubmitting || !currentEmailCode.trim() || !newEmailCode.trim()}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
