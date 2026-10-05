import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Delay in ms, for staggering items in a grid. */
  delay?: number;
}

// useLayoutEffect warns when the page is pre-rendered on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Fades its content up the first time it scrolls into view. */
export function Reveal({ children, as: Tag = "div", className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  // Pre-rendered HTML shows everything, for crawlers and visitors without JS.
  const [visible, setVisible] = useState(typeof window === "undefined");

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Already on screen at mount (e.g. replacing the pre-rendered page): show it
    // before the first paint instead of fading it in a second time.
    if (typeof IntersectionObserver === "undefined" || node.getBoundingClientRect().top < window.innerHeight) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
