type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`ui-skeleton animate-pulse rounded-lg bg-[var(--bg-surface)] ${className}`} aria-hidden />;
}

export function MetricCardSkeleton() {
  return (
    <div className="panel p-5">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-8 w-20" />
    </div>
  );
}

export function AnswerSkeleton() {
  return (
    <div className="panel space-y-3 p-6 sm:p-7">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-48" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
    </div>
  );
}
