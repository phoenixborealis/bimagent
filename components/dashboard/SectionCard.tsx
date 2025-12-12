// SectionCard - Container for major dashboard sections

import React from 'react';
import { cn } from '../../lib/utils';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, children, actions, className }: SectionCardProps) {
  return (
    <div className={cn("bg-white p-6 rounded-xl border shadow-sm", className)}>
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
