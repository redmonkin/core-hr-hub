import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Calendar, FileText, Package, Target, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { AppModule, PermissionLevel } from "@/lib/permissions";

const adminActions: {
  label: string;
  icon: JSX.Element;
  href: string;
  variant: "default" | "secondary";
  requires: [AppModule, PermissionLevel];
}[] = [
  {
    label: "Add Employee",
    icon: <UserPlus className="h-5 w-5" />,
    href: "/onboarding",
    variant: "default" as const,
    requires: ["onboarding", "manage"],
  },
  {
    label: "Manage Assets",
    icon: <Package className="h-5 w-5" />,
    href: "/assets",
    variant: "secondary" as const,
    requires: ["assets", "view"],
  },
  {
    label: "View Payroll",
    icon: <FileText className="h-5 w-5" />,
    href: "/payroll",
    variant: "secondary" as const,
    requires: ["payroll", "view"],
  },
];

const employeeActions = [
  {
    label: "Request Leave",
    icon: <Calendar className="h-5 w-5" />,
    href: "/leaves",
    variant: "default" as const,
  },
  {
    label: "My Goals",
    icon: <Target className="h-5 w-5" />,
    href: "/performance",
    variant: "secondary" as const,
  },
  {
    label: "View Attendance",
    icon: <ClipboardList className="h-5 w-5" />,
    href: "/attendance",
    variant: "secondary" as const,
  },
];

export function QuickActions() {
  const { can, isLoading } = usePermissions();

  const allowedAdminActions = adminActions.filter((a) => can(...a.requires));
  const actions = allowedAdminActions.length > 0 ? allowedAdminActions : employeeActions;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Link key={action.label} to={action.href} className={index < actions.length - 1 ? "mb-2 block" : "block"}>
            <Button
              variant={action.variant}
              className="w-full justify-start gap-3"
            >
              {action.icon}
              <span>{action.label}</span>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
