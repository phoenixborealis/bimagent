import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileText, ChevronRight, MessageSquare, Send, Download, 
  Loader2, CheckCircle2, ChevronDown, ChevronUp, 
  Database, Leaf, FileCheck, Layers, Zap, PieChart, Repeat, TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { demoData } from './data/demoData'; 
import { cn } from './lib/utils'; 

// --- TYPES ---
type AppState = 'IDLE' | 'PARSING' | 'GAP_DETECTED' | 'CALCULATING' | 'INSIGHT_MODE';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'action_request';
}

interface QueryCategory {
  id: 'materiais' | 'emissões' | 'parâmetros' | 'relatórios' | 'alternativas';
  label: string;
  icon: React.ElementType;
  color: string;
  suggestions: string[];
}

// --- CONSTANTS: PRD QUERY DOMAINS ---
const QUERY_CATEGORIES: QueryCategory[] = [
  {
    id: 'materiais',
    label: 'Materiais',
    icon: Layers,
    color: 'emerald',
    suggestions: [
      'Quais materiais mais contribuem para as emissões totais?',
      'Quanto concreto estrutural temos no projeto?',
      'Qual a quantidade de aço utilizada por tipo?'
    ]
  },
  {
    id: 'emissões',
    label: 'Emissões',
    icon: PieChart,
    color: 'amber',
    suggestions: [
      'Me mostra um resumo de emissões por categoria.',
      'Qual a redução total de carbono do projeto em tCO₂e?',
      'Como se distribuem as emissões por pavimento?'
    ]
  },
  {
    id: 'parâmetros',
    label: 'Parâmetros',
    icon: Zap,
    color: 'blue',
    suggestions: [
      'Quais fatores de emissão foram usados no cálculo?',
      'Qual fator de emissão de eletricidade foi usado?',
      'Explique os Escopos 1, 2 e 3 aplicados aqui.'
    ]
  },
  {
    id: 'alternativas',
    label: 'Alternativas',
    icon: Repeat,
    color: 'purple',
    suggestions: [
      'Quais 3 materiais são candidatos para reduzir emissões?',
      'Se eu trocar o concreto por baixo carbono, quanto muda?',
      'Quais alternativas reduziriam mais as emissões?'
    ]
  },
  {
    id: 'relatórios',
    label: 'Relatórios',
    icon: TrendingUp,
    color: 'slate',
    suggestions: [
      'Como se distribuem as emissões entre estrutura e envelope?',
      'Me mostra um resumo executivo do projeto.',
      'Quais são os principais pontos de atenção?'
    ]
  }
];

// --- COMPONENTS ---

const Header = () => (
  <header className="border-b bg-white h-16 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">B</div>
      <span className="font-semibold text-slate-900 tracking-tight">Bonde Studio</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-xs font-medium">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        Agent Active
      </div>
      <div className="hidden md:block text-sm text-slate-500">Sales Demo v2.1</div>
    </div>
  </header>
);

