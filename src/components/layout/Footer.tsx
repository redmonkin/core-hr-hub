import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import logo from "@/assets/hr-hub-logo.svg";
import { CONTRIBUTING_URL, ISSUES_URL, LICENSE_URL, REPO_URL, SECURITY_POLICY_URL, SELF_HOST_GUIDE_URL } from "@/lib/site";

const linkClass = "inline-block py-1 transition-colors hover:text-foreground";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

const Footer = () => {
  return (
    <footer className="border-t bg-card/60">
      <div className="container mx-auto grid grid-cols-2 gap-8 px-4 py-14 md:grid-cols-5">
        <div className="col-span-2">
          <Link to="/" className="mb-3 inline-flex items-center gap-2.5" aria-label="Peoplo home">
            <img src={logo} alt="" className="h-8 w-auto" />
            <span className="text-lg font-semibold text-foreground">Peoplo</span>
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            Open-source HR for growing teams: people, attendance, leave, payroll and performance. Host it yourself or let us run it.
          </p>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Licensed under AGPL-3.0
          </a>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Product</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link to="/features" className={linkClass}>Features</Link></li>
            <li><Link to="/how-it-works" className={linkClass}>How it works</Link></li>
            <li><Link to="/pricing" className={linkClass}>Pricing</Link></li>
            <li><Link to="/security" className={linkClass}>Security</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Open source</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><ExternalLink href={REPO_URL}>GitHub</ExternalLink></li>
            <li><ExternalLink href={SELF_HOST_GUIDE_URL}>Self-hosting guide</ExternalLink></li>
            <li><ExternalLink href={CONTRIBUTING_URL}>Contributing</ExternalLink></li>
            <li><ExternalLink href={ISSUES_URL}>Report an issue</ExternalLink></li>
            <li><ExternalLink href={SECURITY_POLICY_URL}>Security policy</ExternalLink></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link to="/privacy-policy" className={linkClass}>Privacy policy</Link></li>
            <li><Link to="/terms-of-service" className={linkClass}>Terms of service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} Peoplo by Redmonk. Open source under the{" "}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              AGPL-3.0
            </a>{" "}
            license.
          </p>
          <p className="flex items-center gap-1.5">
            Made with <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
            <span className="sr-only">love</span> in the open
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
