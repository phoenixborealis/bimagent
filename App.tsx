import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, ChevronRight, MessageSquare, Send, Download, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { demoData } from './data/demoData'; 
import { cn } from './lib/utils'; 

// --- COMPONENTS ---

const Header = () => (
  <header className="border-b bg-white sticky top-0 z-10">
    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">B</div>
        <span className="font-semibold text-slate-900">Bonde Studio</span>
      </div>
      <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full border">
        Carbon BIM Agent v0.1 (Demo)
      </div>
    </div>
  </header>
);

const KPICard = ({ title, value, unit, colorClass, highlight = false }: { title: string, value: string, unit: string, colorClass: string, highlight?: boolean }) => (
  <div className={cn("bg-white p-6 rounded-xl border shadow-sm", highlight ? "ring-2 ring-emerald-500/20 border-emerald-500/50" : "")}>
    <h3 className="text-sm font-medium text-slate-500 mb-2">{title}</h3>
    <div className="flex items-baseline gap-1">
      <span className={cn("text-3xl font-bold tracking-tight", colorClass)}>{value}</span>
      <span className="text-sm text-slate-400 font-medium">{unit}</span>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---

export default function App() {
  const [appState, setAppState] = useState<'upload' | 'loading' | 'dashboard'>('upload');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Iniciando...");
  
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: "Olá. Analisei seu modelo. Sou especialista em inventário de carbono para obras, usando um modelo inspirado em metodologias Verra/VCS e GHG Protocol. Pode me perguntar sobre materiais, emissões específicas ou auditoria." }
  ]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLoadDemo = () => {
    setAppState('loading');
    const totalTime = 3000;
    const interval = 50;
    let current = 0;

    const timer = setInterval(() => {
      current += interval;
      const progress = Math.min((current / totalTime) * 100, 100);
      setLoadingProgress(progress);

      if (progress < 30) setLoadingText("Lendo geometria IFC...");
      else if (progress < 70) setLoadingText("Carregando fatores de emissão de referência...");
      else setLoadingText("Calculando inventário (GHG Protocol Escopos 1-3)...");

      if (progress >= 100) {
        clearInterval(timer);
        setTimeout(() => setAppState('dashboard'), 500);
      }
    }, interval);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isChatLoading) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      // API call to the backend which handles the cached context
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.reply || "Não consegui gerar uma resposta.";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Erro de conexão: Ocorreu um problema ao contatar a IA." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const chartData = [
    { name: 'Linha de Base', value: demoData.inventory_results.baseline_total_tco2e, fill: '#ef4444' }, 
    { name: 'Projeto Real', value: demoData.inventory_results.project_total_tco2e, fill: '#10b981' },   
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Header />

      {appState === 'upload' && (
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                Transforme seu modelo BIM em <span className="text-emerald-600">ativos ambientais</span>.
              </h1>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">
                Análise automática de carbono incorporado e simulação de elegibilidade para créditos de carbono.
              </p>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 bg-slate-50 transition hover:bg-slate-100 hover:border-emerald-400 cursor-pointer group">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-medium text-slate-900">Arraste seu arquivo IFC aqui</p>
                  <p className="text-sm text-slate-500">ou clique para selecionar do computador</p>
                </div>
                <button className="mt-4 px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition">
                  Enviar arquivo IFC
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-50 text-slate-500">Demonstração</span></div>
            </div>
            <button 
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-2 text-emerald-700 font-semibold hover:text-emerald-800 transition px-6 py-3 rounded-lg bg-emerald-50 hover:bg-emerald-100"
            >
              Usar modelo de exemplo (Residencial Alto do Parque)
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      )}

      {appState === 'loading' && (
        <main className="flex-1 flex flex-col items-center justify-center p-4 bg-white/50 backdrop-blur-sm fixed inset-0 z-50">
          <div className="w-full max-w-md space-y-6 text-center">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
            <h2 className="text-2xl font-semibold text-slate-900">{loadingText}</h2>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </main>
      )}

      {appState === 'dashboard' && (
        <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{demoData.project.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-slate-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>{demoData.project.location.city}, {demoData.project.location.state}</span>
                <span>•</span>
                <span>{demoData.project.typology}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-slate-50">Exportar Relatório</button>
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm shadow-emerald-200">Finalizar Inventário</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard title="Linha de Base" value={demoData.inventory_results.baseline_total_tco2e.toLocaleString()} unit="tCO₂e" colorClass="text-slate-900" />
            <KPICard title="Projeto Real" value={demoData.inventory_results.project_total_tco2e.toLocaleString()} unit="tCO₂e" colorClass="text-emerald-600" />
            <KPICard title="Potencial de Créditos" value={demoData.inventory_results.potential_credits.toLocaleString()} unit="créditos" colorClass="text-amber-500" highlight={true} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-lg font-semibold mb-6">Comparativo de Emissões</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" unit=" tCO₂e" />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 14}} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                        {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Documentação Gerada</h3>
                <div className="space-y-3">
                  {[{ name: "Project Description (PDD)", type: "PDF" }, { name: "Template Verra VCS", type: "DOCX" }].map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><FileText className="w-5 h-5" /></div>
                        <div><p className="font-medium text-slate-900">{doc.name}</p><p className="text-xs text-slate-500">{doc.type}</p></div>
                      </div>
                      <Download className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 h-[600px] flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-emerald-50/50">
                <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-5 h-5 text-emerald-600" />Bonde AI Agent</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed", msg.role === 'user' ? "bg-emerald-600 text-white" : "bg-white border text-slate-800")}>{msg.content}</div>
                  </div>
                ))}
                {isChatLoading && <div className="text-xs text-slate-400 p-2">Analisando...</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t bg-white flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Digite sua pergunta..." className="flex-1 bg-slate-50 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <button onClick={handleSendMessage} disabled={!input.trim() || isChatLoading} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}