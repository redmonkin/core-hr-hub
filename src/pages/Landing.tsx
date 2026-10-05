import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Clock,
  Cloud,
  Code2,
  CreditCard,
  Database,
  Github,
  KeyRound,
  Layers,
  Lock,
  MailCheck,
  Package,
  Receipt,
  Scale,
  Server,
  ShieldCheck,
  Target,
  Unlock,
  UserPlus,
  Users,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import Footer from "@/components/layout/Footer";
import PublicHeader from "@/components/layout/PublicHeader";
import { DEMO_URL } from "@/components/layout/publicSite";
import { Backdrop } from "@/components/landing/Backdrop";
import { HeroScene } from "@/components/landing/HeroScene";
import { OpenSourceOrbit } from "@/components/landing/OpenSourceOrbit";
import { Reveal } from "@/components/landing/Reveal";
import { isProductionDomain } from "@/lib/domain";
import { LICENSE_URL, REPO_URL, SECURITY_POLICY_URL, SELF_HOST_GUIDE_URL } from "@/lib/site";
import peoploLogoLight from "@/assets/hr-hub-logo-light.svg";

const pillars = [
  { icon: Code2, title: "Open source", text: "Every line is public under AGPL-3.0" },
  { icon: ShieldCheck, title: "Secure by default", text: "Access rules enforced in the database" },
  { icon: Database, title: "Your data", text: "Run it on your own Supabase project" },
  { icon: Unlock, title: "No lock-in", text: "Fork it, host it, change it" },
];

const features = [
  {
    icon: Users,
    title: "People & Departments",
    description: "One record per person: job details, manager, documents, assets and history, organised by department.",
  },
  {
    icon: UserPlus,
    title: "Invite-only Onboarding",
    description: "Invite people by email. They fill in their details, HR approves, and their account is ready on day one.",
  },
  {
    icon: Clock,
    title: "Attendance",
    description: "Clock in and out with location and breaks, working schedules, and reminders before shifts start and end.",
  },
  {
    icon: CalendarDays,
    title: "Leave & Holidays",
    description: "Leave types and balances, manager approvals, a team calendar and your company holiday list.",
  },
  {
    icon: CreditCard,
    title: "Payroll & Payslips",
    description: "Salary structures, monthly payroll runs and branded payslips in ₹, with PF and other deductions.",
  },
  {
    icon: Target,
    title: "Performance",
    description: "KPIs, review cycles with self and manager ratings, and team analytics for managers.",
  },
  {
    icon: Receipt,
    title: "Reimbursements",
    description: "Employees submit claims with receipts; managers approve and finance marks them paid.",
  },
  {
    icon: Package,
    title: "Assets",
    description: "Track laptops, phones and other equipment, who has them, and their full assignment history.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Headcount, attendance, leave balances, payroll and asset reports, exportable to CSV and PDF.",
  },
];

const howItWorks = [
  { step: 1, title: "Set up your company", description: "Add departments, leave types, office locations and your branding." },
  { step: 2, title: "Invite your team", description: "Send invitations. Only invited people can create an account." },
  { step: 3, title: "Run the day to day", description: "Attendance, leave and reimbursements flow to the right approver." },
  { step: 4, title: "Pay and grow", description: "Run payroll, share payslips and review performance each cycle." },
];

const securityPoints = [
  {
    icon: ShieldCheck,
    title: "Permissions in the database",
    text: "Postgres row-level security decides who sees what, not just the screens. A bug in the UI can't leak salaries.",
  },
  {
    icon: KeyRound,
    title: "Access module by module",
    text: "Give someone Assets only, or Payroll view-only. Roles set the defaults; extra access is per person.",
  },
  {
    icon: MailCheck,
    title: "Invite-only accounts",
    text: "Nobody can sign up uninvited. Email domains can be restricted to your company.",
  },
  {
    icon: Lock,
    title: "Guards on sensitive changes",
    text: "Employees can't approve their own leave or edit closed attendance. Bank details live in their own locked-down table.",
  },
];

const selfHostSteps = [
  { prompt: true, text: `git clone ${REPO_URL}.git peoplo` },
  { prompt: true, text: "cd peoplo && npm install" },
  { prompt: true, text: "supabase link --project-ref <your-project>" },
  { prompt: true, text: "supabase db push && supabase functions deploy" },
  { prompt: true, text: "npm run build" },
  { prompt: false, text: "✓ Your own Peoplo, on infrastructure you control" },
];

