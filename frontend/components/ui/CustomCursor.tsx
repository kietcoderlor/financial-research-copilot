"use client";

import { useEffect, useRef, useState } from "react";

const OUTER_LAG = 0.16;

export function CustomCursor() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const outer = useRef({ x: -100, y: -100 });
  const rafRef = useRef(0);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion) return;

    setActive(true);
    document.body.classList.add("custom-cursor-active");

    function setInner(x: number, y: number) {
      const node = innerRef.current;
      if (!node) return;
      node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }

    function setOuter(x: number, y: number) {
      const node = outerRef.current;
      if (!node) return;
      node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }

    function onMove(event: MouseEvent) {
      target.current = { x: event.clientX, y: event.clientY };
      setInner(event.clientX, event.clientY);
      setVisible(true);
    }

    function onLeave() {
      setVisible(false);
    }

    function tick() {
      outer.current.x += (target.current.x - outer.current.x) * OUTER_LAG;
      outer.current.y += (target.current.y - outer.current.y) * OUTER_LAG;
      setOuter(outer.current.x, outer.current.y);
      rafRef.current = window.requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className={`custom-cursor-root${visible ? "" : " custom-cursor-hidden"}`} aria-hidden>
      <div ref={outerRef} className="custom-cursor-outer" />
      <div ref={innerRef} className="custom-cursor-inner" />
    </div>
  );
}
