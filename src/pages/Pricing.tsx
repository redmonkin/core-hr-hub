import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Check,
  ArrowRight,
  Github,
  Server,
  Cloud,
  Zap,
  HeartHandshake
} from "lucide-react";
import hrHubLogo from "@/assets/hr-hub-logo.svg";

const plans = [
  {
    name: "Open Source",
    price: "Free",
    description: "Self-host on your own infrastructure. Full access to all features.",
    icon: <Github className="h-6 w-6" />,
    features: [
      "Unlimited employees",
      "All core features included",
      "Full source code access",
      "Community support",
      "Deploy anywhere",
      "Your data, your servers"
    ],
    cta: "View on GitHub",
    ctaLink: "https://github.com",
    variant: "outline" as const,
    highlight: false
  },
  {
    name: "Cloud Hosted",
    price: "₹499",
    period: "/month",
    description: "We handle hosting, updates, and backups. You focus on your business.",
    icon: <Cloud className="h-6 w-6" />,
    features: [
      "Up to 50 employees",
      "All core features included",
      "Automatic updates",
      "Daily backups",
      "Email support",
      "99.9% uptime SLA"
    ],
    cta: "Start Free Trial",
    ctaLink: "/auth",
    variant: "default" as const,
    highlight: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For larger organizations with specific needs and requirements.",
    icon: <Zap className="h-6 w-6" />,
    features: [
      "Unlimited employees",
      "Priority support",
      "Custom integrations",
      "Dedicated infrastructure",
      "SSO & advanced security",
      "Onboarding assistance"
    ],
    cta: "Contact Sales",
    ctaLink: "/auth",
    variant: "outline" as const,
    highlight: false
  }
];

const faqs = [
  {
    question: "Is Peoplo really free?",
    answer: "Yes! Peoplo is 100% open source. You can self-host it on your own infrastructure at no cost. The cloud-hosted option is a paid service for those who prefer managed hosting."
  },
  {
    question: "Can I migrate from self-hosted to cloud?",
    answer: "Absolutely. We provide migration tools to help you move your data between self-hosted and cloud-hosted versions seamlessly."
  },
  {
    question: "What's included in the free trial?",
    answer: "The 14-day free trial includes full access to all Cloud Hosted features. No credit card required to start."
  },
  {
    question: "Do you offer discounts for NGOs?",
    answer: "Yes! Non-profits and educational institutions get 50% off all paid plans. Contact us to apply."
  }
];

const Pricing = () => {
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
            <Link to="/pricing" className="text-foreground font-medium">
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
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
          <HeartHandshake className="h-4 w-4" />
          Open Source First
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Free forever for self-hosted. Affordable cloud hosting for those who prefer it.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative p-6 rounded-xl border bg-card ${
                plan.highlight 
                  ? 'border-primary shadow-lg ring-1 ring-primary' 
                  : 'hover:border-primary/50'
              } transition-all`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                {plan.icon}
              </div>
              <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.ctaLink.startsWith('http') ? (
                <a href={plan.ctaLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant={plan.variant} className="w-full gap-2">
                    {plan.name === "Open Source" && <Github className="h-4 w-4" />}
                    {plan.cta}
                    {plan.name !== "Open Source" && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </a>
              ) : (
                <Link to={plan.ctaLink} className="block">
                  <Button variant={plan.variant} className="w-full gap-2">
                    {plan.cta} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <div key={index} className="p-6 rounded-xl border bg-card">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Start for free today</h2>
        <p className="text-muted-foreground mb-6">
          No credit card required. Get started in minutes.
        </p>
        <Link to="/auth">
          <Button size="lg" className="gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
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

export default Pricing;
