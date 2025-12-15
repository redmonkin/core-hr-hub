import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Calendar, FileText, Package } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  {
    label: "Add Employee",
    icon: <UserPlus className="h-5 w-5" />,
    href: "/onboarding",
    variant: "default" as const,
  },
  {
    label: "Request Leave",
    icon: <Calendar className="h-5 w-5" />,
    href: "/leaves",
    variant: "secondary" as const,
  },
  {
    label: "View Payroll",
    icon: <FileText className="h-5 w-5" />,
    href: "/payroll",
    variant: "secondary" as const,
  },
  {
    label: "Manage Assets",
    icon: <Package className="h-5 w-5" />,
    href: "/assets",
    variant: "secondary" as const,
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Link key={action.label} to={action.href}>
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
