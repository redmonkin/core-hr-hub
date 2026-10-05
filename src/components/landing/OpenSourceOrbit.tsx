import type { CSSProperties } from "react";
import {
  CalendarDays,
  Clock,
  CreditCard,
  Github,
  Package,
  Receipt,
  Scale,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

// The orbit plane is tilted and flattened into an ellipse; icons undo that
// transform (and the ring's spin) so they stay upright and face the viewer.
const TILT_DEG = -14;
const FLATTEN = 0.42;
const PLANE = `rotate(${TILT_DEG}deg) scaleY(${FLATTEN})`;
const UNDO_PLANE = `scaleY(${(1 / FLATTEN).toFixed(4)}) rotate(${-TILT_DEG}deg)`;

const rings = [
  { icons: [Users, Clock, CreditCard, Target], radius: 120, seconds: 28, reverse: false, className: "animate-orbit" },
  {
    icons: [CalendarDays, Package, Receipt, UserPlus, Github, ShieldCheck],
    radius: 190,
    seconds: 36,
    reverse: true,
    className: "animate-orbit-reverse",
  },
];

/**
 * Decorative 3D emblem for the open-source section: an AGPL-3.0 badge with the
 * app's modules orbiting it. CSS only; holds still under reduced motion.
 */
export function OpenSourceOrbit() {
  return (
    <div aria-hidden="true" className="motion-decor relative mx-auto aspect-square w-full max-w-[440px] select-none">
      <div className="absolute inset-0" style={{ transform: PLANE }}>
        {rings.map((ring) => (
          <div
            key={ring.radius}
            className={`absolute left-1/2 top-1/2 rounded-full border border-sky-300/25 ${ring.className}`}
            style={{ width: ring.radius * 2, height: ring.radius * 2, marginLeft: -ring.radius, marginTop: -ring.radius }}
          >
            {ring.icons.map((Icon, i) => {
              const angle = (360 / ring.icons.length) * i;
              const counterSpin: CSSProperties = {
                animation: `orbit ${ring.seconds}s linear infinite`,
                animationDirection: ring.reverse ? "normal" : "reverse",
              };
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `rotate(${angle}deg) translateX(${ring.radius}px) rotate(${-angle}deg)` }}
                >
                  <span className="block" style={counterSpin}>
                    <span className="block" style={{ transform: UNDO_PLANE }}>
                      <span className="-ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-900/90 text-sky-300 shadow-lg shadow-sky-950/60 backdrop-blur">
                        <Icon className="h-4 w-4" />
                      </span>
                    </span>
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative animate-float">
          <span className="absolute -inset-4 rounded-[2rem] bg-sky-400/30 blur-2xl" />
          <div className="relative flex h-36 w-36 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 via-primary to-sky-800 text-white shadow-2xl shadow-sky-950/60 ring-1 ring-white/30 [transform:perspective(600px)_rotateX(10deg)_rotateY(-14deg)]">
            <span className="absolute inset-x-4 top-2 h-8 rounded-full bg-white/20 blur-md" />
            <Scale className="relative mb-1.5 h-8 w-8" />
            <span className="relative text-xl font-bold tracking-tight">AGPL-3.0</span>
            <span className="relative text-xs text-white/90">Free &amp; open source</span>
          </div>
        </div>
      </div>
    </div>
  );
}
