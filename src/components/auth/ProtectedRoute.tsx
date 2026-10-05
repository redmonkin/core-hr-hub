import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** Shown (inside the normal app shell) when someone without an employee profile opens a module. */
function NotOnboardedYet() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Not available yet</h1>
          <CardDescription className="pt-1">
            This page is for employees. It will open once HR links your account to your employee profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to dashboard
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

  // Everyone can open the dashboard; people without an employee profile see a
  // short explanation there
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
