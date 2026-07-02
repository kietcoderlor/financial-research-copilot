type SectionLabelProps = {
  children: React.ReactNode;
};

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <p className="section-label flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
      <span className="section-label-bar" aria-hidden />
      {children}
    </p>
  );
}
