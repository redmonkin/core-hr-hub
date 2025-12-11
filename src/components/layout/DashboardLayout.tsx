import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdminOrHR } from "@/hooks/useUserRole";
import {
  Users,
  Calendar,
  Package,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  UserPlus,
  ClipboardList,
  ChevronDown,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <Home className="h-5 w-5" /> },
  { label: "Employees", href: "/employees", icon: <Users className="h-5 w-5" /> },
  { label: "Onboarding", href: "/onboarding", icon: <UserPlus className="h-5 w-5" />, adminOnly: true },
  { label: "Leave Management", href: "/leaves", icon: <Calendar className="h-5 w-5" /> },
  { label: "Leave Approvals", href: "/leave-approvals", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Performance", href: "/performance", icon: <Target className="h-5 w-5" /> },
  { label: "Reviews", href: "/reviews-management", icon: <ClipboardList className="h-5 w-5" />, adminOnly: true },
  { label: "Assets", href: "/assets", icon: <Package className="h-5 w-5" /> },
  { label: "Payroll", href: "/payroll", icon: <CreditCard className="h-5 w-5" />, adminOnly: true },
  { label: "Reports", href: "/reports", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, adminOnly: true },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdminOrHR } = useIsAdminOrHR();

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdminOrHR);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getUserInitials = () => {
    const name = user?.user_metadata?.full_name || user?.email || "User";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getUserName = () => {
    return user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-72 transform bg-card shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between border-b border-border px-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">HRMS Pro</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="space-y-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant={isActive ? "secondary" : "default"}
                          className="h-6 min-w-6 justify-center"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{getUserName()}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground lg:text-xl">
                {navItems.find((item) => item.href === location.pathname)?.label || "Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">Leave Request</span>
                  <span className="text-xs text-muted-foreground">
                    Sarah Miller requested annual leave
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">Payroll Generated</span>
                  <span className="text-xs text-muted-foreground">
                    December payroll has been processed
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                  <span className="font-medium">New Employee</span>
                  <span className="text-xs text-muted-foreground">
                    Mike Johnson joined Engineering team
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings - only show for admin/HR */}
            {isAdminOrHR && (
              <Button variant="ghost" size="icon" asChild>
                <Link to="/settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                {isAdminOrHR && (
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Settings</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
