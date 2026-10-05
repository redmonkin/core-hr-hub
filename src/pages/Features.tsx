import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  CreditCard,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import Footer from "@/components/layout/Footer";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicCtaSection from "@/components/layout/PublicCtaSection";
import { Backdrop } from "@/components/landing/Backdrop";
import { Reveal } from "@/components/landing/Reveal";
import {
  AssetsMock,
  AttendanceMock,
  LeaveMock,
  NotificationsMock,
  OnboardingMock,
  PayrollMock,
  PeopleMock,
  PerformanceMock,
  PermissionsMock,
  ReimbursementMock,
  ReportsMock,
} from "@/components/landing/FeatureMocks";

interface Feature {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  description: string;
  points: string[];
  mock: ReactNode;
}

const features: Feature[] = [
  {
    id: "people",
    icon: Users,
    label: "People",
    title: "Everyone in one place",
    description: "A single record per person with their job details, manager, documents, leave, assets and payslips, organised by department.",
    points: [
      "Profiles with job, contact and personal details",
      "Departments, managers and reporting lines",
      "Documents stored securely per employee",
      "A colleague directory that shows only safe fields",
    ],
    mock: <PeopleMock />,
  },
  {
    id: "onboarding",
    icon: UserPlus,
    label: "Onboarding",
    title: "Add a new hire, and they're invited",
    description: "Add someone once and Peoplo emails them a link to set up their account. You see who hasn't joined yet, and they become active the moment they do.",
    points: [
      "One form for job details, schedule, salary and documents",
      "Invitation emailed straight away, with resend and cancel",
      "Pending shows who hasn't set up their account yet",
      "Active with leave balances as soon as they choose a password",
    ],
    mock: <OnboardingMock />,
  },
  {
    id: "attendance",
    icon: Clock,
    label: "Attendance",
    title: "Attendance that runs itself",
    description: "People clock in and out from any device, with their location and breaks recorded, and get reminded before their day starts and ends.",
    points: [
      "Clock in and out with location",
      "Breaks tracked and taken out of working hours",
      "Working schedules per person, with office or remote mode",
      "Reminders to clock in and out",
    ],
    mock: <AttendanceMock />,
  },
  {
    id: "leave",
    icon: CalendarDays,
    label: "Leave",
    title: "Leave without the back-and-forth",
    description: "Employees see their balances and apply in seconds. Managers get notified and approve in a tap, and everyone sees who's out.",
    points: [
      "Your own leave types, allowances and eligibility",
      "Manager approvals with notes, with email and push alerts",
      "Team calendar and company holiday list",
      "Requests always start as pending; nobody approves their own",
    ],
    mock: <LeaveMock />,
  },
  {
    id: "payroll",
    icon: CreditCard,
    label: "Payroll",
    title: "Payroll in rupees, done monthly",
    description: "Salary structures with allowances and deductions, a monthly payroll run, and branded payslips your team can download.",
    points: [
      "Salary structures with HRA, allowances, PF and tax",
      "Monthly payroll runs, with mid-month joiners prorated",
      "Payslip PDFs with your logo and colours",
      "Bank details kept in their own locked-down table",
    ],
    mock: <PayrollMock />,
  },
  {
    id: "performance",
    icon: Target,
    label: "Performance",
    title: "Reviews people actually finish",
    description: "Set KPIs, track progress through the cycle, and run reviews with self and manager ratings that employees acknowledge.",
    points: [
      "KPIs with priorities, due dates and progress",
      "Review cycles with self and manager ratings",
      "Employees acknowledge their completed review",
      "Team analytics and rankings for managers",
    ],
    mock: <PerformanceMock />,
  },
  {
    id: "reimbursements",
    icon: Receipt,
    label: "Reimbursements",
    title: "Expense claims with receipts",
    description: "Employees submit claims with a photo of the receipt. Managers approve them and finance marks them paid, with every step on record.",
    points: [
      "Claims by category, with receipt uploads",
      "Manager approval or rejection with notes",
      "Mark claims as paid when they're settled",
      "Notifications at every step",
    ],
    mock: <ReimbursementMock />,
  },
  {
    id: "assets",
    icon: Package,
    label: "Assets",
    title: "Know who has what",
    description: "Track laptops, phones and other equipment, who they're assigned to, and their full history, so nothing walks out the door.",
    points: [
      "Assets by type with serial number, vendor and purchase date",
      "Assign and return with a complete history",
      "Available, assigned, in-repair and retired states",
      "Employees see the assets they hold",
    ],
    mock: <AssetsMock />,
  },
  {
    id: "reports",
    icon: BarChart3,
    label: "Reports",
    title: "Reports you can hand to finance",
    description: "Headcount, attendance, leave balances, payroll and asset reports, ready to export whenever someone asks.",
    points: [
      "Headcount and growth by department",
      "Attendance and leave balance reports",
      "Monthly payroll summaries",
      "Export to CSV and PDF",
    ],
    mock: <ReportsMock />,
  },
  {
    id: "permissions",
    icon: ShieldCheck,
    label: "Permissions",
    title: "Access module by module",
    description: "Roles set the defaults for every module. Give one person more when they need it, and the database enforces it, not just the screens.",
    points: [
      "View or manage access per module, per role",
      "Extra access for one person, such as Assets only",
      "Blocked users are locked out everywhere",
      "Row-level security on every table",
    ],
    mock: <PermissionsMock />,
  },
  {
    id: "notifications",
    icon: Bell,
    label: "Notifications",
    title: "The right nudge, on any device",
    description: "In-app, email and push notifications for approvals, reminders and payslips. Peoplo installs on phones like an app.",
    points: [
      "Push notifications on phones and desktops",
      "Email for approvals, reminders and announcements",
      "Each person chooses what they receive",
      "Installable on Android and iOS home screens",
    ],
    mock: <NotificationsMock />,
  },
];

