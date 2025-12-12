// BenchmarkPanel - Violin strip chart showing percentile distribution

import React, { useMemo } from 'react';
import { SectionCard } from './SectionCard';
import { Badge } from './Badge';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData } from '../../lib/dashboardDataAdapter';

export function BenchmarkPanel() {
  const { activeScenarioId, bimContext } = useDashboardContext();
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData || !bimContext) {
    return (
      <SectionCard title="Como este projeto se compara ao mercado?">
        <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-xs text-slate-400">Carregando dados...</div>
        </div>
      </SectionCard>
    );
  }
  
  const benchmarks = bimContext.benchmarks;
  const { p10, p50, p90 } = benchmarks.distribution;
  const intensity = dashboardData.intensityKgPerM2;
  const percentile = dashboardData.percentilePosition;
  
  // Calculate positions for markers
  const minValue = p10 - (p50 - p10);
  const maxValue = p90 + (p90 - p50);
  const range = maxValue - minValue;
  const baselineIntensity = dashboardData.baselineEmissionsKg / (bimContext.project_summary.gross_floor_area_m2 || 1);
  
  // Normalize positions (0-100%)
  const p10Pos = ((p10 - minValue) / range) * 100;
  const p50Pos = ((p50 - minValue) / range) * 100;
  const p90Pos = ((p90 - minValue) / range) * 100;
  const intensityPos = ((intensity - minValue) / range) * 100;
  const baselinePos = ((baselineIntensity - minValue) / range) * 100;
  
  // Target positions
  const target2030 = benchmarks.targets.find(t => t.id === 'near_term_target');
  const targetStretch = benchmarks.targets.find(t => t.id === 'stretch_target');
  const target2030Pos = target2030 ? ((target2030.target_kgco2e_per_m2 - minValue) / range) * 100 : null;
  const targetStretchPos = targetStretch ? ((targetStretch.target_kgco2e_per_m2 - minValue) / range) * 100 : null;
  
  return (
    <SectionCard title="Como este projeto se compara ao mercado?">
      {/* Violin Strip Chart */}
      <div className="relative h-32 mb-6">
        {/* Colored zones */}
        <div className="absolute inset-0 flex">
          <div className="bg-emerald-100" style={{ width: `${p10Pos}%` }}></div>
          <div className="bg-emerald-50" style={{ width: `${p50Pos - p10Pos}%` }}></div>
          <div className="bg-amber-50" style={{ width: `${p90Pos - p50Pos}%` }}></div>
          <div className="bg-amber-100" style={{ width: `${100 - p90Pos}%` }}></div>
        </div>
        
        {/* Zone labels */}
        <div className="absolute inset-0 flex items-center text-xs font-medium">
          <div className="absolute left-0 px-2 text-emerald-700" style={{ left: '2%' }}>Muito baixo</div>
          <div className="absolute px-2 text-emerald-600" style={{ left: `${p10Pos + 2}%` }}>Baixo</div>
          <div className="absolute px-2 text-amber-600" style={{ left: `${p50Pos + 2}%` }}>Médio–alto</div>
          <div className="absolute px-2 text-amber-700" style={{ left: `${p90Pos + 2}%` }}>Muito alto</div>
        </div>
        
        {/* Markers */}
        <div className="absolute inset-0">
          {/* Baseline marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
            style={{ left: `${baselinePos}%` }}
          >
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-slate-600 whitespace-nowrap">
              Baseline
            </div>
          </div>
          
          {/* Active scenario marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-emerald-600"
            style={{ left: `${intensityPos}%` }}
          >
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs font-bold text-emerald-700 whitespace-nowrap">
              Cenário Ativo
            </div>
          </div>
          
          {/* Target lines */}
          {target2030Pos !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-500"
              style={{ left: `${target2030Pos}%` }}
            >
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 whitespace-nowrap">
                Meta 2030
              </div>
            </div>
          )}
          {targetStretchPos !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-700"
              style={{ left: `${targetStretchPos}%` }}
            >
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-blue-700 whitespace-nowrap">
                Meta Ambi
              </div>
            </div>
          )}
        </div>
        
        {/* X-axis scale */}
        <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-slate-500">
          <span>{Math.round(minValue)}</span>
          <span>{Math.round(p10)}</span>
          <span>{Math.round(p50)}</span>
          <span>{Math.round(p90)}</span>
          <span>{Math.round(maxValue)}</span>
        </div>
        <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-slate-500 font-medium">
          kgCO₂e/m²
        </div>
      </div>
      
      {/* Summary Text */}
      <div className="mt-8 space-y-2 text-sm text-slate-700">
        <p>
          <strong>Linha de base:</strong> {baselineIntensity.toFixed(1)} kgCO₂e/m² ({percentile.description}).
        </p>
        <p>
          <strong>Cenário projeto:</strong> {intensity.toFixed(1)} kgCO₂e/m² 
          {dashboardData.targetComparison.below2030Target ? (
            <span className="text-emerald-600"> (abaixo da meta 2030)</span>
          ) : dashboardData.targetComparison.belowStretchTarget ? (
            <span className="text-amber-600"> (acima da meta 2030, abaixo da meta ambiciosa)</span>
          ) : (
            <span className="text-amber-700"> (acima das metas)</span>
          )}
        </p>
      </div>
    </SectionCard>
  );
}
