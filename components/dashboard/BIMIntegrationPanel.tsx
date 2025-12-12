// BIMIntegrationPanel - Export buttons (UI only, backend later)

import React from 'react';
import { Download, FileText, Database } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useDashboardContext } from '../../contexts/DashboardContext';

export function BIMIntegrationPanel() {
  const { bimContext } = useDashboardContext();
  
  const ifcWriteback = bimContext?.ifc_writeback;
  
  return (
    <SectionCard title="Exportar & integrar">
      <div className="space-y-4">
        {/* Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PDD Download */}
          <button className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-emerald-200 hover:shadow-md transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border rounded-lg flex items-center justify-center text-red-500 group-hover:text-red-600 shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition text-sm">
                  Baixar PDD Completo (PDF)
                </p>
                <p className="text-xs text-slate-500">PDF • Gerado agora</p>
              </div>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
          </button>
          
          {/* IFC Export */}
          <button className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-emerald-200 hover:shadow-md transition cursor-pointer group opacity-60" disabled>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border rounded-lg flex items-center justify-center text-blue-500 group-hover:text-blue-600 shadow-sm">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition text-sm">
                  Exportar IFC com resultados
                </p>
                <p className="text-xs text-slate-500">Em breve</p>
              </div>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
          </button>
          
          {/* CSV Export */}
          <button className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-emerald-200 hover:shadow-md transition cursor-pointer group opacity-60" disabled>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border rounded-lg flex items-center justify-center text-purple-500 group-hover:text-purple-600 shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition text-sm">
                  Exportar CSV
                </p>
                <p className="text-xs text-slate-500">Em breve</p>
              </div>
            </div>
            <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
          </button>
        </div>
        
        {/* Info Text */}
        {ifcWriteback && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-600">
              Resultados por categoria e intensidades serão gravados no IFC em{' '}
              <code className="bg-white px-1 py-0.5 rounded text-xs font-mono">
                {ifcWriteback.target_property_set_name}
              </code>{' '}
              para uso em outros fluxos BIM/LCA (ex.: IfcLCA, One Click LCA).
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
