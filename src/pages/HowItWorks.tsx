import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Download,
  Settings,
  Users,
  Rocket,
  CheckCircle,
  Database,
  Server,
  Cloud,
  Sparkles
} from "lucide-react";
import Footer from "@/components/layout/Footer";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicCtaSection from "@/components/layout/PublicCtaSection";
import PublicPageBadge from "@/components/layout/PublicPageBadge";

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
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 py-20 lg:py-28 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <PublicPageBadge icon={<Sparkles />}>Simple setup</PublicPageBadge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Get Started in{" "}
              <span className="text-primary">Four Simple Steps</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              No complex setup required. Get your HR system up and running quickly 
              with our streamlined onboarding process.
            </p>
          </div>
        </div>
      </section>

      {/* Steps Timeline */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <ol className="space-y-10 md:space-y-12">
              {steps.map((step, index) => (
                <li key={step.number} className="relative flex flex-col gap-4 md:flex-row md:gap-8">
                  {/* Timeline connector: runs between the step chips, never through the cards */}
                  {index < steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="absolute left-8 top-20 -bottom-10 hidden w-0.5 -translate-x-1/2 bg-gradient-to-b from-primary/50 to-primary/10 md:block"
                    />
                  )}

                  {/* Step number */}
                  <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-lg md:h-16 md:w-16 md:rounded-2xl md:text-2xl">
                    <span className="sr-only">Step </span>
                    {step.number}
                  </div>

                  {/* Content Card */}
                  <Card className="flex-1 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                    <CardContent className="p-6 md:p-8">
                      <div className="mb-3 flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5"
                        >
                          {step.icon}
                        </div>
                        <h3 className="text-xl font-bold md:text-3xl">{step.title}</h3>
                      </div>
                      <p className="mb-6 text-base leading-relaxed text-muted-foreground md:text-lg">
                        {step.description}
                      </p>
                      <ul className="space-y-3">
                        {step.details.map((detail) => (
                          <li key={detail} className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                            </div>
                            <span className="text-foreground">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Deployment Options */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Deployment</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Flexible Deployment Options</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose how you want to run Peoplo. Your data, your rules, your infrastructure.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {deployOptions.map((option, index) => (
              <Card 
                key={index}
                className="text-center hover:shadow-lg transition-all duration-300 hover:border-primary/30"
              >
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-5">
                    {option.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-3">{option.title}</h3>
                  <p className="text-muted-foreground">{option.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <PublicCtaSection
        title="Ready to simplify your HR?"
        description="Start managing your workforce effectively today. Get started in minutes — no credit card required."
      />

      <Footer />
    </div>
  );
};

export default HowItWorks;
