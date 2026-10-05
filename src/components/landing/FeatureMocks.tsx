import type { CSSProperties, ReactNode } from "react";
import {
  BellRing,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Download,
  FileText,
  IndianRupee,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Receipt,
  ShieldCheck,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusBadgeClass } from "@/lib/statusStyles";

/*
 * Recreated pieces of the Peoplo UI for the Features page. They're decorative
 * (aria-hidden on the stage) and use made-up sample data, so the page never
 * shows real screenshots or real people's details.
 */

type Chip = { content: ReactNode; className: string; z?: number; delay?: string };

/** A tilted 3D stage: the main panel plus floating chips lifted towards the viewer. */
export function Stage({ children, chips = [], flip = false }: { children: ReactNode; chips?: Chip[]; flip?: boolean }) {
  return (
    <div aria-hidden="true" className="motion-decor relative mx-auto w-full max-w-[520px] select-none px-3 py-16 [perspective:1600px] sm:px-6">
      <div
        className={cn(
          "preserve-3d relative transition-transform duration-700 ease-out",
          flip
            ? "[transform:rotateX(8deg)_rotateY(12deg)] lg:[transform:rotateX(10deg)_rotateY(16deg)]"
            : "[transform:rotateX(8deg)_rotateY(-12deg)] lg:[transform:rotateX(10deg)_rotateY(-16deg)]",
          "lg:hover:[transform:rotateX(2deg)_rotateY(0deg)] motion-reduce:transform-none",
        )}
      >
        <div className="rounded-2xl border border-border bg-card shadow-[0_40px_80px_-30px_hsl(201_96%_25%/0.45)]">{children}</div>
        {chips.map((chip, i) => (
          <div
            key={i}
            className={cn("absolute", i % 2 ? "animate-float-slow" : "animate-float", chip.className)}
            style={{ "--z": `${chip.z ?? 80}px`, animationDelay: chip.delay ?? `${-i * 1.5}s` } as CSSProperties}
          >
            {chip.content}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChipCard({ icon, title, sub, tone = "card" }: { icon: ReactNode; title: string; sub?: string; tone?: "card" | "primary" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 shadow-xl",
        tone === "primary" ? "bg-primary text-primary-foreground shadow-primary/30" : "border border-border bg-card/95 backdrop-blur",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          tone === "primary" ? "bg-white/15" : "bg-emerald-500/15 text-emerald-700",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-[11px] font-semibold">{title}</p>
        {sub && <p className={cn("whitespace-nowrap text-[9px]", tone === "primary" ? "text-white/90" : "text-muted-foreground")}>{sub}</p>}
      </div>
    </div>
  );
}

function Pill({ status, children }: { status: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", statusBadgeClass(status))}>{children}</span>;
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary", className)}>
      {initials}
    </span>
  );
}

function PanelHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {right}
    </div>
  );
}

/* ----------------------------------------------------------------- People */

export function PeopleMock() {
  return (
    <Stage
      chips={[
        {
          className: "-right-2 -top-12 sm:-right-8",
          content: <ChipCard icon={<FileText className="h-3.5 w-3.5" />} title="Offer letter uploaded" sub="Documents · 4 files" />,
        },
        {
          className: "-bottom-12 -left-1 sm:-left-8",
          z: 110,
          content: (
            <div className="w-44 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              <p className="mb-2 text-[10px] font-medium text-muted-foreground">Reports to</p>
              <div className="flex items-center gap-2">
                <Avatar initials="RV" className="h-6 w-6 text-[9px]" />
                <div>
                  <p className="text-[11px] font-semibold text-foreground">Rahul Verma</p>
                  <p className="text-[9px] text-muted-foreground">Engineering lead</p>
                </div>
              </div>
            </div>
          ),
        },
      ]}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar initials="AI" className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">Ananya Iyer</p>
            <p className="truncate text-xs text-muted-foreground">Senior designer · Design</p>
          </div>
          <Pill status="active">Active</Pill>
        </div>
        <div className="mt-4 flex gap-1.5">
          {["Profile", "Leaves", "Documents", "Assets"].map((tab, i) => (
            <span key={tab} className={cn("rounded-md px-2 py-1 text-[10px] font-medium", i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {tab}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          {[
            ["Employee ID", "RMK014"],
            ["Joined", "Mar 1, 2022"],
            ["Work mode", "Hybrid"],
            ["Location", "Bengaluru"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-2">
              <dt className="text-[10px] text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Onboarding */

export function OnboardingMock() {
  const hires = [
    { name: "Tara Bose", role: "Designer · Joins Oct 12", status: "invited", label: "Invitation sent", note: "2 hours ago" },
    { name: "Kabir Shah", role: "Engineer · Joins Oct 19", status: "pending", label: "Link expired", note: "Resend" },
    { name: "Meera Pillai", role: "Sales · Joined Oct 1", status: "active", label: "Joined", note: "Account set up" },
  ];
  return (
    <Stage
      flip
      chips={[
        {
          className: "-left-2 -top-12 sm:-left-8",
          content: <ChipCard icon={<Mail className="h-3.5 w-3.5" />} title="Invitation sent" sub="tara@acme.in" />,
        },
        {
          className: "-bottom-12 -right-1 sm:-right-6",
          z: 110,
          content: <ChipCard tone="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Meera joined" sub="Now active · leave balances ready" />,
        },
      ]}
    >
      <PanelHeader
        title="Pending new hires"
        right={
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
            <UserPlus className="h-3 w-3" /> Add and invite
          </span>
        }
      />
      <ul className="divide-y divide-border">
        {hires.map((hire) => (
          <li key={hire.name} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar initials={hire.name.split(" ").map((p) => p[0]).join("")} className="h-7 w-7 text-[10px]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{hire.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{hire.role}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <Pill status={hire.status}>{hire.label}</Pill>
              <span className="text-[9px] text-muted-foreground">{hire.note}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          {["Added", "Invited", "Password set", "Active"].map((step, i) => (
            <div key={step} className="flex-1">
              <div className={cn("h-1.5 rounded-full", i < 2 ? "bg-primary" : "bg-muted")} />
              <p className="mt-1 text-[9px] text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- Attendance */

export function AttendanceMock() {
  const week = [
    { d: "M", h: 92 },
    { d: "T", h: 86 },
    { d: "W", h: 100 },
    { d: "T", h: 88 },
    { d: "F", h: 54 },
  ];
  return (
    <Stage
      chips={[
        {
          className: "-right-2 -top-12 sm:-right-8",
          content: <ChipCard icon={<Coffee className="h-3.5 w-3.5" />} title="Break ended" sub="Lunch · 34 min" />,
        },
        {
          className: "-bottom-12 -left-1 sm:-left-6",
          z: 110,
          content: <ChipCard tone="primary" icon={<BellRing className="h-3.5 w-3.5" />} title="Time to clock out" sub="Your day ends at 6:00 PM" />,
        },
      ]}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground">Monday, Oct 5</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">04:18:22</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> Clocked in 9:02 AM · Bengaluru office
            </p>
          </div>
          <Pill status="present">On time</Pill>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-medium text-foreground">
            <Coffee className="h-3.5 w-3.5" /> Start break
          </span>
          <span className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground">
            <Clock className="h-3.5 w-3.5" /> Clock out
          </span>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-[10px] font-medium text-muted-foreground">Hours this week</p>
          <div className="flex h-16 items-end gap-2">
            {week.map((day, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="w-full rounded-sm bg-gradient-to-t from-primary/70 to-primary" style={{ height: `${day.h * 0.5}px` }} />
                <span className="text-[9px] text-muted-foreground">{day.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------------ Leave */

export function LeaveMock() {
  const leaveDays = new Set([14, 15, 22]);
  const holidays = new Set([2, 20]);
  return (
    <Stage
      flip
      chips={[
        {
          className: "-left-2 -top-12 sm:-left-10",
          z: 110,
          content: (
            <div className="w-40 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              <p className="mb-2 text-[10px] font-medium text-muted-foreground">October</p>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[8px]">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <span
                    key={day}
                    className={cn(
                      "rounded py-0.5",
                      leaveDays.has(day) && "bg-primary text-primary-foreground",
                      holidays.has(day) && "bg-red-100 text-red-700",
                      !leaveDays.has(day) && !holidays.has(day) && "text-muted-foreground",
                    )}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
          ),
        },
        {
          className: "-bottom-12 -right-1 sm:-right-6",
          content: <ChipCard icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Leave approved" sub="Rahul was notified" />,
        },
      ]}
    >
      <PanelHeader title="Leave request" right={<Pill status="pending">Pending</Pill>} />
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar initials="RV" />
          <div>
            <p className="text-sm font-semibold text-foreground">Rahul Verma</p>
            <p className="text-[11px] text-muted-foreground">Casual leave · Oct 14 – Oct 15, 2026 · 2 days</p>
          </div>
        </div>
        <p className="rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">Family function in Mysuru.</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["Casual", "6 left"],
            ["Sick", "8 left"],
            ["Earned", "12 left"],
          ].map(([type, left]) => (
            <span key={type} className="rounded-md bg-muted px-2 py-1 text-[10px] text-foreground">
              {type} · <span className="text-muted-foreground">{left}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white">
            <Check className="h-3.5 w-3.5" /> Approve
          </span>
          <span className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-medium text-red-700">
            <X className="h-3.5 w-3.5" /> Reject
          </span>
        </div>
      </div>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Payroll */

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function PayrollMock() {
  const earnings: [string, number][] = [
    ["Basic", 120000],
    ["House rent allowance", 48000],
    ["Transport allowance", 3200],
    ["Medical allowance", 1250],
  ];
  const deductions: [string, number][] = [
    ["PF deduction", 14400],
    ["Tax deduction", 12800],
  ];
  const gross = earnings.reduce((sum, [, v]) => sum + v, 0);
  const net = gross - deductions.reduce((sum, [, v]) => sum + v, 0);
  return (
    <Stage
      chips={[
        {
          className: "-right-2 -top-12 sm:-right-8",
          content: <ChipCard tone="primary" icon={<IndianRupee className="h-3.5 w-3.5" />} title="Payroll generated" sub="September · 48 employees" />,
        },
        {
          className: "-bottom-12 -left-1 sm:-left-6",
          z: 110,
          content: <ChipCard icon={<Download className="h-3.5 w-3.5" />} title="Payslip PDF" sub="With your logo and brand colour" />,
        },
      ]}
    >
      <PanelHeader title="Payslip · September 2026" right={<Pill status="paid">Paid</Pill>} />
      <div className="grid grid-cols-2 gap-4 p-4 text-xs">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Earnings</p>
          {earnings.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 py-0.5">
              <span className="truncate text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground">{inr(value)}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Deductions</p>
          {deductions.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 py-0.5">
              <span className="truncate text-muted-foreground">{label}</span>
              <span className="font-medium text-red-700">−{inr(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-primary/5 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Net pay</span>
        <span className="text-xl font-bold text-foreground">{inr(net)}</span>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------ Performance */

export function PerformanceMock() {
  const kpis = [
    { title: "Ship the new design system", progress: 80 },
    { title: "Cut support tickets by 20%", progress: 55 },
    { title: "Mentor two junior designers", progress: 100 },
  ];
  return (
    <Stage
      flip
      chips={[
        {
          className: "-left-2 -top-12 sm:-left-8",
          content: (
            <div className="rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
              <p className="text-[10px] text-muted-foreground">Manager rating · H2 2026</p>
              <div className="mt-0.5 flex gap-0.5 text-amber-500">
                {[0, 1, 2, 3].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
                <Star className="h-3.5 w-3.5" />
              </div>
            </div>
          ),
        },
        {
          className: "-bottom-12 -right-1 sm:-right-6",
          z: 110,
          content: <ChipCard icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Review acknowledged" sub="Ananya Iyer" />,
        },
      ]}
    >
      <PanelHeader title="KPIs · Ananya Iyer" right={<Pill status="in_progress">In progress</Pill>} />
      <ul className="space-y-3 p-4">
        {kpis.map((kpi) => (
          <li key={kpi.title}>
            <div className="mb-1 flex justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{kpi.title}</span>
              <span className="text-muted-foreground">{kpi.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div className="h-2 rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${kpi.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Stage>
  );
}

/* --------------------------------------------------------- Reimbursements */

export function ReimbursementMock() {
  const steps = [
    { label: "Submitted", date: "Oct 2", done: true },
    { label: "Approved", date: "Oct 3", done: true },
    { label: "Paid", date: "Oct 7", done: false },
  ];
  return (
    <Stage
      chips={[
        {
          className: "-right-3 -top-12 sm:-right-10",
          z: 110,
          content: (
            <div className="w-28 rotate-3 rounded-lg border border-border bg-card p-2 shadow-xl">
              <div className="mb-1 flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                <Receipt className="h-3 w-3" /> receipt.jpg
              </div>
              <div className="space-y-1">
                {[90, 70, 80, 50].map((w, i) => (
                  <div key={i} className="h-1 rounded bg-muted" style={{ width: `${w}%` }} />
                ))}
              </div>
              <p className="mt-1.5 text-right text-[10px] font-bold text-foreground">₹2,340</p>
            </div>
          ),
        },
        {
          className: "-bottom-12 -left-1 sm:-left-6",
          content: <ChipCard tone="primary" icon={<IndianRupee className="h-3.5 w-3.5" />} title="Marked as paid" sub="Finance · Oct 7" />,
        },
      ]}
    >
      <PanelHeader title="Expense claim" right={<Pill status="approved">Approved</Pill>} />
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Client visit · cab</p>
            <p className="text-[11px] text-muted-foreground">Travel · Oct 2, 2026</p>
          </div>
          <p className="text-xl font-bold text-foreground">₹2,340</p>
        </div>
        <ol className="flex items-center">
          {steps.map((step, i) => (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[10px]",
                    step.done ? "bg-primary text-primary-foreground" : "border-2 border-dashed border-primary/40 text-primary",
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="mt-1 text-[10px] font-medium text-foreground">{step.label}</span>
                <span className="text-[9px] text-muted-foreground">{step.date}</span>
              </div>
              {i < steps.length - 1 && <span className={cn("mx-1 mb-6 h-0.5 flex-1", step.done ? "bg-primary" : "bg-muted")} />}
            </li>
          ))}
        </ol>
      </div>
    </Stage>
  );
}

/* ----------------------------------------------------------------- Assets */

export function AssetsMock() {
  const history = [
    { who: "Ananya Iyer", when: "Jan 10, 2024 – now" },
    { who: "Arjun Rao", when: "Mar 2022 – Dec 2023" },
  ];
  return (
    <Stage
      flip
      chips={[
        {
          className: "-left-2 -top-12 sm:-left-8",
          content: <ChipCard icon={<Laptop className="h-3.5 w-3.5" />} title="Assigned to Ananya" sub="Acknowledged on Jan 10" />,
        },
        {
          className: "-bottom-12 -right-1 sm:-right-6",
          z: 110,
          content: (
            <div className="flex gap-1.5 rounded-xl border border-border bg-card/95 p-2 shadow-xl backdrop-blur">
              <Pill status="available">Available · 3</Pill>
              <Pill status="maintenance">Repair · 1</Pill>
            </div>
          ),
        },
      ]}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Laptop className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">MacBook Pro 14"</p>
            <p className="text-[11px] text-muted-foreground">Laptop · SN C02FK3LZQ05N</p>
          </div>
          <Pill status="assigned">Assigned</Pill>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {[
            ["Purchased", "Jan 10, 2024"],
            ["Vendor", "Imagine Store"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-background p-2">
              <dt className="text-[10px] text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mb-1.5 mt-4 text-[10px] font-medium text-muted-foreground">Assignment history</p>
        <ul className="space-y-1.5">
          {history.map((h) => (
            <li key={h.who} className="flex items-center justify-between rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
              <span className="font-medium text-foreground">{h.who}</span>
              <span className="text-[10px] text-muted-foreground">{h.when}</span>
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
}

/* ---------------------------------------------------------------- Reports */

export function ReportsMock() {
  const departments = [
    ["Engineering", 18],
    ["Design", 7],
    ["Sales", 11],
    ["Operations", 6],
    ["People", 4],
  ] as const;
  const max = 18;
  return (
    <Stage
      chips={[
        {
          className: "-right-2 -top-12 sm:-right-10",
          z: 110,
          content: (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              <span
                className="h-12 w-12 rounded-full"
                style={{
                  background:
                    "conic-gradient(hsl(201 96% 32%) 0 46%, hsl(199 89% 60%) 46% 74%, hsl(160 60% 45%) 74% 90%, hsl(38 92% 55%) 90% 100%)",
                  WebkitMask: "radial-gradient(circle, transparent 52%, #000 53%)",
                  mask: "radial-gradient(circle, transparent 52%, #000 53%)",
                }}
              />
              <div className="text-[10px] leading-4 text-muted-foreground">
                <p className="font-semibold text-foreground">Leave by type</p>
                <p>Casual 46% · Sick 28%</p>
                <p>Earned 16% · Other 10%</p>
              </div>
            </div>
          ),
        },
        {
          className: "-bottom-12 -left-1 sm:-left-6",
          content: (
            <div className="flex gap-1.5">
              {["CSV", "PDF"].map((format) => (
                <span key={format} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground shadow-xl shadow-primary/30">
                  <Download className="h-3 w-3" /> {format}
                </span>
              ))}
            </div>
          ),
        },
      ]}
    >
      <PanelHeader title="Headcount by department" right={<span className="text-[11px] text-muted-foreground">46 active</span>} />
      <ul className="space-y-2.5 p-4">
        {departments.map(([name, count]) => (
          <li key={name} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground">{name}</span>
            <span className="h-3 flex-1 rounded-full bg-secondary">
              <span className="block h-3 rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="w-5 text-right font-medium text-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </Stage>
  );
}

/* ------------------------------------------------------------ Permissions */

export function PermissionsMock() {
  const rows = [
    { module: "Employees", level: 2 },
    { module: "Leaves", level: 2 },
    { module: "Payroll", level: 1 },
    { module: "Assets", level: 0 },
  ];
  const levels = ["None", "View", "Manage"];
  return (
    <Stage
      flip
      chips={[
        {
          className: "-left-2 -top-12 sm:-left-10",
          z: 110,
          content: (
            <div className="rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
              <p className="text-[10px] text-muted-foreground">Extra access</p>
              <p className="text-[11px] font-semibold text-foreground">Rohan Das</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Laptop className="h-3 w-3" /> Assets · Manage
              </span>
            </div>
          ),
        },
        {
          className: "-bottom-12 -right-1 sm:-right-6",
          content: <ChipCard tone="primary" icon={<Lock className="h-3.5 w-3.5" />} title="Enforced in the database" sub="Row-level security" />,
        },
      ]}
    >
      <PanelHeader title="Manager · default access" right={<ShieldCheck className="h-4 w-4 text-primary" />} />
      <div className="p-4">
        <div className="mb-2 grid grid-cols-[1fr_repeat(3,3.25rem)] text-center text-[10px] font-medium text-muted-foreground">
          <span />
          {levels.map((level) => (
            <span key={level}>{level}</span>
          ))}
        </div>
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.module} className="grid grid-cols-[1fr_repeat(3,3.25rem)] items-center rounded-lg bg-muted/60 py-1.5 pl-2 text-xs">
              <span className="font-medium text-foreground">{row.module}</span>
              {levels.map((level, i) => (
                <span key={level} className="flex justify-center">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      i === row.level ? "border-primary bg-primary" : "border-border bg-background",
                    )}
                  >
                    {i === row.level && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </Stage>
  );
}

/* ---------------------------------------------------------- Notifications */

export function NotificationsMock() {
  const items = [
    { icon: CalendarCheck, title: "Leave approved", body: "Your casual leave on Oct 14–15 was approved.", time: "now" },
    { icon: IndianRupee, title: "Payslip ready", body: "Your September payslip is ready to download.", time: "2h" },
    { icon: Clock, title: "Time to clock in", body: "Your day starts at 9:00 AM.", time: "8:45" },
  ];
  return (
    <div aria-hidden="true" className="motion-decor relative mx-auto flex w-full max-w-[520px] select-none justify-center py-6 [perspective:1600px]">
      <div className="preserve-3d relative [transform:rotateX(8deg)_rotateY(-14deg)] motion-reduce:transform-none">
        <div className="w-60 rounded-[2.2rem] border-[6px] border-slate-900 bg-gradient-to-b from-sky-900 via-slate-900 to-slate-950 p-3 shadow-[0_40px_80px_-30px_hsl(201_96%_25%/0.6)]">
          <div className="mx-auto mb-4 h-4 w-20 rounded-full bg-black/60" />
          <p className="text-center text-3xl font-light text-white">9:41</p>
          <p className="mb-4 text-center text-[10px] text-white/80">Monday, October 5</p>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={item.title}
                className="animate-fade-up rounded-2xl bg-white/90 p-2.5 shadow-lg backdrop-blur"
                style={{ animationDelay: `${400 + i * 250}ms` }}
              >
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-900">
                    <span className="flex h-4 w-4 items-center justify-center rounded bg-primary text-white">
                      <item.icon className="h-2.5 w-2.5" />
                    </span>
                    Peoplo
                  </span>
                  <span className="text-[9px] text-slate-600">{item.time}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-900">{item.title}</p>
                <p className="text-[10px] leading-snug text-slate-700">{item.body}</p>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-white/60" />
        </div>
        <div className="absolute -right-6 top-24 animate-float sm:-right-16" style={{ "--z": "100px" } as CSSProperties}>
          <ChipCard icon={<Mail className="h-3.5 w-3.5" />} title="Also by email" sub="Per-person preferences" />
        </div>
      </div>
    </div>
  );
}
