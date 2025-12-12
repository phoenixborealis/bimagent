// MetricCard - Standardized KPI card component
// Handles unit conversion display (kg → t for carbon)

import React from 'react';
import { cn } from '../../lib/utils';
import { convertKgToTons } from '../../lib/dashboardDataAdapter';

interface MetricCardProps {
  value: number; // Always in kg internally
  label: string;
  subtext?: string;
  badge?: React.ReactNode;
  unit?: 'kg' | 't' | 'm2' | 'm3' | 'percent' | 'count';
  className?: string;
  highlight?: boolean;
}

export function MetricCard({
  value,
  label,
  subtext,
  badge,
  unit = 'kg',
  className,
  highlight = false,
}: MetricCardProps) {
  // Convert kg to tons for display if unit is 't'
  const displayValue = unit === 't' ? convertKgToTons(value) : value;
  
  // Format number based on unit
  const formatValue = (val: number, u: string) => {
    if (u === 'percent') {
      return `${val.toFixed(1)}%`;
    }
    if (u === 'count') {
      return val.toLocaleString();
    }
    // For t, kg, m2, m3 - format with appropriate decimals
    if (u === 't' || u === 'kg') {
      return val.toLocaleString('pt-BR', { 
        minimumFractionDigits: 1, 
        maximumFractionDigits: 1 
      });
    }
    return val.toLocaleString('pt-BR', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };
  
  const unitLabel = unit === 't' ? 'tCO₂e' : 
                   unit === 'kg' ? 'kgCO₂e' :
                   unit === 'm2' ? 'm²' :
                   unit === 'm3' ? 'm³' :
                   unit === 'percent' ? '' :
                   '';
  
  return (
    <div
      className={cn(
        "bg-slate-50 p-5 rounded-xl border border-slate-100",
        highlight && "bg-emerald-50 border-emerald-100 ring-1 ring-emerald-200",
        className
      )}
    >
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </h3>
      <div className={cn(
        "text-2xl font-bold",
        highlight ? "text-emerald-800" : "text-slate-700"
      )}>
        {formatValue(displayValue, unit)}
        {unitLabel && (
          <span className={cn(
            "text-sm font-normal ml-1",
            highlight ? "text-emerald-600" : "text-slate-400"
          )}>
            {unitLabel}
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
      )}
      {badge && (
        <div className="mt-2">{badge}</div>
      )}
    </div>
  );
}
