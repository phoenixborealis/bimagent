// ChartContainer - Wrapper for Recharts with consistent styling

import React from 'react';
import { cn } from '../../lib/utils';

interface ChartContainerProps {
  title?: string;
  children: React.ReactNode;
  height?: number | string;
  className?: string;
}

export function ChartContainer({ 
  title, 
  children, 
  height = 256,
  className 
}: ChartContainerProps) {
  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h4 className="text-xs font-semibold text-slate-700 mb-4">{title}</h4>
      )}
      <div style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        {children}
      </div>
    </div>
  );
}
