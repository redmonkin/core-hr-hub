import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProtectedRouteProps {
  children: React.ReactNode;
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have access to this module. Please complete your onboarding request first.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
