import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, PartyPopper } from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  // Invitation links land here with ?welcome=1: the new hire chooses their first password.
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    // Check if there's already a valid session (recovery token already processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords don't match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast(
        isWelcome
          ? { title: "You're all set", description: "Your account is ready. Sign in with your email and this password from now on." }
          : { title: "Password updated", description: "Your password has been reset successfully." },
      );
      navigate("/dashboard", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <Link to="/" className="mx-auto mb-4 block w-fit" aria-label="Peoplo home">
              <img src={hrHubLogo} alt="" className="h-12 w-auto" />
            </Link>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">{isWelcome ? "This invitation has expired" : "Invalid or expired link"}</h1>
            <CardDescription>
              {isWelcome
                ? "Invitation links work for 24 hours. Ask your HR team to send you a new one."
                : "This password reset link is invalid or has expired. Please request a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>Back to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 block w-fit" aria-label="Peoplo home">
              <img src={hrHubLogo} alt="" className="h-12 w-auto" />
            </Link>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {isWelcome ? (
              <PartyPopper className="h-6 w-6 text-primary" aria-hidden="true" />
            ) : (
              <Lock className="h-6 w-6 text-primary" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            {isWelcome ? "Welcome to Peoplo" : "Set a new password"}
          </h1>
          <CardDescription>
            {isWelcome
              ? "Choose a password to finish setting up your account. You'll use it with your work email to sign in."
              : "Enter your new password below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{isWelcome ? "Password" : "New password"}</Label>
              <Input id="new-password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>) : isWelcome ? "Set password and continue" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
