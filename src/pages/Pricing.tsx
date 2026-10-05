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
  HeartHandshake,
  ChevronDown
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
    description: "Self-host on your own infrastructure. Every feature, licensed under AGPL-3.0.",
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
    price: "₹3,500",
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
    cta: "Request access",
    ctaLink: DEMO_URL,
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
    answer: "Yes. Peoplo is open source under the AGPL-3.0 license, so you can self-host every feature on your own infrastructure at no cost. The cloud-hosted option is a paid service for teams that prefer managed hosting."
  },
  {
    question: "Can I migrate from self-hosted to cloud?",
    answer: "Yes. Both run the same open-source app and database schema, so we can move your data across in either direction."
  },
  {
    question: "How do I get a hosted workspace?",
    answer: "Book a demo and we'll set up a workspace for your company. Accounts are invite-only, so once it's ready you invite your team from inside Peoplo."
  },
  {
    question: "What does the AGPL-3.0 license mean for my company?",
    answer: "You can use, run and modify Peoplo for your own organisation freely. If you change it and offer it to others over a network, you must share your changes under the same license. Using it internally for your own staff doesn't require publishing anything."
  },
  {
    question: "Where is our data stored?",
    answer: "When you self-host, everything lives in your own Supabase project: your database, your file storage, your region. Nothing is sent to us."
  },
  {
    question: "Who can see salaries and personal details?",
    answer: "Only people you give access to. Payroll, employee records and every other module have view and manage levels, enforced by the database itself."
  },
  {
    question: "Can employees sign up on their own?",
    answer: "No. Accounts are invite-only. HR sends an invitation, the person completes their onboarding details, and HR approves them."
  },
  {
    question: "Can several companies share one Peoplo?",
    answer: "No. Each Peoplo deployment is one company's workspace, tied to your email domain, so your data never sits alongside another organisation's. Self-host your own, or book a demo and we'll set up a dedicated workspace for you."
  },
  {
    question: "Does it work on phones?",
    answer: "Yes. Peoplo is a progressive web app, so people can clock in, apply for leave and check payslips from their phone and get push notifications."
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
              Pricing, licensing, data and how Peoplo works for your team.
            </p>
          </div>
          <div className="mx-auto max-w-3xl divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((faq) => (
              <details key={faq.question} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-foreground transition-colors hover:text-primary">
                  <h3>{faq.question}</h3>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-5 text-base text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PublicCtaSection
        title="Start for free today"
        description="Self-host it free under AGPL-3.0, or book a demo and we'll run it for you."
      />

      <Footer />
    </div>
  );
};

export default Pricing;
