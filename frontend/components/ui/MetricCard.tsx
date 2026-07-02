type MetricCardProps = {
  label: string;
  value: string;
  danger?: boolean;
  accent?: boolean;
};

export function MetricCard({ label, value, danger = false, accent = false }: MetricCardProps) {
  return (
    <div className={`surface-card rounded-xl p-4 ${accent ? "surface-card-accent" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          danger ? "text-rose-400" : accent ? "text-emerald-500" : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
