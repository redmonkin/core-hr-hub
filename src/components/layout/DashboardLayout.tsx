import { ReactNode, useEffect, useState } from "react";
import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmployeeStatus } from "@/hooks/useEmployeeStatus";
import { AppModule, Permissions, canAccessReports, canAccessSettings, hasModuleAccess } from "@/lib/permissions";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { REPO_URL } from "@/lib/site";
import {
  Users,
  Calendar,
  Package,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  UserPlus,
  ClipboardList,
  ChevronDown,
  Target,
  BarChart3,
  Clock,
  Building2,
  CalendarDays,
  Bell,
  User,
  Sparkles,
  Receipt,
} from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";
import { APP_VERSION, isAutoUpdatingEnvironment } from "@/lib/version";
import { useVersionCheck } from "@/hooks/useVersionCheck";
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
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  /** Shown only to users who pass this check; omitted = everyone (self-service). */
  visible?: (perms: Permissions) => boolean;
}

const canView = (module: AppModule) => (perms: Permissions) => hasModuleAccess(perms, module, "view");

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <Home className="h-5 w-5" /> },
  { label: "Employees", href: "/employees", icon: <Users className="h-5 w-5" />, visible: canView("employees") },
  { label: "Team Directory", href: "/employees", icon: <Users className="h-5 w-5" />, visible: (p) => !hasModuleAccess(p, "employees") },
  { label: "Departments", href: "/departments", icon: <Building2 className="h-5 w-5" />, visible: canView("employees") },
  { label: "Onboarding", href: "/onboarding", icon: <UserPlus className="h-5 w-5" />, visible: canView("onboarding") },
  { label: "Attendance", href: "/attendance", icon: <Clock className="h-5 w-5" /> },
  { label: "Calendar", href: "/calendar", icon: <CalendarDays className="h-5 w-5" /> },
  { label: "Leaves", href: "/leaves", icon: <Calendar className="h-5 w-5" /> },
  { label: "Reimbursements", href: "/reimbursements", icon: <Receipt className="h-5 w-5" /> },
  { label: "Performance", href: "/performance", icon: <Target className="h-5 w-5" /> },
  { label: "Assets", href: "/assets", icon: <Package className="h-5 w-5" />, visible: canView("assets") },
  { label: "Payroll", href: "/payroll", icon: <CreditCard className="h-5 w-5" />, visible: canView("payroll") },
  { label: "Reports", href: "/reports", icon: <ClipboardList className="h-5 w-5" />, visible: canAccessReports },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, visible: canAccessSettings },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isSigningOut } = useAuth();
  const permissions = usePermissions();
  const showSettings = canAccessSettings(permissions);
  const { data: versionData } = useVersionCheck();
  const { data: branding } = useCompanyBranding();

  const { data: employeeStatus } = useEmployeeStatus();
  // Invited people who aren't linked to an employee record yet and have no module
  // access can only use the dashboard (where they finish onboarding).
  const isPendingInvitee = employeeStatus?.isEmployee === false && !permissions.hasAnyModuleAccess;
  const filteredNavItems = isPendingInvitee
    ? navItems.filter((item) => item.href === "/dashboard")
    : navItems.filter((item) => !item.visible || item.visible(permissions));

  // Close the mobile menu whenever the page changes, however that happens
  // (menu link, back/forward, a link in the page, a redirect).
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.key]);

  // While the mobile menu is open: Escape closes it and the page behind
  // doesn't scroll.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);
  
  // For auto-updating environments, show the latest version from GitHub
  // For self-hosted: if there's no update (up to date), show the latest from GitHub
  // Otherwise show the local APP_VERSION
  const displayVersion = isAutoUpdatingEnvironment() 
    ? (versionData?.currentVersion ?? APP_VERSION)
    : (versionData?.hasUpdate ? APP_VERSION : (versionData?.currentVersion ?? APP_VERSION));

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
          "fixed left-0 top-0 z-50 h-full w-72 transform border-r border-border bg-card transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center justify-between border-b border-border px-6">
            <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
              <img src={branding?.iconUrl || hrHubLogo} alt="Peoplo" className="h-10 w-auto" />
              <span className="text-xl font-bold text-foreground">Peoplo</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
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
            <Link
              to="/profile"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{getUserName()}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </Link>
            {/* Version info, and the source link AGPL-3.0 §13 asks network services to offer */}
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Link
                to="/changelog"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <span>v{displayVersion}</span>
                <span className="text-border">•</span>
                <span className="hover:underline">What's New</span>
              </Link>
              <span className="text-border">•</span>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground hover:underline"
              >
                Source code
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 overflow-x-clip lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground lg:text-xl">
                {new Date().toLocaleDateString("en-US", { weekday: "long" })}
              </h1>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <NotificationBell />

            {/* Settings - only for people who can manage something there */}
            {showSettings && (
              <Button variant="ghost" size="icon" asChild>
                <Link to="/settings" aria-label="Settings">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            )}

            {/* User menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3" aria-label="Account menu">
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
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/notification-preferences">
                    <Bell className="mr-2 h-4 w-4" />
                    Notification Preferences
                  </Link>
                </DropdownMenuItem>
                {showSettings && (
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/changelog">
                    <Sparkles className="mr-2 h-4 w-4" />
                    What's New
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleSignOut} disabled={isSigningOut}>
                  {isSigningOut ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="mr-2 h-4 w-4" />
                  )}
                  {isSigningOut ? "Logging out..." : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>

      <PWAInstallBanner />
    </div>
  );
}
