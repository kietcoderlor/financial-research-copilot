import Link from "next/link";

import { Button } from "@/components/ui/Button";
import type { AuthUser } from "@/lib/auth";

import { HeroProductPreview } from "./HeroProductPreview";

const CREDIBILITY = ["10-K", "10-Q", "8-K", "Earnings transcripts", "Source-linked answers"] as const;

type LandingHeroProps = {
  user: AuthUser | null;
};

export function LandingHero({ user }: LandingHeroProps) {
  const primaryHref = user ? "/dashboard" : "/auth/signup";
  const secondaryHref = user ? "/app" : "/auth/signin?next=/dashboard";

  return (
    <section className="landing-hero" aria-labelledby="landing-headline">
      <div className="landing-hero-copy">
        <p className="landing-hero-label">SEC research workspace</p>

        <h1 id="landing-headline" className="landing-headline">
          Ask questions across SEC filings. Trace every answer to the source.
        </h1>

        <p className="landing-hero-subcopy">
          Search 10-Ks, 10-Qs, 8-Ks, and earnings transcripts with answers linked back to the exact filing text, so
          every claim can be checked before it goes into your model or memo.
        </p>

        <div className="landing-hero-actions">
          <Button href={primaryHref} variant="primary">
            Start researching
          </Button>
          <Link href={secondaryHref} className="btn-secondary landing-hero-secondary">
            View sample query
          </Link>
        </div>

        <div className="landing-credibility" role="list" aria-label="Supported document types">
          {CREDIBILITY.map((item, index) => (
            <span key={item} className="landing-credibility-item" role="listitem">
              {index > 0 ? <span className="landing-credibility-sep" aria-hidden /> : null}
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="landing-hero-preview">
        <HeroProductPreview />
      </div>
    </section>
  );
}
