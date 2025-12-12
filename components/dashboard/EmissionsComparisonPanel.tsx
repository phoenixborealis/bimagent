// EmissionsComparisonPanel - Comparison chart with metric toggle

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SectionCard } from './SectionCard';
import { ChartContainer } from './ChartContainer';
import { Leaf } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData, convertKgToTons } from '../../lib/dashboardDataAdapter';

type MetricType = 'total' | 'intensity' | 'intensity_per_year';

export function EmissionsComparisonPanel() {
  const { activeScenarioId, bimContext } = useDashboardContext();
  const [metricType, setMetricType] = useState<MetricType>('total');
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData) {
    return (
      <SectionCard title={
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-600" />
          Comparativo de Emissões
        </div>
      }>
        <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-xs text-slate-400">Carregando gráfico...</div>
        </div>
      </SectionCard>
    );
  }
  
  // Prepare chart data based on metric type
  const chartData = useMemo(() => {
    const baseline = dashboardData.baselineEmissionsKg;
    const active = dashboardData.activeScenarioEmissionsKg;
    
    let baselineValue: number;
    let activeValue: number;
    let unit: string;
    
    const floorArea = bimContext?.project_summary.gross_floor_area_m2 || 208.546;
    
    if (metricType === 'total') {
      baselineValue = convertKgToTons(baseline);
      activeValue = convertKgToTons(active);
      unit = 'tCO₂e';
    } else if (metricType === 'intensity') {
      baselineValue = baseline / floorArea;
      activeValue = dashboardData.intensityKgPerM2;
      unit = 'kgCO₂e/m²';
    } else {
      // intensity_per_year (using operational carbon lifetime)
      const lifetime = bimContext?.operational_carbon.assumed_lifetime_years || 50;
      baselineValue = (baseline / floorArea) / lifetime;
      activeValue = dashboardData.intensityKgPerM2 / lifetime;
      unit = 'kgCO₂e/m²/ano';
    }
    
    return [
      { name: 'Linha de Base', value: baselineValue, fill: '#94a3b8' },
      { name: dashboardData.scenarios.find(s => s.id === activeScenarioId)?.label_pt_br || 'Cenário Ativo', value: activeValue, fill: '#10b981' },
    ];
  }, [metricType, dashboardData, activeScenarioId, bimContext]);
  
  const reductionText = dashboardData.reductionPercent > 0
    ? `Redução de ${convertKgToTons(dashboardData.baselineEmissionsKg - dashboardData.activeScenarioEmissionsKg).toFixed(1)} tCO₂e (−${dashboardData.reductionPercent.toFixed(1)}%) em relação à linha de base.`
    : 'Sem redução em relação à linha de base.';
  
  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-600" />
          Comparativo de Emissões
        </div>
      }
    >
      {/* Metric Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMetricType('total')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            metricType === 'total'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          tCO₂e total
        </button>
        <button
          onClick={() => setMetricType('intensity')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            metricType === 'intensity'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          kgCO₂e/m²
        </button>
        <button
          onClick={() => setMetricType('intensity_per_year')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            metricType === 'intensity_per_year'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          kgCO₂e/m²/ano
        </button>
      </div>
      
      {/* Chart */}
      <ChartContainer height={256}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number) => [
                `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                '',
              ]}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
      
      {/* Summary Text */}
      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-700">
          {reductionText}
        </p>
      </div>
    </SectionCard>
  );
}
