"use client";

import { Children, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

const DELAY_CLASS: Record<number, string> = {
  1: "ui-reveal-delay-1",
  2: "ui-reveal-delay-2",
  3: "ui-reveal-delay-3",
  4: "ui-reveal-delay-4",
  5: "ui-reveal-delay-5",
  6: "ui-reveal-delay-6",
  7: "ui-reveal-delay-7",
  8: "ui-reveal-delay-8",
  9: "ui-reveal-delay-9",
  10: "ui-reveal-delay-10",
};

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
  /** Animate on mount (auth, modals) instead of waiting for scroll */
  immediate?: boolean;
  once?: boolean;
  /** Container only — children handle visibility (RevealGroup) */
  contain?: boolean;
};

export function Reveal({
  children,
  delay = 1,
  className = "",
  as: Tag = "div",
  immediate = false,
  once = true,
  contain = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(immediate);
  const delayClass = DELAY_CLASS[Math.min(10, Math.max(1, delay))] ?? DELAY_CLASS[1];

  useEffect(() => {
    if (immediate) return;

    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate, once]);

  const classes = [
    "ui-reveal-scroll",
    contain ? "ui-reveal-contain" : "",
    contain ? "" : delayClass,
    visible ? "ui-reveal-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const RefTag = Tag as "div";
  return (
    <RefTag ref={ref as React.Ref<HTMLDivElement>} className={classes}>
      {children}
    </RefTag>
  );
}

type StaggerProps = {
  children: ReactNode;
  start?: number;
  className?: string;
  immediate?: boolean;
};

export function Stagger({ children, start = 1, className = "", immediate = false }: StaggerProps) {
  return (
    <>
      {Children.toArray(children).map((child, index) => (
        <Reveal key={index} delay={start + index} className={className} immediate={immediate}>
          {child}
        </Reveal>
      ))}
    </>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: ElementType;
};

/** Single scroll trigger; children stagger inside (features row, etc.) */
export function RevealGroup({ children, className = "", delay = 1, as: Tag = "div" }: RevealGroupProps) {
  const items = Children.toArray(children);
  return (
    <Reveal delay={delay} className={className} as={Tag} contain>
      <div className="contents">
        {items.map((child, index) => {
          const itemDelay = DELAY_CLASS[Math.min(10, Math.max(1, index + 1))] ?? DELAY_CLASS[1];
          return (
            <div key={index} className={`ui-reveal-group-item ${itemDelay}`}>
              {child}
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}
