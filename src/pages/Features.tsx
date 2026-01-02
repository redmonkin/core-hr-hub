import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  BarChart3, 
  Shield, 
  Clock, 
  FileText,
  Package,
  CreditCard,
  Bell,
  Settings,
  Building2,
  Target,
  ArrowRight,
  Github
} from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const features = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Employee Management",
    description: "Comprehensive employee profiles with personal details, job information, documents, and organizational hierarchy."
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    title: "Department Structure",
    description: "Organize your company with departments and teams. Define reporting structures and manage organizational growth."
  },
  {
    icon: <Calendar className="h-6 w-6" />,
    title: "Leave Management",
    description: "Streamlined leave requests and approvals. Track different leave types, balances, and generate reports."
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Attendance Tracking",
    description: "Clock in/out functionality, attendance reports, and real-time presence tracking for your workforce."
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: "Payroll Processing",
    description: "Manage salary structures, allowances, deductions, and generate payslips for your employees."
  },
  {
    icon: <Package className="h-6 w-6" />,
    title: "Asset Management",
    description: "Track company assets, assignments, and maintenance schedules. Know who has what equipment."
  },
  {
    icon: <Target className="h-6 w-6" />,
    title: "Performance Reviews",
    description: "Set goals, conduct periodic reviews, and track employee progress with customizable review cycles."
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Analytics & Reports",
    description: "Comprehensive dashboards and exportable reports for leave balances, payroll summaries, and asset inventory."
  },
  {
    icon: <Bell className="h-6 w-6" />,
    title: "Notifications",
    description: "Email notifications for leave approvals, review schedules, goal reminders, and important updates."
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Document Management",
    description: "Secure storage for employee documents including contracts, certificates, and compliance documents."
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Role-Based Access",
    description: "Fine-grained permissions for admins, HR, managers, and employees. Control who sees what."
  },
  {
    icon: <Settings className="h-6 w-6" />,
    title: "Customizable Settings",
    description: "Configure leave types, working days, notification preferences, and more to fit your organization."
  }
];

const Features = () => {
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
            <Link to="/features" className="text-foreground font-medium">
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

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Everything You Need for HR
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A complete suite of HR tools designed to simplify your operations and empower your team.
        </p>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-all hover:border-primary/50"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">
            Join organizations using Peoplo to manage their workforce.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2">
                <Github className="h-4 w-4" /> View Source
              </Button>
            </a>
          </div>
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

export default Features;
