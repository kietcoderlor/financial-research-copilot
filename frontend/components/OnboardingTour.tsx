"use client";

import { useEffect, useState } from "react";

import { markOnboardingDone } from "@/lib/storage";

const STEPS = [
  {
    title: "Ask a research question",
    body: "Type a natural-language question about SEC filings or earnings transcripts.",
    target: "[data-onboarding='query']",
  },
  {
    title: "Narrow your scope",
    body: "Filter by ticker, fiscal year, and document type before you run the query.",
    target: "[data-onboarding='filters']",
  },
  {
    title: "Verify every claim",
    body: "Click citation numbers in the answer to jump to the supporting source excerpt.",
    target: "[data-onboarding='results']",
  },
];

type OnboardingTourProps = {
  active: boolean;
  onComplete: () => void;
};

export function OnboardingTour({ active, onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    setStep(0);
  }, [active]);

  if (!active) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    markOnboardingDone();
    onComplete();
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{current.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{current.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={finish}>
            Skip tour
          </button>
          <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={next}>
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
