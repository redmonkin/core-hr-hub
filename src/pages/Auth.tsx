import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Users, Calendar, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { z } from "zod";
import hrHubLogo from "@/assets/hr-hub-logo.svg";
import hrHubLogoLight from "@/assets/hr-hub-logo-light.svg";
import { supabase } from "@/integrations/supabase/client";

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

  const features = [
    { icon: <Users className="h-5 w-5" />, text: "Employee Management" },
    { icon: <Calendar className="h-5 w-5" />, text: "Leave Tracking" },
    { icon: <Shield className="h-5 w-5" />, text: "Role-Based Access" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div>
          <Link to="/" className="inline-flex items-center gap-3" aria-label="Peoplo home">
            <img src={hrHubLogoLight} alt="" className="h-12 w-auto" />
            <span className="text-3xl font-bold">Peoplo</span>
          </Link>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Streamline Your HR Operations
          </h2>
          <p className="text-lg">
            Manage employees, track leaves, handle payroll, and more — all in one powerful platform.
          </p>
          <div className="space-y-4">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="rounded-lg bg-primary-foreground/10 p-2" aria-hidden="true">
                  {feature.icon}
                </div>
                <span className="text-lg">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-primary-foreground/90">
          © {new Date().getFullYear()} Peoplo. All rights reserved.
        </p>
      </div>

      {/* Right side - Auth Forms */}
      <div className="flex w-full flex-col bg-background p-4 sm:p-6 lg:w-1/2">
        <div className="w-full">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center py-6">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <Link to="/" className="mx-auto mb-4 lg:hidden" aria-label="Peoplo home">
              <img src={hrHubLogo} alt="" className="h-12 w-auto" />
            </Link>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">
              {showForgotPassword ? "Reset your password" : "Welcome to Peoplo"}
            </h1>
            <CardDescription>
              {showForgotPassword
                ? "Enter your work email and we'll send you a link to set a new password."
                : "Sign in to your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
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
                  className="w-full gap-2"
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to sign in
                </Button>
              </form>
            ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={isLoading}
                  aria-invalid={!!errors.login_email}
                />
                {errors.login_email && (
                  <p className="text-sm text-destructive">{errors.login_email}</p>
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
                    className="pr-10"
                    aria-invalid={!!errors.login_password}
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
                  <p className="text-sm text-destructive">{errors.login_password}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Accounts are by invitation only. If you're joining the team, ask HR to send you an invite.
            </p>
          </CardContent>
        </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground lg:hidden">
          © {new Date().getFullYear()} Peoplo. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Auth;

