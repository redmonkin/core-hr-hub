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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAndClose = () => {
    setOpen(false);
    setStep("email");
    setNewEmail("");
    setCode("");
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
      title: "Code Sent",
      description: `Enter the 6-digit code sent to ${result.data} to confirm the change.`,
    });
    setStep("code");
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({ title: "Error", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      email: newEmail,
      token: code,
      type: "email_change",
    });
    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
                We'll send a 6-digit code to your new address. Your login email won't change until you confirm it.
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
              <DialogTitle>Enter Confirmation Code</DialogTitle>
              <DialogDescription>Enter the 6-digit code sent to {newEmail}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("email")}>
                Back
              </Button>
              <Button onClick={handleVerifyCode} disabled={isSubmitting || code.length !== 6}>
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
