// KPIRow - Four KPI cards (Total Emissions, Intensity, Credits, Data Quality)

import React, { useMemo } from 'react';
import { MetricCard } from './MetricCard';
import { Badge } from './Badge';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData, convertKgToTons } from '../../lib/dashboardDataAdapter';

export function KPIRow() {
  const { activeScenarioId, bimContext } = useDashboardContext();
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-50 p-5 rounded-xl border border-slate-100 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-slate-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }
  
  // Calculate reduction vs baseline
  const reductionPercent = dashboardData.reductionPercent;
  const reductionText = reductionPercent > 0 
    ? `−${reductionPercent.toFixed(1)}% vs linha de base`
    : 'Linha de base';
  
  // Benchmark badge for intensity
  const intensityBadge = dashboardData.targetComparison.below2030Target ? (
    <Badge variant="success">Dentro da meta 2030</Badge>
  ) : dashboardData.targetComparison.belowStretchTarget ? (
    <Badge variant="warning">Acima da meta 2030</Badge>
  ) : (
    <Badge variant="warning">Acima das metas</Badge>
  );
  
  // Data quality badge with coverage percentage
  const qualityBadge = (
    <div className="flex items-center gap-2">
      {dashboardData.dataQuality.qualityLevel === 'high' ? (
        <Badge variant="success">Alta</Badge>
      ) : dashboardData.dataQuality.qualityLevel === 'medium' ? (
        <Badge variant="warning">Média</Badge>
      ) : (
        <Badge variant="danger">Baixa</Badge>
      )}
      <span className="text-xs text-slate-500">
        Cobertura: {dashboardData.dataQuality.overallCoverage}%
      </span>
    </div>
  );
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <MetricCard
        value={dashboardData.totalEmissionsKg}
        label="Emissões Totais A1–A3"
        subtext={reductionText}
        unit="t"
        highlight={false}
      />
      
      <MetricCard
        value={dashboardData.intensityKgPerM2}
        label="Intensidade de Carbono"
        subtext={`${dashboardData.intensityKgPerM2.toFixed(1)} kgCO₂e/m²`}
        unit="kg"
        badge={intensityBadge}
        highlight={false}
      />
      
      <MetricCard
        value={dashboardData.credits}
        label="Créditos Potenciais"
        subtext="Cálculo baseado em Δ entre baseline e cenário projeto"
        unit="count"
        highlight={true}
      />
      
      <MetricCard
        value={dashboardData.dataQuality.overallCoverage}
        label="Qualidade dos Dados"
        subtext={`Cobertura geral: ${dashboardData.dataQuality.overallCoverage}%`}
        unit="percent"
        badge={qualityBadge}
        highlight={false}
      />
    </div>
  );
}
