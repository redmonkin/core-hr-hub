import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, ArrowRight, Code2, Lock, Mail, ShieldCheck } from "lucide-react";
import { z } from "zod";
import hrHubLogo from "@/assets/hr-hub-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { Backdrop } from "@/components/landing/Backdrop";
import { HeroScene } from "@/components/landing/HeroScene";
import { DEMO_URL } from "@/components/layout/publicSite";
import { REPO_URL } from "@/lib/site";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[`login_${err.path[0]}`] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      } else if (error.message.includes("Email not confirmed")) {
        toast({
          title: "Email Not Verified",
          description: "Please check your email and verify your account first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast({ title: "Error", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Check your email for the password reset link." });
      setShowForgotPassword(false);
    }
  };

  const trust = [
    { icon: Code2, text: "Open source under AGPL-3.0" },
    { icon: ShieldCheck, text: "Access rules enforced in the database" },
    { icon: Lock, text: "Invite-only accounts" },
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      <Backdrop />

      <header className="container relative z-10 mx-auto flex items-center justify-between px-4 py-5">
        <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Peoplo home">
          <img src={hrHubLogo} alt="" className="h-9 w-auto" />
          <span className="text-xl font-bold tracking-tight text-foreground">Peoplo</span>
        </Link>
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>
              Back<span className="hidden sm:inline"> to home</span>
            </span>
          </Link>
        </Button>
      </header>

      <main className="container relative z-10 mx-auto grid flex-1 items-center gap-12 px-4 pb-10 pt-2 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-16">
        {/* Brand side (large screens) */}
        <section className="hidden lg:block" aria-label="About Peoplo">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Free &amp; open source · AGPL-3.0
          </a>
          <h2
            className="mb-4 animate-fade-up text-4xl font-bold tracking-tight text-foreground xl:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            Your team's HR,
            <br />
            <span className="text-shimmer animate-shimmer motion-reduce:animate-none">all in one place.</span>
          </h2>
          <p
            className="max-w-lg animate-fade-up text-lg text-muted-foreground"
            style={{ animationDelay: "160ms" }}
          >
            People, attendance, leave, payroll and performance, with access you control down to each module.
          </p>
          <div className="mt-16 max-w-xl animate-fade-up pl-14 pr-12" style={{ animationDelay: "220ms" }}>
            <HeroScene />
          </div>
        </section>

        {/* Sign-in card */}
        <section className="mx-auto w-full max-w-md animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="rounded-2xl border border-border/80 bg-card/85 p-6 shadow-xl shadow-primary/10 backdrop-blur-md sm:p-8">
            <div className="mb-6 space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {showForgotPassword ? "Reset your password" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {showForgotPassword
                  ? "Enter your work email and we'll send you a link to set a new password."
                  : "Sign in to your Peoplo workspace."}
              </p>
            </div>

            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Work email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="h-11 w-full shadow-lg shadow-primary/20" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full gap-2"
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Work email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                    className="h-11"
                    aria-invalid={!!errors.login_email}
                    aria-describedby={errors.login_email ? "login-email-error" : undefined}
                  />
                  {errors.login_email && (
                    <p id="login-email-error" className="text-sm text-destructive">{errors.login_email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => { setShowForgotPassword(true); setResetEmail(loginEmail); }}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                      className="h-11 pr-11"
                      aria-invalid={!!errors.login_password}
                      aria-describedby={errors.login_password ? "login-password-error" : undefined}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      aria-pressed={showLoginPassword}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {errors.login_password && (
                    <p id="login-password-error" className="text-sm text-destructive">{errors.login_password}</p>
                  )}
                </div>
                <Button type="submit" className="group h-11 w-full gap-2 shadow-lg shadow-primary/20" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 flex gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Accounts are by invitation.</span> Joining the team? Your
                HR will email you a link to set up your account.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Want Peoplo for your company?{" "}
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Book a demo
            </a>
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            {trust.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          <p>© {new Date().getFullYear()} Peoplo</p>
        </div>
      </footer>
    </div>
  );
};

export default Auth;

