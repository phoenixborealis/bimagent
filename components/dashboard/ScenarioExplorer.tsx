// ScenarioExplorer - Grid of scenario cards

import React from 'react';
import { SectionCard } from './SectionCard';
import { Badge } from './Badge';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData } from '../../lib/dashboardDataAdapter';
import { convertKgToTons } from '../../lib/dashboardDataAdapter';
import { cn } from '../../lib/utils';

export function ScenarioExplorer() {
  const { activeScenarioId, setActiveScenarioId, bimContext } = useDashboardContext();
  
  const dashboardData = React.useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData) {
    return (
      <SectionCard title="Explorar cenários">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-50 rounded-lg border border-slate-200 animate-pulse"></div>
          ))}
        </div>
      </SectionCard>
    );
  }
  
  return (
    <SectionCard title="Explorar cenários">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboardData.scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          const reductionPercent = scenario.reduction_vs_baseline_percent || 0;
          
          return (
            <div
              key={scenario.id}
              className={cn(
                "p-5 rounded-xl border-2 transition-all cursor-pointer",
                isActive
                  ? "border-emerald-500 bg-emerald-50 shadow-md"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm"
              )}
              onClick={() => setActiveScenarioId(scenario.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-slate-900 text-sm">{scenario.label_pt_br}</h4>
                {isActive && (
                  <Badge variant="success">Ativo</Badge>
                )}
              </div>
              
              {reductionPercent > 0 && (
                <div className="mb-3">
                  <Badge variant="success">
                    −{reductionPercent.toFixed(1)}% vs baseline
                  </Badge>
                </div>
              )}
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Total:</span>
                  <span className="font-semibold text-slate-900">
                    {convertKgToTons(scenario.total_kgco2e).toLocaleString('pt-BR', { 
                      minimumFractionDigits: 1, 
                      maximumFractionDigits: 1 
                    })} tCO₂e
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Intensidade:</span>
                  <span className="font-semibold text-slate-900">
                    {scenario.intensity_kgco2e_per_m2.toFixed(1)} kgCO₂e/m²
                  </span>
                </div>
              </div>
              
              {scenario.changes_summary_pt_br && scenario.changes_summary_pt_br.length > 0 && (
                <ul className="text-xs text-slate-600 space-y-1 mb-4">
                  {scenario.changes_summary_pt_br.slice(0, 3).map((change, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveScenarioId(scenario.id);
                }}
                className={cn(
                  "w-full py-2 px-3 rounded-lg text-xs font-medium transition",
                  isActive
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700"
                )}
                disabled={isActive}
              >
                {isActive ? 'Cenário Ativo' : 'Ativar como cenário principal'}
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