const openSourcePoints = [
  { icon: Code2, text: "Read every line before your people's data goes in." },
  { icon: Layers, text: "Fork it and adapt it to your policies and workflows." },
  { icon: Scale, text: "AGPL-3.0 keeps improvements open, including on hosted versions." },
  { icon: Bell, text: "Report issues and suggest features in the open on GitHub." },
];

const faqs = [
  {
    q: "Is Peoplo really free?",
    a: "Yes. The full app is open source under the AGPL-3.0 license, and you can run it on your own Supabase project at no cost. If you'd rather not run it yourself, we offer a managed workspace.",
  },
  {
    q: "What does the AGPL-3.0 license mean for my company?",
    a: "You can use, run and modify Peoplo for your own organisation freely. If you change it and offer it to others over a network, you must share your changes under the same license. Using it internally for your own staff doesn't require publishing anything.",
  },
  {
    q: "Where is our data stored?",
    a: "When you self-host, everything lives in your own Supabase project: your database, your file storage, your region. Nothing is sent to us.",
  },
  {
    q: "Who can see salaries and personal details?",
    a: "Only people you give access to. Payroll, employee records and every other module have view and manage levels, enforced by the database itself.",
  },
  {
    q: "Can employees sign up on their own?",
    a: "No. Accounts are invite-only. HR sends an invitation, the person completes their onboarding details, and HR approves them.",
  },
  {
    q: "Does it work on phones?",
    a: "Yes. Peoplo is a progressive web app, so people can clock in, apply for leave and check payslips from their phone and get push notifications.",
  },
];

function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-3xl text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      <p className="text-lg text-muted-foreground">{text}</p>
    </Reveal>
  );
}