const Features = () => {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="relative">
          <Backdrop />
          <div className="container relative mx-auto px-4 pb-16 pt-16 text-center md:pt-24">
            <p className="mx-auto mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-sm font-medium text-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Every module, open source
            </p>
            <h1
              className="mx-auto mb-6 max-w-4xl animate-fade-up text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              Everything your people team needs,{" "}
              <span className="text-shimmer animate-shimmer motion-reduce:animate-none">in one place.</span>
            </h1>
            <p
              className="mx-auto mb-10 max-w-2xl animate-fade-up text-lg text-muted-foreground md:text-xl"
              style={{ animationDelay: "160ms" }}
            >
              From the first invitation to the monthly payslip. Here's what each part of Peoplo looks like.
            </p>
            <nav aria-label="Features" className="mx-auto flex max-w-4xl animate-fade-up flex-wrap justify-center gap-2" style={{ animationDelay: "240ms" }}>
              {features.map((feature) => (
                <a
                  key={feature.id}
                  href={`#${feature.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-sm text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <feature.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {feature.label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* Features */}
        {features.map((feature, index) => {
          const flipped = index % 2 === 1;
          return (
            <section
              key={feature.id}
              id={feature.id}
              className={`scroll-mt-20 py-16 md:py-24 ${flipped ? "border-y border-border bg-card/60" : ""}`}
            >
              <div className="container mx-auto grid items-center gap-10 px-4 lg:grid-cols-2 lg:gap-16">
                <Reveal className={flipped ? "lg:order-2" : ""}>
                  <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                    <feature.icon className="h-4 w-4" aria-hidden="true" />
                    {feature.label}
                  </p>
                  <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{feature.title}</h2>
                  <p className="mb-6 text-lg text-muted-foreground">{feature.description}</p>
                  <ul className="space-y-3">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </span>
                        <span className="text-foreground">{point}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={120} className={flipped ? "lg:order-1" : ""}>
                  {feature.mock}
                </Reveal>
              </div>
            </section>
          );
        })}
      </main>

      <PublicCtaSection />

      <Footer />
    </div>
  );
};

export default Features;
