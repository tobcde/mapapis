import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-ink/8 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border-[1.5px] border-ink/10 p-4 ${className}`}>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <ul className={`grid gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <SkeletonCard />
        </li>
      ))}
    </ul>
  );
}