// Enhanced Context Panel - Shows BIM + Carbon data (PRD alignment)
const AgentContextPanel = ({ isOpen, toggle }: { isOpen: boolean, toggle: () => void }) => {
  const totalElements = 
    demoData.bim_geometry.elements_summary.num_walls +
    demoData.bim_geometry.elements_summary.num_windows +
    demoData.bim_geometry.elements_summary.num_slabs +
    demoData.bim_geometry.elements_summary.num_columns +
    demoData.bim_geometry.elements_summary.num_beams;

  return (
    <div className="border-b bg-slate-50 transition-all duration-300">
      <button 
        onClick={toggle}
        className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-600 hover:bg-white/50 hover:text-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            <strong className="text-slate-900">{totalElements.toLocaleString()} Elementos BIM</strong> 
            {' '}• <strong className="text-emerald-700">Verra VM0032</strong> aplicado
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-1 fade-in duration-200">
          {/* BIM Data */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <Layers className="w-3 h-3" /> Dados BIM (IFC)
            </div>
            <div className="text-xs text-slate-700 bg-white border border-slate-200 p-3 rounded-lg shadow-sm space-y-1">
              <p>• <strong>{demoData.bim_geometry.elements_summary.num_walls}</strong> Paredes</p>
              <p>• <strong>{demoData.bim_geometry.elements_summary.num_windows}</strong> Janelas</p>
              <p>• <strong>{demoData.bim_geometry.elements_summary.num_slabs}</strong> Lajes / <strong>{demoData.bim_geometry.elements_summary.num_columns}</strong> Colunas</p>
              <p>• Área Bruta: <strong>{demoData.project.gross_floor_area_m2.toLocaleString()} m²</strong></p>
            </div>
          </div>
          
          {/* Carbon Calculations */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <PieChart className="w-3 h-3" /> Cálculos de Carbono
            </div>
            <div className="text-xs text-slate-700 bg-white border border-slate-200 p-3 rounded-lg shadow-sm space-y-1">
              <p>• <strong className="text-emerald-700">Verra VM0032</strong> (Low-Carbon)</p>
              <p>• <strong>GHG Protocol</strong> (Escopos 1-3)</p>
              <p>• Base: Ecoinvent / SIN (Grid BR)</p>
              <p>• Redução: <strong className="text-emerald-700">{demoData.inventory_results.net_reduction_tco2e.toLocaleString()} tCO₂e</strong></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Markdown Message Component (Fixed with proper prose styling)
const MarkdownMessage = ({ content }: { content: string }) => (
  <div className="prose prose-sm max-w-none 
    prose-headings:text-slate-900 prose-headings:font-bold prose-headings:text-sm prose-headings:my-2
    prose-p:text-slate-700 prose-p:my-2
    prose-strong:text-slate-900 prose-strong:font-semibold
    prose-ul:text-slate-700 prose-ul:my-2 prose-ul:pl-4
    prose-li:text-slate-700 prose-li:my-1
    prose-table:text-xs prose-table:w-full
    prose-code:text-slate-800 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  </div>
);

// Query Category Selector (Fixed TypeScript types)
const QueryCategorySelector = ({ 
  activeCategory, 
  onCategoryChange 
}: { 
  activeCategory: QueryCategory['id'];
  onCategoryChange: (id: QueryCategory['id']) => void;
}) => {
  const getCategoryStyles = (cat: QueryCategory, isActive: boolean) => {
    if (!isActive) {
      return "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700";
    }
    const activeStyles: Record<string, string> = {
      emerald: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
      amber: "bg-amber-600 text-white border-amber-600 shadow-sm",
      blue: "bg-blue-600 text-white border-blue-600 shadow-sm",
      purple: "bg-purple-600 text-white border-purple-600 shadow-sm",
      slate: "bg-slate-600 text-white border-slate-600 shadow-sm"
    };
    return activeStyles[cat.color] || activeStyles.slate;
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {QUERY_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border-2 transition whitespace-nowrap",
              getCategoryStyles(cat, isActive)
            )}
          >
            <Icon className="w-3 h-3" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};

// --- MAIN APPLICATION ---

export default function App() {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'assistant', 
      content: "Olá. Sou a IA de Carbono do Bonde Studio.\n\nEstou pronta para analisar seu modelo BIM e gerar o **Project Design Document (PDD)** seguindo metodologias Verra/VCS.\n\nPara começar, faça o upload do arquivo IFC do seu projeto." 
    }
  ]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  // Fixed: Use QueryCategory['id'] type instead of string
  const [activeQueryCategory, setActiveQueryCategory] = useState<QueryCategory['id']>('materiais');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, appState]);

  // --- NARRATIVE FLOW ---

  const startIngestion = () => {
    setAppState('PARSING');
    setMessages(prev => [...prev, { id: 'u1', role: 'user', content: "Arquivo enviado: AC20-FZK-Haus.ifc (145MB)" }]);

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: 'a1', 
        role: 'assistant', 
        content: `📥 **Ingestão Iniciada**\n\nLendo geometria IFC e mapeando elementos...\n\n• **${demoData.bim_geometry.elements_summary.num_walls}** Paredes identificadas\n• **${demoData.bim_geometry.elements_summary.num_windows}** Janelas\n• **${demoData.bim_geometry.elements_summary.num_slabs}** Lajes estruturais\n• **${demoData.bim_geometry.elements_summary.num_columns}** Colunas` 
      }]);
    }, 1500);

    setTimeout(() => {
      setAppState('GAP_DETECTED');
      setMessages(prev => [...prev, { 
        id: 'a2', 
        role: 'assistant', 
        type: 'action_request', 
        content: "⚠️ **Dados Faltantes Detectados**\n\nPara aplicar a metodologia **Verra VM0032**, preciso confirmar a fonte de energia para o cálculo de Escopo 2 (eletricidade do canteiro).\n\nO modelo IFC não contém metadados de localização geográfica.\n\n**Confirmamos o uso do Grid Brasileiro (SIN) para este projeto?**" 
      }]);
    }, 4500);
  };

  const resolveGap = () => {
    setAppState('CALCULATING');
    setMessages(prev => [...prev, { id: 'u2', role: 'user', content: "Sim, confirmar Grid Brasileiro (SIN)." }]);

    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: 'a3', 
        role: 'assistant', 
        content: "✅ Fator de emissão do SIN aplicado (0.058 kgCO₂e/kWh).\n\n🔄 **Executando Cálculos de Carbono...**\n\n• Calculando baseline (cenário Business as Usual)\n• Calculando cenário de projeto (baixo carbono)\n• Determinando reduções potenciais e créditos VCS" 
      }]);
    }, 1000);

    setTimeout(() => {
      setAppState('INSIGHT_MODE');
      setShowContext(true); 
      setMessages(prev => [...prev, { 
        id: 'a4', 
        role: 'assistant', 
        content: `✅ **Análise Concluída & PDD Gerado**\n\nO projeto **${demoData.project.name}** apresenta uma redução líquida de **${demoData.inventory_results.net_reduction_tco2e.toLocaleString()} tCO₂e** (${Math.round((demoData.inventory_results.net_reduction_tco2e / demoData.inventory_results.baseline_total_tco2e) * 100)}% abaixo do baseline).\n\n**Potencial de créditos VCS:** ${demoData.inventory_results.potential_credits.toLocaleString()} créditos\n\nO documento preliminar está disponível no dashboard ao lado.\n\n---\n\n**Agora posso atuar como sua consultora técnica.** Selecione um tema abaixo para investigar:` 
      }]);
    }, 4000);
  };

  // --- LIVE CHAT ---

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isChatLoading || appState !== 'INSIGHT_MODE') return;

    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: textToSend }]);
    setInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply || "Não consegui analisar isso agora." }]);

    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "⚠️ Erro de conexão com a IA. Verifique se o servidor está rodando." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const chartData = [
    { name: 'Linha de Base', value: demoData.inventory_results.baseline_total_tco2e, fill: '#94a3b8' },
    { name: 'Projeto Real', value: demoData.inventory_results.project_total_tco2e, fill: '#10b981' }, 
  ];

  const isInsightMode = appState === 'INSIGHT_MODE';
  const activeCategoryData = QUERY_CATEGORIES.find(cat => cat.id === activeQueryCategory) || QUERY_CATEGORIES[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* === LEFT PANE: DASHBOARD / PDD === */}
        <div 
          className={cn(
            "bg-white border-r overflow-y-auto transition-all duration-700 ease-in-out absolute inset-y-0 left-0 z-0",
            isInsightMode ? "w-full md:w-[60%] translate-x-0 opacity-100" : "w-[60%] -translate-x-full opacity-0"
          )}
        >
          <div className="p-8 space-y-8 max-w-4xl mx-auto">
            <div className="border-b pb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                  <FileCheck className="w-3 h-3" /> PDD V1 Gerado
                </span>
                <span className="text-slate-400 text-xs font-medium">Metodologia Verra VM0032</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{demoData.project.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-slate-500 text-sm">
                <span>{demoData.project.location.city}, {demoData.project.location.state}</span>
                <span>•</span>
                <span>{demoData.project.typology}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Baseline</h3>
                <div className="text-2xl font-bold text-slate-700">
                  {demoData.inventory_results.baseline_total_tco2e.toLocaleString()} 
                  <span className="text-sm font-normal text-slate-400"> tCO₂e</span>
                </div>
              </div>
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Cenário Projeto</h3>
                <div className="text-2xl font-bold text-emerald-700">
                  {demoData.inventory_results.project_total_tco2e.toLocaleString()} 
                  <span className="text-sm font-normal text-emerald-500"> tCO₂e</span>
                </div>
              </div>
              <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 ring-1 ring-emerald-200">
                <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Créditos Potenciais</h3>
                <div className="text-2xl font-bold text-emerald-800">
                  {demoData.inventory_results.potential_credits.toLocaleString()} 
                  <span className="text-sm font-normal text-emerald-600"> VCS</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                Comparativo de Emissões
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                      {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-emerald-200 hover:shadow-md transition cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white border rounded-lg flex items-center justify-center text-red-500 group-hover:text-red-600 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition">Baixar PDD Completo (Draft)</p>
                    <p className="text-xs text-slate-500">PDF • Gerado agora</p>
                  </div>
                </div>
                <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT PANE: AGENT === */}
        <div 
          className={cn(
            "flex flex-col bg-white transition-all duration-700 ease-in-out relative z-10 shadow-2xl",
            isInsightMode 
              ? "w-full md:w-[40%] translate-x-0 border-l border-slate-200" 
              : "w-full max-w-2xl mx-auto border-x border-slate-200 translate-x-0"
          )}
        >
          <div className="p-4 border-b bg-white flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2 text-slate-800">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                Bonde Agent
              </h3>
              {appState !== 'INSIGHT_MODE' && appState !== 'IDLE' && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full animate-pulse font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" /> Processando
                </div>
              )}
            </div>
          </div>

          {isInsightMode && (
            <AgentContextPanel isOpen={showContext} toggle={() => setShowContext(!showContext)} />
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
            {appState === 'IDLE' && (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 bg-white text-center space-y-6 mx-4 mt-10 hover:border-emerald-400 transition-colors">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">Importar Modelo BIM</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                    Arraste seu arquivo .IFC ou .RVT para iniciar a análise de carbono.
                  </p>
                </div>
                <button 
                  onClick={startIngestion}
                  className="bg-slate-900 text-white text-sm font-medium px-6 py-3 rounded-lg hover:bg-slate-800 transition w-full shadow-lg shadow-slate-200"
                >
                  Carregar Modelo de Exemplo
                </button>
              </div>
            )}

            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-500", 
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm", 
                  msg.role === 'user' 
                    ? "bg-emerald-600 text-white rounded-tr-sm" 
                    : "bg-white border text-slate-700 rounded-tl-sm"
                )}>
                  {msg.role === 'assistant' ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  )}
                  
                  {msg.type === 'action_request' && appState === 'GAP_DETECTED' && (
                    <div className="mt-4 flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <button 
                        onClick={resolveGap}
                        className="flex items-center justify-between w-full p-3 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 rounded-md text-emerald-900 transition text-xs font-semibold text-left"
                      >
                        <span>✅ Confirmar Grid BR (SIN)</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span className="text-xs text-slate-500 font-medium">Analisando dados do projeto...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isInsightMode && !isChatLoading && (
            <div className="bg-white border-t px-4 py-3 space-y-3">
              <QueryCategorySelector 
                activeCategory={activeQueryCategory} 
                onCategoryChange={setActiveQueryCategory}
              />
              <div className="flex flex-col gap-2">
                {activeCategoryData.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className={cn(
                      "text-left p-3 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg border border-slate-200 hover:border-emerald-200 hover:text-emerald-700 hover:bg-emerald-50/50 transition active:scale-[0.98] hover:shadow-sm"
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-white border-t relative">
            <div className="relative">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={isInsightMode ? "Faça uma pergunta sobre materiais, emissões ou parâmetros..." : "Aguarde..."}
                disabled={!isInsightMode || isChatLoading}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-12 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                onClick={() => handleSendMessage()}
                disabled={!isInsightMode || !input.trim() || isChatLoading}
                className="absolute right-2 top-2 p-1.5 bg-emerald-600 text-white shadow-md rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
