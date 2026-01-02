import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  BarChart3, 
  Shield, 
  Clock, 
  FileText,
  ArrowRight,
  CheckCircle,
  Github
} from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={hrHubLogo} alt="Peoplo" className="h-8 w-auto" />
            <span className="text-xl font-bold">Peoplo</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link to="/features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <Github className="h-4 w-4" />
            Open Source HR Management
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Simplify Your{" "}
            <span className="text-primary">HR Operations</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A comprehensive, open-source HR management system that helps you manage employees, 
            track attendance, process payroll, and more — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2">
                <Github className="h-4 w-4" /> View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="h-8 w-8" />,
              title: "Employee Management",
              description: "Manage employee records, onboarding, and organizational structure effortlessly."
            },
            {
              icon: <Calendar className="h-8 w-8" />,
              title: "Leave & Attendance",
              description: "Track attendance, manage leave requests, and maintain accurate time records."
            },
            {
              icon: <BarChart3 className="h-8 w-8" />,
              title: "Performance Reviews",
              description: "Set goals, conduct reviews, and track employee growth over time."
            }
          ].map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="h-14 w-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "100%", label: "Open Source" },
              { value: "Free", label: "Self-Hosted" },
              { value: "24/7", label: "Your Data, Your Control" },
              { value: "∞", label: "Unlimited Users" }
            ].map((stat, index) => (
              <div key={index}>
                <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to streamline your HR?
          </h2>
          <p className="text-muted-foreground text-lg">
            Get started today and experience the power of open-source HR management.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={hrHubLogo} alt="Peoplo" className="h-6 w-auto" />
              <span className="font-semibold">Peoplo</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link to="/features" className="hover:text-foreground">Features</Link>
              <Link to="/how-it-works" className="hover:text-foreground">How It Works</Link>
              <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Peoplo. Open Source.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
