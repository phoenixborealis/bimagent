// Dashboard Context - Global state management for dashboard and chat
// Implements "one brain, two faces" model: dashboard and chat share same state

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BIM_CARBON_CONTEXT } from '../data/bimCarbonContext.js';

export type AppState = 'IDLE' | 'PARSING' | 'GAP_DETECTED' | 'CALCULATING' | 'INSIGHT_MODE';

interface DashboardContextType {
  appPhase: AppState;
  setAppPhase: (phase: AppState) => void;
  bimContext: typeof BIM_CARBON_CONTEXT | null;
  setBimContext: (context: typeof BIM_CARBON_CONTEXT) => void;
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Initialize activeScenarioId from localStorage or default
  const [activeScenarioId, setActiveScenarioIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeScenarioId');
      if (stored) return stored;
    }
    return 'baseline_current_design';
  });
  
  const [appPhase, setAppPhase] = useState<AppState>('IDLE');
  const [bimContext, setBimContext] = useState<typeof BIM_CARBON_CONTEXT | null>(null);
  
  // Persist activeScenarioId to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeScenarioId', activeScenarioId);
    }
  }, [activeScenarioId]);
  
  // Wrapper to allow setting activeScenarioId with side effects if needed
  const setActiveScenarioId = (id: string) => {
    setActiveScenarioIdState(id);
  };
  
  // Initialize bimContext when entering INSIGHT_MODE
  useEffect(() => {
    if (appPhase === 'INSIGHT_MODE' && !bimContext) {
      setBimContext(BIM_CARBON_CONTEXT);
    }
  }, [appPhase, bimContext]);
  
  return (
    <DashboardContext.Provider
      value={{
        appPhase,
        setAppPhase,
        bimContext,
        setBimContext,
        activeScenarioId,
        setActiveScenarioId,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboardContext must be used within a DashboardProvider');
  }
  return context;
}
