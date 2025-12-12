// Skeleton components for progressive reveal

import React from 'react';
import { cn } from '../../lib/utils';

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-slate-50 p-5 rounded-xl border border-slate-100 animate-pulse",
        className
      )}
    >
      <div className="h-3 bg-slate-200 rounded w-24 mb-2"></div>
      <div className="h-8 bg-slate-200 rounded w-32 mb-1"></div>
      <div className="h-3 bg-slate-200 rounded w-16"></div>
    </div>
  );
}

export function ChartSkeleton({ height = 256, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn(
        "bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center",
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div className="text-xs text-slate-400">Carregando gráfico...</div>
    </div>
  );
}

export function TableSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-slate-50 rounded border border-slate-200 animate-pulse"
        ></div>
      ))}
    </div>
  );
}
