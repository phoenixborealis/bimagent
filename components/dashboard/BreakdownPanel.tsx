// BreakdownPanel - Category breakdown with pie chart and table

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { SectionCard } from './SectionCard';
import { Badge } from './Badge';
import { MessageSquare } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { createUnifiedDashboardData } from '../../lib/dashboardDataAdapter';
import { cn } from '../../lib/utils';

export function BreakdownPanel() {
  const { activeScenarioId, bimContext, setActiveScenarioId } = useDashboardContext();
  
  const dashboardData = useMemo(() => {
    if (!bimContext) return null;
    return createUnifiedDashboardData(activeScenarioId);
  }, [activeScenarioId, bimContext]);
  
  // Handler for micro-CTA clicks
  const handleAskAboutCategory = (categoryId: string, categoryName: string, percentage: number) => {
    // This will be handled by parent component (App.tsx) via callback
    // For now, we'll use a simple approach
    const question = `Explique em PT-BR por que ${categoryName} responde por ${percentage.toFixed(1)}% das emissões no cenário atual e quais estratégias de redução fazem mais sentido.`;
    // Pre-fill chat input (will be handled by parent)
    return question;
  };
  
  if (!dashboardData) {
    return (
      <SectionCard title="Onde está o carbono?">
        <div className="h-64 bg-slate-50 rounded-lg border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-xs text-slate-400">Carregando dados...</div>
        </div>
      </SectionCard>
    );
  }
  
  // Prepare pie chart data
  const pieData = dashboardData.breakdownByCategory.map(cat => ({
    name: cat.name_pt_br,
    value: cat.sharePercent,
    emissionsKg: cat.emissionsKg,
    id: cat.id,
  }));
  
  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444'];
  
  return (
    <SectionCard title="Onde está o carbono?">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Pie Chart */}
        <div>
          <div className="h-64">
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
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Participação']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Right: Detail Table */}
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Categoria</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Quantidade</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Emissões</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">% do total</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.breakdownByCategory.map((cat) => (
                  <tr key={cat.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{cat.name_pt_br}</span>
                        {cat.coveragePercent !== undefined && cat.coveragePercent < 100 && (
                          <Badge variant="warning">Cobertura: {cat.coveragePercent}%</Badge>
                        )}
                        {cat.coveragePercent === 100 && (
                          <Badge variant="success">Cobertura: 100%</Badge>
                        )}
                        {cat.id === 'other_finishes_and_services' && (
                          <Badge variant="warning">≈ Estimado</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      {cat.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {cat.quantityUnit}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-medium">
                      {(cat.emissionsKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tCO₂e
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 font-semibold">
                      {cat.sharePercent.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {cat.reductionSuggestion && (
                          <span className="text-xs text-slate-600">{cat.reductionSuggestion}</span>
                        )}
                        <button
                          onClick={() => {
                            const question = `Explique em PT-BR por que ${cat.name_pt_br} responde por ${cat.sharePercent.toFixed(1)}% das emissões no cenário atual e quais estratégias de redução fazem mais sentido.`;
                            window.dispatchEvent(new CustomEvent('askAboutCategory', {
                              detail: { categoryId: cat.id, question }
                            }));
                          }}
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline"
                          title="Perguntar para o agente sobre esta categoria"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Perguntar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
