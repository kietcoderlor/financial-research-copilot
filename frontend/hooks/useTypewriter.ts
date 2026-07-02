import { useEffect, useRef, useState } from "react";

export type UseTypewriterOptions = {
  /** Skip animation and show full text (e.g. history restore) */
  instant?: boolean;
  frameIntervalMs?: number;
  profile?: "claude" | "chatgpt";
};

export type TypewriterResult = {
  displayed: string;
  isTyping: boolean;
};

export function useTypewriter(text: string, options: UseTypewriterOptions = {}): TypewriterResult {
  const { instant = false, frameIntervalMs = 18, profile = "chatgpt" } = options;

  const [displayed, setDisplayed] = useState(instant ? text : "");
  const indexRef = useRef(instant ? text.length : 0);
  const textRef = useRef(text);
  const lastTickRef = useRef(0);
  textRef.current = text;

  // New query / shorter text → reset cursor
  useEffect(() => {
    if (text.length < indexRef.current) {
      indexRef.current = 0;
      setDisplayed("");
    }
  }, [text]);

  // History restore / instant mode
  useEffect(() => {
    if (instant) {
      indexRef.current = text.length;
      setDisplayed(text);
    }
  }, [instant, text]);

  // Keep revealing characters until caught up with the target buffer
  useEffect(() => {
    if (instant) return;

    let raf = 0;
    const tick = (now: number) => {
      if (now - lastTickRef.current < frameIntervalMs) {
        raf = window.requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      const target = textRef.current;
      const backlog = target.length - indexRef.current;
      if (backlog > 0) {
        const step =
          profile === "claude"
            ? backlog > 240
              ? 10
              : backlog > 140
                ? 8
                : backlog > 80
                  ? 6
                  : backlog > 36
                    ? 4
                    : backlog > 12
                      ? 3
                      : 2
            : backlog > 260
              ? 6
              : backlog > 160
                ? 5
                : backlog > 90
                  ? 4
                  : backlog > 40
                    ? 3
                    : 2;
        indexRef.current = Math.min(indexRef.current + step, target.length);
        setDisplayed(target.slice(0, indexRef.current));
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [instant, frameIntervalMs, profile]);

  const isTyping = !instant && displayed.length < text.length;

  return {
    displayed: instant ? text : displayed,
    isTyping,
  };
}
