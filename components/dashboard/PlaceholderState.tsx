// PlaceholderState - Empty/loading/error states

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PlaceholderStateProps {
  message: string;
  icon?: LucideIcon;
  variant?: 'empty' | 'loading' | 'error';
  className?: string;
}

export function PlaceholderState({
  message,
  icon: Icon,
  variant = 'empty',
  className,
}: PlaceholderStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "w-8 h-8 mb-3",
            variant === 'error' ? "text-red-500" :
            variant === 'loading' ? "text-slate-400 animate-pulse" :
            "text-slate-400"
          )}
        />
      )}
      <p
        className={cn(
          "text-sm",
          variant === 'error' ? "text-red-600" : "text-slate-500"
        )}
      >
        {message}
      </p>
    </div>
  );
}