const Landing = () => {
  const { user, isLoading } = useAuth();
  const isProduction = isProductionDomain();

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const deploymentOptions = [
    {
      icon: Server,
      name: "Host it yourself",
      description: "Run your own copy on your own Supabase project.",
      features: [
        "Free and open source (AGPL-3.0)",
        "Your database, your data, your region",
        "Deploy the frontend anywhere static sites run",
        "Change it to fit your policies",
      ],
      cta: "Read the self-hosting guide",
      href: SELF_HOST_GUIDE_URL,
      highlight: false,
    },
    {
      icon: Cloud,
      name: "Let us run it",
      description: "A managed Peoplo workspace, set up for your company.",
      features: [
        "Nothing to install or maintain",
        "Updates and backups handled for you",
        "The same open-source app, no lock-in",
        "Help setting up your team",
      ],
      cta: "Book a demo",
      href: DEMO_URL,
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="relative">
          <Backdrop />
          <div className="container relative mx-auto grid items-center gap-16 px-4 pb-24 pt-14 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-32 lg:pt-24">
            <div className="text-center lg:text-left">
              <ExternalLink
                href={REPO_URL}
                className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Free &amp; open source · AGPL-3.0
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </ExternalLink>
              <h1
                className="mb-6 animate-fade-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                HR that runs itself,
                <br />
                <span className="text-shimmer animate-shimmer motion-reduce:animate-none">in the open.</span>
              </h1>
              <p
                className="mx-auto mb-8 max-w-xl animate-fade-up text-lg text-muted-foreground md:text-xl lg:mx-0"
                style={{ animationDelay: "160ms" }}
              >
                Peoplo is free, open-source HR software for growing teams: people, attendance, leave,
                payroll and performance in one secure place you can host yourself.
              </p>
              <div
                className="flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
                style={{ animationDelay: "240ms" }}
              >
                {isProduction ? (
                  <Button size="lg" className="group w-full gap-2 shadow-lg shadow-primary/25 sm:w-auto" asChild>
                    <ExternalLink href={DEMO_URL}>
                      Book a demo
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </ExternalLink>
                  </Button>
                ) : (
                  <Button size="lg" className="group w-full gap-2 shadow-lg shadow-primary/25 sm:w-auto" asChild>
                    <Link to="/auth">
                      Sign in
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="w-full gap-2 bg-background/70 backdrop-blur sm:w-auto" asChild>
                  <ExternalLink href={REPO_URL}>
                    <Github className="h-4 w-4" aria-hidden="true" />
                    View the code
                  </ExternalLink>
                </Button>
              </div>
              <ul
                className="mt-8 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground lg:justify-start"
                style={{ animationDelay: "320ms" }}
              >
                {["Self-host for free", "Built for Indian payroll", "No ads or trackers"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="animate-fade-up px-2 pt-4 sm:px-8 lg:px-0 lg:pt-0" style={{ animationDelay: "200ms" }}>
              <HeroScene />
            </div>
          </div>
        </section>

        {/* Trust pillars */}
        <section className="border-y border-border bg-card/70">
          <div className="container mx-auto grid grid-cols-2 gap-px px-4 md:grid-cols-4">
            {pillars.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 80} className="flex flex-col items-start gap-3 px-2 py-6 sm:flex-row sm:px-4 md:py-8">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{pillar.title}</p>
                  <p className="text-sm text-muted-foreground">{pillar.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto scroll-mt-20 px-4 py-24 md:py-32">
          <SectionHeading
            eyebrow="Features"
            title="Everything your people team needs"
            text="From the first invitation to the monthly payslip, without stitching five tools together."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 90}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 motion-reduce:hover:translate-y-0">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15 transition-colors duration-300 group-hover:from-primary group-hover:to-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="relative mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="relative text-muted-foreground">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card py-24 md:py-32">
          <div className="container mx-auto px-4">
            <SectionHeading
              eyebrow="How it works"
              title="Up and running in an afternoon"
              text="Set it up once, and everyday HR flows to the right person automatically."
            />
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 lg:block"
              />
              <ol className="relative grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {howItWorks.map((step, i) => (
                  <Reveal as="li" key={step.step} delay={i * 120} className="relative text-center">
                    <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                      <span className="absolute inset-0 rounded-2xl bg-primary/20 blur-md" />
                      <span className="relative flex h-16 w-16 rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-sky-600 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 hover:rotate-0">
                        {step.step}
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mx-auto max-w-xs text-muted-foreground">{step.description}</p>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Open source */}
        <section id="open-source" className="container mx-auto grid scroll-mt-20 items-center gap-14 px-4 py-24 md:py-32 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Open source</p>
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Your HR system shouldn't be a black box.
              </h2>
              <p className="mb-8 text-lg text-muted-foreground">
                People data is the most sensitive data a company holds. With Peoplo you can see exactly how
                it's stored and who can reach it, because all of it is public and licensed under AGPL-3.0.
              </p>
            </Reveal>
            <ul className="mb-8 space-y-4">
              {openSourcePoints.map((point, i) => (
                <Reveal as="li" key={point.text} delay={i * 80} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <point.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="pt-1 text-foreground">{point.text}</span>
                </Reveal>
              ))}
            </ul>
            <Reveal className="flex flex-col gap-3 sm:flex-row">
              <Button className="gap-2" asChild>
                <ExternalLink href={REPO_URL}>
                  <Github className="h-4 w-4" aria-hidden="true" />
                  Star on GitHub
                </ExternalLink>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                <ExternalLink href={LICENSE_URL}>
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  Read the license
                </ExternalLink>
              </Button>
            </Reveal>
          </div>
          <Reveal delay={150} className="relative overflow-hidden rounded-3xl bg-[hsl(222_47%_11%)] p-6 sm:p-10">
            <Backdrop tone="light" className="opacity-60" />
            <div className="relative">
              <OpenSourceOrbit />
            </div>
          </Reveal>
        </section>

        {/* Security & self-hosting */}
        <section id="security" className="relative scroll-mt-20 overflow-hidden bg-[hsl(222_47%_11%)] py-24 text-slate-100 md:py-32">
          <Backdrop tone="light" className="opacity-60" />
          <div className="container relative mx-auto grid items-center gap-14 px-4 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-sky-400">Trust</p>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Built in the open.
                  <br />
                  Secure by default.
                </h2>
                <p className="mb-10 text-lg text-slate-300">
                  Your employees trust you with their salaries, documents and bank details. Peoplo is designed
                  so you can trust it with them — and because the code is public, you don't have to take our word for it.
                </p>
              </Reveal>
              <div className="grid gap-6 sm:grid-cols-2">
                {securityPoints.map((point, i) => (
                  <Reveal key={point.title} delay={i * 90} className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-400 ring-1 ring-sky-400/20">
                      <point.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="mb-1 font-semibold text-white">{point.title}</p>
                      <p className="text-sm text-slate-400">{point.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <ExternalLink href={SECURITY_POLICY_URL} className="inline-flex items-center gap-1.5 text-sky-400 underline-offset-4 hover:underline">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Security policy
                </ExternalLink>
                <ExternalLink href={LICENSE_URL} className="inline-flex items-center gap-1.5 text-sky-400 underline-offset-4 hover:underline">
                  <Scale className="h-4 w-4" aria-hidden="true" /> AGPL-3.0 license
                </ExternalLink>
              </Reveal>
            </div>

            {/* Self-host terminal */}
            <Reveal delay={150} className="[perspective:1400px]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-sky-900/40 backdrop-blur transition-transform duration-500 lg:[transform:rotateY(-8deg)_rotateX(4deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)] motion-reduce:transform-none">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 font-mono text-xs text-slate-400">self-host.sh</span>
                </div>
                <div className="overflow-x-auto p-5 font-mono text-[13px] leading-7" tabIndex={0} aria-label="Self-hosting commands">
                  {selfHostSteps.map((line, i) => (
                    <Reveal key={line.text} delay={300 + i * 180} className="whitespace-pre">
                      {line.prompt ? (
                        <>
                          <span className="select-none text-sky-400">$ </span>
                          <span className="text-slate-200">{line.text}</span>
                        </>
                      ) : (
                        <span className="text-emerald-400">{line.text}</span>
                      )}
                    </Reveal>
                  ))}
                  <span className="motion-decor mt-1 inline-block h-4 w-2 animate-pulse bg-sky-400/80 align-middle" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-center text-sm text-slate-400 lg:text-left">
                The full walkthrough, including secrets, email and scheduled jobs, is in the{" "}
                <ExternalLink href={SELF_HOST_GUIDE_URL} className="text-sky-400 underline-offset-4 hover:underline">
                  setup guide
                </ExternalLink>
                .
              </p>
            </Reveal>
          </div>
        </section>

        {/* Deployment options */}
        <section id="get-started" className="container mx-auto scroll-mt-20 px-4 py-24 md:py-32">
          <SectionHeading
            eyebrow="Get started"
            title="Two ways to run Peoplo"
            text="The same open-source app either way. Host it yourself, or let us run it for you."
          />
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {deploymentOptions.map((option, i) => (
              <Reveal key={option.name} delay={i * 120} className="h-full">
                <div
                  className={`relative flex h-full flex-col rounded-2xl border bg-card p-7 transition-shadow duration-300 hover:shadow-xl ${
                    option.highlight ? "border-primary/40 shadow-lg shadow-primary/10" : "border-border"
                  }`}
                >
                  {option.highlight && (
                    <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow">
                      Managed for you
                    </span>
                  )}
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <option.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="mb-1 text-xl font-semibold text-foreground">{option.name}</h3>
                  <p className="mb-6 text-muted-foreground">{option.description}</p>
                  <ul className="mb-8 space-y-3">
                    {option.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-auto w-full" variant={option.highlight ? "default" : "outline"} asChild>
                    <ExternalLink href={option.href}>{option.cta}</ExternalLink>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Want the details?{" "}
            <Link to="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
              Compare plans
            </Link>
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border bg-card py-24 md:py-32">
          <div className="container mx-auto max-w-3xl px-4">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" text="What people usually ask before trusting a tool with their team's data." />
            <Reveal>
              <div className="divide-y divide-border rounded-2xl border border-border bg-background">
                {faqs.map((faq) => (
                  <details key={faq.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-foreground transition-colors hover:text-primary">
                      <h3>{faq.q}</h3>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <p className="pb-5 text-base text-muted-foreground">{faq.a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-24 md:py-32">
          <Reveal className="container relative mx-auto overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-sky-700 to-sky-900 px-6 py-16 text-center text-primary-foreground shadow-2xl shadow-primary/30 md:py-20">
            <Backdrop tone="light" className="opacity-50" />
            <div className="relative">
              <div className="motion-decor mx-auto mb-6 flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                <img src={peoploLogoLight} alt="" className="h-10 w-10" />
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Ready for calmer HR?</h2>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
                Host it yourself today, or book a demo and we'll set it up for you. Peoplo is open source,
                so you can read the code, suggest features and contribute.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" className="group w-full gap-2 sm:w-auto" asChild>
                  <ExternalLink href={DEMO_URL}>
                    Book a demo
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </ExternalLink>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                  asChild
                >
                  <ExternalLink href={REPO_URL}>
                    <Github className="h-4 w-4" aria-hidden="true" />
                    Star on GitHub
                  </ExternalLink>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
