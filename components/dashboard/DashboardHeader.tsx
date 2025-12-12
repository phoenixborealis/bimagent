// DashboardHeader - Project metadata and scenario selector

import React from 'react';
import { FileCheck } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { BIM_CARBON_CONTEXT } from '../../data/bimCarbonContext.js';
import { demoData } from '../../data/demoData.js';

export function DashboardHeader() {
  const { activeScenarioId, setActiveScenarioId, bimContext } = useDashboardContext();
  
  const context = bimContext || BIM_CARBON_CONTEXT;
  const project = context.project_summary;
  const scenarios = context.scenarios.scenarios;
  
  // Get active scenario label
  const activeScenario = scenarios.find(s => s.id === activeScenarioId);
  const activeScenarioLabel = activeScenario?.label_pt_br || 'Linha de Base';
  
  return (
    <div className="border-b pb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1">
          <FileCheck className="w-3 h-3" /> PDD V1 Gerado
        </span>
        <span className="text-slate-400 text-xs font-medium">
          Metodologia {demoData.project.methodologies?.[0] || 'Verra VM0032'}
        </span>
      </div>
      
      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        {project.name_pt_br || demoData.project.name}
      </h1>
      
      <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm mb-4">
        <span>{demoData.project.location.city}, {demoData.project.location.state}</span>
        <span>•</span>
        <span>{demoData.project.typology || project.usage_type_pt_br}</span>
      </div>
      
      {/* Scenario Selector */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
          Cenário Ativo
        </label>
        <select
          value={activeScenarioId}
          onChange={(e) => setActiveScenarioId(e.target.value)}
          className="w-full md:w-auto px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label_pt_br}
              {scenario.reduction_vs_baseline_percent && 
                ` (−${scenario.reduction_vs_baseline_percent.toFixed(1)}%)`
              }
            </option>
          ))}
        </select>
        {activeScenario && activeScenario.reduction_vs_baseline_percent && (
          <p className="text-xs text-emerald-600 mt-1">
            Redução de {activeScenario.reduction_vs_baseline_percent.toFixed(1)}% vs linha de base
          </p>
        )}
      </div>
    </div>
  );
}
