import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import hrHubLogo from "@/assets/hr-hub-logo.svg";
import { isProductionDomain } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { DEMO_URL, PUBLIC_NAV_LINKS } from "./publicSite";

/** Shared sticky header for all public (logged-out) pages, with a mobile menu below md. */
const PublicHeader = () => {
  const isProduction = isProductionDomain();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav aria-label="Main" className="container mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Peoplo home">
          <img src={hrHubLogo} alt="" className="h-8 w-auto" />
          <span className="text-xl font-bold">Peoplo</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {PUBLIC_NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          {isProduction && (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                Request demo
              </a>
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 sm:max-w-xs" aria-describedby={undefined}>
              <SheetHeader className="text-left">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-1">
                {PUBLIC_NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "rounded-md px-3 py-2.5 text-base font-medium transition-colors hover:bg-accent",
                        isActive ? "bg-accent text-foreground" : "text-muted-foreground",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-2 border-t pt-6">
                <Button asChild className="w-full">
                  <Link to="/auth" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                {isProduction && (
                  <Button asChild variant="outline" className="w-full">
                    <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                      Request demo
                    </a>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
};

export default PublicHeader;
