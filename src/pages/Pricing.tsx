import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Check,
  ArrowRight,
  Github,
  Cloud,
  Zap,
  HeartHandshake
} from "lucide-react";
import Footer from "@/components/layout/Footer";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicCtaSection from "@/components/layout/PublicCtaSection";
import PublicPageBadge from "@/components/layout/PublicPageBadge";
import { DEMO_URL } from "@/components/layout/publicSite";

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
    ctaLink: "https://github.com/redmonkin/core-hr-hub",
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
    cta: "Get started",
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
    cta: "Talk to sales",
    ctaLink: DEMO_URL,
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
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 py-20 lg:py-28 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <PublicPageBadge icon={<HeartHandshake />}>Open source first</PublicPageBadge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Simple, <span className="text-primary">Transparent</span> Pricing
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Free forever for self-hosted. Affordable cloud hosting for those who prefer managed infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative hover:shadow-lg transition-all duration-300 ${
                plan.highlight 
                  ? 'border-primary shadow-lg ring-1 ring-primary' 
                  : 'hover:border-primary/30'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full">
                  Most Popular
                </div>
              )}
              <CardContent className="p-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  {plan.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground text-lg">{plan.period}</span>
                  )}
                </div>
                <p className="text-muted-foreground mb-8">{plan.description}</p>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.ctaLink.startsWith('http') ? (
                  <Button asChild variant={plan.variant} className="w-full gap-2 h-12">
                    <a href={plan.ctaLink} target="_blank" rel="noopener noreferrer">
                      {plan.name === "Open Source" && <Github className="h-4 w-4" />}
                      {plan.cta}
                      {plan.name !== "Open Source" && <ArrowRight className="h-4 w-4" />}
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant={plan.variant} className="w-full gap-2 h-12">
                    <Link to={plan.ctaLink}>
                      {plan.cta} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about our pricing and plans.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300 hover:border-primary/30">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-3">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <PublicCtaSection
        title="Start for free today"
        description="No credit card required. Get started in minutes and see the difference."
      />

      <Footer />
    </div>
  );
};

export default Pricing;
