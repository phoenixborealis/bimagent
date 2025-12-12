// DataQualityPanel - Gauge and methodology summary

import React, { useMemo } from 'react';
import { SectionCard } from './SectionCard';
import { Badge } from './Badge';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData } from '../../lib/dashboardDataAdapter';

export function DataQualityPanel() {
  const { activeScenarioId, bimContext } = useDashboardContext();
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData || !bimContext) {
    return (
      <SectionCard title="Qualidade dos dados & metodologia">
        <div className="h-48 bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-xs text-slate-400">Carregando dados...</div>
        </div>
      </SectionCard>
    );
  }
  
  const dataQuality = dashboardData.dataQuality;
  const assumptions = bimContext.assumptions;
  
  return (
    <SectionCard title="Qualidade dos dados & metodologia">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Data Quality Gauge */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-4">Cobertura geral</h4>
          <div className="relative w-32 h-32 mx-auto">
            {/* Circular gauge */}
            <svg className="transform -rotate-90" width="128" height="128" viewBox="0 0 128 128">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke={dataQuality.overallCoverage >= 90 ? "#10b981" : dataQuality.overallCoverage >= 70 ? "#f59e0b" : "#ef4444"}
                strokeWidth="12"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - dataQuality.overallCoverage / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{dataQuality.overallCoverage}%</div>
                <div className="text-xs text-slate-500">Cobertura</div>
              </div>
            </div>
          </div>
          
          {/* Breakdown */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Estrutural:</span>
              <span className="font-medium text-slate-900">{dataQuality.structuralCoverage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Envoltória:</span>
              <span className="font-medium text-slate-900">{dataQuality.envelopeCoverage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Acabamentos:</span>
              <span className="font-medium text-slate-900">{dataQuality.finishesCoverage}%</span>
            </div>
          </div>
        </div>
        
        {/* Right: Methodology Summary */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-4">Metodologia</h4>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-medium mb-1">Base de dados LCA:</p>
              <p className="text-xs text-slate-600">Demo generic database (Europa, 2024)</p>
            </div>
            
            <div>
              <p className="font-medium mb-1">Fases incluídas:</p>
              <p className="text-xs text-slate-600">
                {assumptions.scope.modules_included.join(', ')}
              </p>
            </div>
            
            <div>
              <p className="font-medium mb-1">Não incluído:</p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                {dashboardData.knownGaps.slice(0, 3).map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>
            
            <div className="pt-2">
              <p className="text-xs text-slate-500 italic">
                Ver documentação IfcLCA / One Click LCA equivalentes
              </p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
