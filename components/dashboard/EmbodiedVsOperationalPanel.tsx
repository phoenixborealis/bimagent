// EmbodiedVsOperationalPanel - Lifetime pie chart and grid toggle

import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip, ResponsiveContainer as BarResponsiveContainer } from 'recharts';
import { SectionCard } from './SectionCard';
import { ChartContainer } from './ChartContainer';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData, convertKgToTons } from '../../lib/dashboardDataAdapter';

export function EmbodiedVsOperationalPanel() {
  const { activeScenarioId, bimContext } = useDashboardContext();
  const [gridType, setGridType] = useState<'current' | 'future'>('current');
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  if (!dashboardData) {
    return (
      <SectionCard title="Carbono incorporado × operacional">
        <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-xs text-slate-400">Carregando dados...</div>
        </div>
      </SectionCard>
    );
  }
  
  // Calculate operational carbon based on grid type
  const operationalKg = gridType === 'current' 
    ? dashboardData.operationalLifetimeKg 
    : dashboardData.operationalFutureKg;
  
  const embodiedKg = dashboardData.embodiedTotalKg;
  const totalKg = embodiedKg + operationalKg;
  const embodiedPercent = (embodiedKg / totalKg) * 100;
  const operationalPercent = (operationalKg / totalKg) * 100;
  
  // Pie chart data
  const pieData = [
    { name: 'Embodied A1–A3', value: embodiedPercent, kg: embodiedKg },
    { name: 'Operacional', value: operationalPercent, kg: operationalKg },
  ];
  
  const COLORS = ['#10b981', '#3b82f6'];
  
  // Bar chart data
  const barData = [
    { name: 'Embodied', value: convertKgToTons(embodiedKg), fill: '#10b981' },
    { name: 'Operacional', value: convertKgToTons(operationalKg), fill: '#3b82f6' },
  ];
  
  return (
    <SectionCard title="Carbono incorporado × operacional">
      <div className="space-y-6">
        {/* Part 1: Pie Chart */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-4">Distribuição ao longo de 50 anos</h4>
          <ChartContainer height={256}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)}% (${convertKgToTons(props.payload.kg).toFixed(1)} tCO₂e)`,
                    name
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        
        {/* Part 2: Grid Toggle and Bar Chart */}
        <div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setGridType('current')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                gridType === 'current'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grid atual
            </button>
            <button
              onClick={() => setGridType('future')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                gridType === 'future'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Grid futuro descarbonizado
            </button>
          </div>
          
          <ChartContainer height={200}>
            <BarResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
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
                <BarTooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tCO₂e`,
                    '',
                  ]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </BarResponsiveContainer>
          </ChartContainer>
        </div>
        
        {/* Descriptive Text */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-700">
            {gridType === 'current' ? (
              <>
                Com a rede atual, o operacional representa <strong>~{operationalPercent.toFixed(0)}%</strong> das emissões ao longo de 50 anos.
              </>
            ) : (
              <>
                Com a rede descarbonizada, o incorporado passa a ser dominante, representando <strong>~{embodiedPercent.toFixed(0)}%</strong> das emissões totais.
              </>
            )}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
