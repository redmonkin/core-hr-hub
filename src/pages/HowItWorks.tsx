import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Download,
  Settings,
  Users,
  Rocket,
  ArrowRight,
  Github,
  CheckCircle,
  Database,
  Server,
  Cloud
} from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const steps = [
  {
    number: "01",
    icon: <Download className="h-8 w-8" />,
    title: "Deploy or Sign Up",
    description: "Choose to self-host on your infrastructure or use our hosted solution. Either way, you're up and running in minutes.",
    details: [
      "One-click deployment to Vercel, Railway, or Docker",
      "Or sign up for our managed cloud option",
      "Full control over your data and infrastructure"
    ]
  },
  {
    number: "02",
    icon: <Settings className="h-8 w-8" />,
    title: "Configure Your Organization",
    description: "Set up your company structure, departments, leave policies, and customize settings to match your workflow.",
    details: [
      "Define departments and reporting structure",
      "Configure leave types and policies",
      "Set up payroll components and deductions"
    ]
  },
  {
    number: "03",
    icon: <Users className="h-8 w-8" />,
    title: "Add Your Team",
    description: "Import or add employees, assign roles and managers, and set up their profiles with all necessary information.",
    details: [
      "Bulk import employees via CSV",
      "Assign roles: Admin, HR, Manager, or Employee",
      "Set up employee profiles and documents"
    ]
  },
  {
    number: "04",
    icon: <Rocket className="h-8 w-8" />,
    title: "Start Managing",
    description: "Your team can now clock attendance, request leaves, track goals, and more. HR has full visibility and control.",
    details: [
      "Employees self-serve for common requests",
      "Managers approve and oversee their teams",
      "HR gets comprehensive dashboards and reports"
    ]
  }
];

const deployOptions = [
  {
    icon: <Server className="h-6 w-6" />,
    title: "Self-Hosted",
    description: "Deploy on your own servers with Docker or directly on any Node.js hosting."
  },
  {
    icon: <Cloud className="h-6 w-6" />,
    title: "Cloud Platforms",
    description: "One-click deploy to Vercel, Railway, Render, or any cloud platform."
  },
  {
    icon: <Database className="h-6 w-6" />,
    title: "Supabase Backend",
    description: "Uses Supabase for authentication, database, and storage — free tier available."
  }
];

const HowItWorks = () => {
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
            <Link to="/how-it-works" className="text-foreground font-medium">
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
          How Peoplo Works
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Get your HR system up and running in four simple steps. No complex setup required.
        </p>
      </section>

      {/* Steps */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="flex flex-col md:flex-row gap-6 items-start"
            >
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                  {step.number}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-2xl font-semibold">{step.title}</h3>
                </div>
                <p className="text-muted-foreground mb-4">{step.description}</p>
                <ul className="space-y-2">
                  {step.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Deployment Options */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Flexible Deployment</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            Choose how you want to run Peoplo. Your data, your rules.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {deployOptions.map((option, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border bg-card text-center"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  {option.icon}
                </div>
                <h3 className="font-semibold mb-2">{option.title}</h3>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to simplify your HR?</h2>
        <p className="text-muted-foreground mb-6">
          Start managing your workforce effectively today.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline" className="gap-2">
              <Github className="h-4 w-4" /> View on GitHub
            </Button>
          </a>
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

export default HowItWorks;
