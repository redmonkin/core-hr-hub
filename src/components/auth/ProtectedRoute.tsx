import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboardingRequest } from "@/hooks/useOnboardingRequest";
import { ArrowLeft, Clock, Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** Shown (inside the normal app shell) when an invited, not-yet-onboarded user opens a module. */
function NotOnboardedYet() {
  const { request, isLoading } = useOnboardingRequest();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  const status = request?.status;
  const copy =
    status === "pending"
      ? {
          icon: <Clock className="h-8 w-8 text-amber-700" aria-hidden="true" />,
          tint: "bg-amber-500/10",
          title: "Your onboarding request is being reviewed",
          body: "You'll get access to this page once HR approves your onboarding request. There's nothing else you need to do right now.",
          cta: "View request status",
        }
      : status === "approved"
        ? {
            icon: <Clock className="h-8 w-8 text-primary" aria-hidden="true" />,
            tint: "bg-primary/10",
            title: "Your account is almost ready",
            body: "HR has approved your request and is finishing your setup. This page will be available as soon as your employee profile is active.",
            cta: "Back to dashboard",
          }
        : status === "rejected"
          ? {
              icon: <ShieldX className="h-8 w-8 text-destructive" aria-hidden="true" />,
              tint: "bg-destructive/10",
              title: "You don't have access to this page",
              body: "Your onboarding request wasn't approved. Please contact HR for more information.",
              cta: "Back to dashboard",
            }
          : {
              icon: <ShieldX className="h-8 w-8 text-destructive" aria-hidden="true" />,
              tint: "bg-destructive/10",
              title: "Finish onboarding to continue",
              body: "This page is available to employees. Submit your onboarding request from the dashboard and HR will set up your access.",
              cta: "Complete onboarding request",
            };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${copy.tint}`}>
            {copy.icon}
          </div>
          <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{copy.title}</h1>
          <CardDescription className="pt-1">{copy.body}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {copy.cta}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { data: employeeStatus, isLoading: isEmployeeLoading } = useEmployeeStatus();
  const { hasAnyModuleAccess, isLoading: isRoleLoading } = usePermissions();
  const isEmployee = employeeStatus?.isEmployee ?? false;

  if (isLoading || isEmployeeLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow access to dashboard for everyone (invited users who haven't been
  // onboarded yet see the onboarding request form there)
  const isDashboard = location.pathname === "/dashboard";

  // Users without an employee record can only use the app if they've been
  // given access to a module (e.g. an external accountant with payroll access)
  if (!isEmployee && !hasAnyModuleAccess && !isDashboard) {
    return (
      <DashboardLayout>
        <NotOnboardedYet />
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
