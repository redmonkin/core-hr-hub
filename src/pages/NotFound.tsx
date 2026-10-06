import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex items-center px-4 py-3 sm:py-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Peoplo home">
            <img src={hrHubLogo} alt="" className="h-8 w-auto" />
            <span className="text-xl font-bold">Peoplo</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Error 404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
          <p className="mt-4 text-muted-foreground">
            We couldn't find <span className="break-all font-mono text-sm text-foreground">{location.pathname}</span>.
            It may have been moved, or the link may be mistyped.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? (
              <Button asChild className="gap-2">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Go to dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild className="gap-2">
                <Link to="/">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Go to home
                </Link>
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
