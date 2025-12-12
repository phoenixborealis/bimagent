# Dashboard Redesign Plan - Synthesized & Refined

## Executive Summary

This refined plan transforms the dashboard into a professional BIM+Carbon cockpit aligned with established tools (One Click LCA, IfcLCA, Autodesk Insight, Planetary, Power BI Copilot), while maintaining tight bidirectional integration with the chat UX. 

**Core Mental Model: "One Brain, Two Faces"**

* **Left:** The *carbon dashboard* (numbers, charts, scenarios, benchmarks)
* **Right:** The *carbon agent* (chat, ingestion steps, explanations, narrative)

Both read/write the **same state**: `BIM_CARBON_CONTEXT + activeScenarioId + appPhase`. That's how the dashboard and chat stay perfectly in sync—everything the user sees in chat exists on the dashboard, and vice versa. This mirrors the pattern used in Power BI Copilot and Autodesk Insight's flexible dashboard + scenario comparison.

---

## 1. Data Architecture (Refined)

### Primary Source of Truth
- ✅ **`data/bimCarbonContext.ts`** - Single source of truth (with schema versioning)
- ⚠️ **`data/demoData.ts`** - Temporary shim only, marked for deprecation
- ✅ **`server-data.js`** - Raw IFC geometry (used by LLM, referenced by context)

### Schema & Validation
```typescript
// Add to BIM_CARBON_CONTEXT
export const BIM_CARBON_CONTEXT = {
  version: "1.0.0", // Schema version for validation
  schema_date: "2025-01-15",
  // ... rest of context
};
```

**Validation Strategy:**
- Use Zod schema validation in `dashboardDataAdapter.ts`
- Validate on app startup (development) or adapter creation
- Gracefully handle schema drift with fallbacks + warnings

### Unit System (Critical)
**Canonical Internal Units:**
- **Carbon**: Always `kgCO₂e` internally
- **Display**: Convert to `tCO₂e` only in UI components (divide by 1000)
- **Area**: Always `m²` internally
- **Volume**: Always `m³` internally

**Rationale:** Prevents unit conversion bugs, keeps calculations consistent.

### Data Adapter Design
**File:** `lib/dashboardDataAdapter.ts`

**Responsibilities:**
1. Transform `BIM_CARBON_CONTEXT` → unified dashboard format
2. Validate schema version
3. Handle unit conversions (kg → t for display)
4. Simple fallback rules (only for credits/Verra metadata not in context)
5. Handle missing/partial data gracefully

**Fallback Rules (Brutally Simple):**
- Carbon numbers: **MUST** come from `BIM_CARBON_CONTEXT` (never `demoData`)
- Credits/Verra metadata: Pull from `demoData` only if missing from context
- Everything else: Fail gracefully with placeholder

---

## 2. Shared State Architecture: "One Brain, Two Faces"

### Global State Store

**Core State (React Context/Zustand/etc.):**
```typescript
{
  appPhase: "IDLE" | "PARSING" | "GAP_DETECTED" | "CALCULATING" | "INSIGHT_MODE";
  bimContext: BIM_CARBON_CONTEXT; // project_summary, carbon_baseline, scenarios, benchmarks, etc.
  activeScenarioId: string;       // e.g. "baseline_current_design"
}
```

**How State is Shared:**
- **Agent (Chat)** drives `appPhase` (upload → parsing → gap → calculating → insight)
- **Agent** fills `bimContext` when calculations are done
- **Agent** receives `activeScenarioId` with each chat message so LLM always knows current scenario
- **Dashboard** only renders when `appPhase === "INSIGHT_MODE"`
- **Dashboard** reads `bimContext` and `activeScenarioId` to populate all sections
- **Both** write to `activeScenarioId` when scenarios change

**The Contract:**
> Any carbon number the user sees in chat must exist somewhere on the dashboard, and vice versa. Everything comes from `BIM_CARBON_CONTEXT`.

---

## 3. Phase-Based Visibility: What User Sees When

### Before Analysis (IDLE / PARSING / GAP_DETECTED / CALCULATING)

**Dashboard (Left):**
- ❌ Hidden or skeleton shell (maintains orientation, shows "Processando...")

**Agent (Right):**
- ✅ Full-width conversation (100% width)
- Shows:
  - "Upload IFC" instructions
  - Ingestion progress ("Lendo geometria IFC...")
  - Gap cards ("Confirmamos uso do Grid Brasileiro (SIN)?")
  - Calculation progress ("Executando cálculos de carbono...")

**Interaction:** Chat is the *only* interaction surface; user talks to agent to get through ingestion.

**Pattern:** Similar to Autodesk Insight's flow—first upload/run analysis, then land on dashboard.

### After Analysis (INSIGHT_MODE)

**Dashboard (Left):**
- ✅ Visible (60% width, slides in from left)
- Shows all sections populated from `BIM_CARBON_CONTEXT`:
  - Project header + scenario selector
  - KPIs (reflecting `activeScenarioId`)
  - Comparison charts (baseline vs active scenario)
  - Breakdown panels
  - Benchmarks
  - Scenario explorer

**Agent (Right):**
- ✅ Visible (40% width, pinned to same project)
- Shows:
  - BIM summary card (wall/window counts, etc.)
  - Methodology card (Verra, GHG scopes, grid)
  - Conversation history (ingestion messages, gap confirmations)
  - Chat composer (with context-aware suggestions)

**Interaction:** Dual-pane mode—user can explore dashboard OR chat, both stay in sync via shared state.

---

## 4. UI Interaction Model: Dashboard ↔ Chat Bidirectional Flow

### Mode 1: Dashboard-Driven (User Explores Dashboard)
```
User selects scenario in dropdown
  ↓
setActiveScenarioId(newId)  // Updates global state
  ↓
Dashboard recomputes (all sections update immediately):
  - KPI row: numbers switch to new scenario
  - Comparison chart: scenario bar updates
  - Benchmark panel: marker moves to new intensity
  - Scenario Explorer: active card highlighted
  ↓
activeScenarioId stored in localStorage
  ↓
Chat receives activeScenarioId in next /api/chat call
  ↓
LLM can reference the new scenario:
  "No cenário *Concreto baixo clínquer*, sua intensidade cai 
   para 230 kgCO₂e/m², ~18,6% abaixo da linha de base — você 
   vê isso no cartão principal de intensidade."
```

**Behavior:**
- User switches scenarios → Dashboard updates immediately (all sections reactive)
- Chat remains passive (no automatic response)
- Next chat message will reference the newly selected scenario
- Visual indicator in chat: "Cenário ativo: Concreto baixo clínquer" (subtle badge)

**Pattern:** Same as Insight's scenario comparison and Power BI Copilot's knowledge of currently-filtered visuals.

#### Mode 2: Chat-Driven Navigation (Agent Can Drive Dashboard)

**A. Chat Queries Dashboard State**
```
User types: "Compare o cenário concreto baixo clínquer com a baseline"
  ↓
Chat API receives message + activeScenarioId
  ↓
LLM analyzes using BIM_CARBON_CONTEXT + activeScenarioId
  ↓
LLM response includes: scenario comparison, numbers, insights
  ↓
Dashboard stays current (doesn't auto-switch unless explicitly requested)
```

**B. Chat Triggers Dashboard Changes (Optional, v2+)**
```
User asks: "Ativa o cenário de lajes mais leves e me mostra o impacto"
  ↓
LLM processes request + returns:
  - Text response explaining the scenario
  - JSON payload: { "setActiveScenarioId": "lighter_slab_plus_window_optimization" }
  ↓
Frontend intercepts payload → calls setActiveScenarioId(...)
  ↓
Dashboard updates to show new scenario
  ↓
Chat shows follow-up explanation referencing the newly activated scenario
```

**Behavior:**
- Chat handles scenario-specific queries using context
- Dashboard can be driven by chat actions (Power BI Copilot pattern)
- Creates seamless "chat with your data & return visuals" loop

**Pattern:** Mirrors Microsoft's Copilot in Power BI—queries update the view, view backs the explanation.

#### Mode 3: Micro-CTAs (Dashboard Elements → Chat Questions)

**Pattern: Click dashboard element → Pre-fill chat query**

**Example: In "Onde está o carbono?" Breakdown Panel**

```
Row shows: "Concreto estrutural – 78% das emissões"
  ↓
Small link next to row: "Perguntar para o agente"
  ↓
User clicks link
  ↓
Chat composer pre-fills:
  "Explique em PT-BR por que o concreto estrutural responde 
   por 78% das emissões no cenário atual e quais estratégias 
   de redução fazem mais sentido."
  ↓
Message includes:
  - activeScenarioId (current scenario)
  - categoryId: "structural_concrete"
  ↓
User sends → LLM answers with context from that specific category
```

**Where to Add Micro-CTAs:**
- Breakdown table rows (ask about specific category)
- Benchmark panel (ask "Como melhorar minha posição?")
- Scenario cards (ask "Explique este cenário")
- KPI cards (ask "Como reduzir este valor?")

**Behavior:**
- Dashboard elements become "chat triggers"
- Creates contextual, targeted queries
- Mimics Power BI Copilot's "associate visual with trigger phrases"

**Pattern:** Power BI Copilot pattern—clicking something on the report leads to targeted chat about that same visual.

### State Synchronization Implementation

**Recommended: React Context for Global State**
```typescript
// contexts/DashboardContext.tsx
interface DashboardContextType {
  appPhase: AppState;
  setAppPhase: (phase: AppState) => void;
  bimContext: typeof BIM_CARBON_CONTEXT | null;
  setBimContext: (context: typeof BIM_CARBON_CONTEXT) => void;
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
}

// App.tsx wraps everything
<DashboardProvider>
  <App />
</DashboardProvider>

// Components consume
const { activeScenarioId, setActiveScenarioId, bimContext } = useDashboardContext();
```

**Alternative: Zustand Store (Simpler)**
```typescript
// stores/dashboardStore.ts
interface DashboardStore {
  appPhase: AppState;
  bimContext: typeof BIM_CARBON_CONTEXT | null;
  activeScenarioId: string;
  setAppPhase: (phase: AppState) => void;
  setBimContext: (context: typeof BIM_CARBON_CONTEXT) => void;
  setActiveScenarioId: (id: string) => void;
}

// Components consume
const { activeScenarioId, setActiveScenarioId } = useDashboardStore();
```

**Persistence:**
```typescript
// Sync activeScenarioId to localStorage
useEffect(() => {
  localStorage.setItem('activeScenarioId', activeScenarioId);
}, [activeScenarioId]);
```

**Benefits:**
- Single source of truth
- Easy to add debugging (log all state changes)
- Easy to add undo/redo later
- Both dashboard and chat read from same store

**Chat Context Injection (Server-Side):**
```javascript
// server.js - Enhanced context
const enhancedContext = {
  ...BIM_CARBON_CONTEXT,
  active_scenario_id: req.body.activeScenarioId || 'baseline_current_design',
  active_scenario: BIM_CARBON_CONTEXT.scenarios.scenarios.find(
    s => s.id === req.body.activeScenarioId
  ),
  // Include categoryId if coming from micro-CTA
  category_context: req.body.categoryId || null
};

// Prefer tools/input_json if API supports it (keeps system prompt small)
if (apiSupportsTools) {
  requestBody = {
    systemPrompt: "You are Bonde Studio Carbon AI. All numeric values must come from BIM_CARBON_CONTEXT. Rules: {...}",
    inputData: enhancedContext
  };
} else {
  // Fallback: structured system prompt
  systemInstruction: `
    ...
    ACTIVE_SCENARIO: ${JSON.stringify(enhancedContext.active_scenario, null, 2)}
    CATEGORY_CONTEXT: ${req.body.categoryId || 'none'}
    ...
  `
}
```

**Frontend Chat Request:**
```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: textToSend,
    activeScenarioId: activeScenarioId, // Always include
    categoryId: categoryId || null      // If from micro-CTA
  }),
});
```

---

## 3. Dashboard Phase Model (Refined)

### Phase States & Dashboard Visibility

#### IDLE
- **Dashboard**: ❌ Hidden (off-screen)
- **Chat**: ✅ Visible, upload prompt
- **State**: Initial landing

#### PARSING
- **Dashboard**: ✅ **Skeleton Shell Visible** (empty cards, grey placeholders)
- **Chat**: ✅ Progress messages
- **Visual**: Dashboard layout appears but shows "Processando geometria IFC..." in cards
- **Purpose**: Users see layout structure, maintain orientation

#### GAP_DETECTED
- **Dashboard**: ✅ Skeleton Shell (still loading)
- **Chat**: ✅ Action request (Grid BR confirmation)
- **State**: Waiting for user input

#### CALCULATING
- **Dashboard**: ✅ Skeleton Shell → **Gradually Populates** (progressive reveal)
- **Chat**: ✅ Calculation progress
- **Visual**: KPI cards fill in first, then charts, then detailed sections
- **Purpose**: Shows results appearing in real-time

#### INSIGHT_MODE ⭐
- **Dashboard**: ✅ **Fully Populated** (slides in, all sections loaded)
- **Chat**: ✅ Interactive, context-aware
- **Trigger**: Data-driven (as soon as calculations complete, max 2s fallback)

### Skeleton Shell Implementation

**Skeleton Components:**
- `<MetricCardSkeleton />` - Grey boxes with shimmer animation
- `<ChartSkeleton />` - Empty chart container with loading indicator
- `<TableSkeleton />` - Empty rows with shimmer

**Usage:**
```typescript
{isCalculating ? (
  <KPIRowSkeleton />
) : (
  <KPIRow data={dashboardData} />
)}
```

### Progressive Reveal Strategy

**Order of Reveal:**
1. Header + Project metadata (instant)
2. KPI Row (after baseline calc complete)
3. Emissions Comparison (after scenario calc complete)
4. Breakdown Panel (after category calc complete)
5. Remaining sections (Benchmark, Scenario Explorer, etc.)

**Implementation:**
```typescript
const [revealedSections, setRevealedSections] = useState<string[]>([]);

// As calculations complete, add sections
useEffect(() => {
  if (carbonBaselineComplete) {
    setRevealedSections(prev => [...prev, 'kpi-row', 'emissions-comparison']);
  }
}, [carbonBaselineComplete]);
```

---

## 4. Component Architecture (Refined with Design System)

### Design System Layer

**Base Components:**
- `<MetricCard />` - Standardized KPI card (value, label, subtext, badge)
- `<SectionCard />` - Container for major sections (title, content, optional actions)
- `<ChartContainer />` - Wrapper for Recharts with consistent styling
- `<Badge />` - Status indicators (quality, benchmark position, etc.)
- `<PlaceholderState />` - Empty/loading/error states

**Benefits:**
- Visual consistency across all panels
- Trivial refactors (change one component, all panels update)
- Easier responsive design

### Component Hierarchy

```
App.tsx
├── DashboardPanel (60% width, slides in)
│   ├── DashboardHeader
│   │   ├── ProjectMetadata (design system: SectionCard)
│   │   └── ScenarioSelector (dropdown)
│   ├── KPIRow
│   │   ├── TotalEmissionsCard (design system: MetricCard)
│   │   ├── IntensityCard (MetricCard + Badge)
│   │   ├── CreditsCard (MetricCard)
│   │   └── DataQualityCard (MetricCard + Gauge)
│   ├── DashboardTabs (optional, v2+)
│   │   ├── Tab: "Visão Geral"
│   │   │   ├── EmissionsComparisonPanel
│   │   │   └── BreakdownPanel
│   │   ├── Tab: "Cenários"
│   │   │   └── ScenarioExplorer
│   │   ├── Tab: "Benchmarks"
│   │   │   ├── BenchmarkPanel
│   │   │   └── EmbodiedVsOperationalPanel
│   │   └── Tab: "Dados"
│   │       ├── DataQualityPanel
│   │       └── BIMIntegrationPanel
│   └── (Or: All sections visible, scrollable)
└── ChatPanel (40% width, right side)
```

### Empty/Partial State Handling

**Pattern for Every Component:**
```typescript
{!data || data.length === 0 ? (
  <PlaceholderState 
    message="Dados não disponíveis para esta categoria"
    icon={<Database className="w-8 h-8" />}
  />
) : (
  <ComponentContent data={data} />
)}
```

**Partial Data:**
- Show available data
- Mark missing sections with "≈" icon or "Estimado" badge
- Tooltip explains why (reference `DATA_QUALITY.known_gaps_en`)

---

## 5. Scenario Selection & Updates (Enhanced)

### Scenario Dropdown (Header)

**Implementation:**
```typescript
<select 
  value={activeScenarioId}
  onChange={(e) => setActiveScenarioId(e.target.value)}
  className="..."
>
  <option value="baseline_current_design">
    Linha de Base (Referência)
  </option>
  {availableScenarios.map(scenario => (
    <option key={scenario.id} value={scenario.id}>
      {scenario.label_pt_br}
      {scenario.reduction_vs_baseline_percent && 
        ` (−${scenario.reduction_vs_baseline_percent.toFixed(1)}%)`
      }
    </option>
  ))}
</select>
```

### Reactive Updates

**When `activeScenarioId` Changes:**
1. Recompute `dashboardData` via `useMemo`
2. All sections re-render with new data
3. Charts animate to new values (Recharts built-in)
4. Chat context updates (but no auto-response)
5. localStorage syncs

**Performance:**
```typescript
const dashboardData = useMemo(
  () => createUnifiedDashboardData(activeScenarioId),
  [activeScenarioId, BIM_CARBON_CONTEXT] // Only recompute if scenario or context changes
);

// Memoize expensive calculations
const benchmarkComparison = useMemo(
  () => calculateBenchmarkPercentile(dashboardData.intensity, benchmarks),
  [dashboardData.intensity, benchmarks]
);
```

### Future Enhancement: Comparison Mode

**Phase 2+ Feature:**
- "Compare" button next to scenario dropdown
- Opens side-by-side view (baseline vs selected scenario)
- Similar to Autodesk Insight's scenario compare window
- Read-only, doesn't change active scenario

---

## 6. Chat Integration (Optimized)

### Context Injection Strategy

**Avoid Huge System Prompts:**
- If API supports `tools`/`input_json`: Send `BIM_CARBON_CONTEXT` there
- System prompt stays small: rules + schema reference
- Example structure:
  ```javascript
  {
    systemPrompt: "You are Bonde Studio Carbon AI. All numeric values must come from BIM_CARBON_CONTEXT. Schema: {...}",
    inputData: {
      context: BIM_CARBON_CONTEXT,
      activeScenarioId: req.body.activeScenarioId
    }
  }
  ```

**Fallback (Current Approach):**
- If tools not available, use structured system prompt
- But keep it organized: rules first, then context JSON

### Chat Suggestions (Context-Aware)

**Dynamic Suggestions Based on Dashboard State:**
```typescript
const getContextAwareSuggestions = (activeScenario, dashboardData) => {
  const scenarioName = activeScenario?.label_pt_br || 'linha de base';
  
  return [
    `Explique o cenário "${scenarioName}" em detalhes`,
    `Compare "${scenarioName}" com a linha de base`,
    `Quais 3 mudanças mais eficientes para reduzir emissões além do "${scenarioName}"?`,
    `Como este projeto se compara aos benchmarks europeus?`
  ];
};
```

### Chat Actions (Clickable Suggestions)

**Pattern:**
```typescript
// Chat suggestion can trigger dashboard action
<button 
  onClick={() => {
    setActiveScenarioId('low_clinker_concrete');
    handleSendMessage('Explique o cenário "Concreto baixo clínquer"');
  }}
>
  Ver cenário "Concreto baixo clínquer"
</button>
```

---

## 7. Implementation Phases (Vertical Slices)

### Phase 1: Foundation (Week 1)
**Deliverable: Complete vertical slice v1**

**Tasks:**
1. ✅ Create `dashboardDataAdapter.ts` with unit tests
2. ✅ Add schema versioning to `BIM_CARBON_CONTEXT`
3. ✅ Create design system base components (`MetricCard`, `SectionCard`, etc.)
4. ✅ Implement DashboardHeader + ScenarioSelector
5. ✅ Implement KPIRow (4 cards, fully wired)
6. ✅ Implement EmissionsComparisonPanel (chart + toggle + summary)
7. ✅ Integrate with chat (pass `activeScenarioId`)

**Success Criteria:**
- User can switch scenarios
- Dashboard updates reactively
- Chat receives active scenario context
- All v1 sections fully functional

---

### Phase 2: Analysis Depth (Week 2)
**Deliverable: Complete vertical slice v2**

**Tasks:**
1. ✅ Implement BreakdownPanel (pie chart + table with suggestions)
2. ✅ Implement ScenarioExplorer (scenario cards grid)
3. ✅ Wire to `REDUCTION_STRATEGIES` for suggestions
4. ✅ Enhance chat suggestions with breakdown-aware queries

**Success Criteria:**
- Users can see category breakdown
- Users can compare scenarios visually
- Chat can discuss specific materials/categories

---

### Phase 3: Benchmarks & Lifetime (Week 3)
**Deliverable: Complete vertical slice v3**

**Tasks:**
1. ✅ Implement BenchmarkPanel (violin strip + percentile markers)
2. ✅ Implement EmbodiedVsOperationalPanel (lifetime pie + grid toggle)
3. ✅ Wire to `BENCHMARKS` and `OPERATIONAL_CARBON`
4. ✅ Add coverage badges next to metrics

**Success Criteria:**
- Users can see benchmark position
- Users can explore embodied vs operational split
- Data quality indicators visible

---

### Phase 4: Polish & Export (Week 4)
**Deliverable: Complete vertical slice v4**

**Tasks:**
1. ✅ Implement DataQualityPanel (gauge + methodology)
2. ✅ Implement BIMIntegrationPanel (export buttons - UI only)
3. ✅ Add optional tab bar for organization (or keep scrollable)
4. ✅ Responsive design refinement
5. ✅ Performance optimization (memoization, lazy loading)
6. ✅ Skeleton states for all sections

**Success Criteria:**
- Complete dashboard (all 10 sections)
- Mobile/tablet responsive
- Export UI ready (backend integration later)

---

## 8. Data Quality & Coverage Display

### Coverage Badges

**Pattern: Display coverage next to metrics**

**Example - BreakdownPanel:**
```typescript
<div className="flex items-center gap-2">
  <span>Concreto estrutural</span>
  <Badge variant="success">Cobertura: 100%</Badge>
</div>

<div className="flex items-center gap-2">
  <span>Outros acabamentos</span>
  <Badge variant="warning">≈ Estimado</Badge>
  <Tooltip>
    Categoria consolidada, não mapeada explicitamente no IFC
  </Tooltip>
</div>
```

### Data Quality Panel Integration

**Show coverage percentages from `DATA_QUALITY.coverage.*`:**
- Overall gauge (0-100%)
- Breakdown by category (structural, envelope, finishes)
- Known gaps list (translated from `known_gaps_en`)

---

## 9. Responsive Design Strategy

### Breakpoints

- **Mobile (< 768px)**: 
  - Dashboard full width, scrollable
  - Chat hidden, accessible via toggle button
  - Single column layout for all sections

- **Tablet (768px - 1024px)**:
  - Dashboard 60%, Chat 40% (stacked vertically if needed)
  - Sections remain full width within dashboard

- **Desktop (> 1024px)**:
  - Dashboard 60% left, Chat 40% right (current layout)
  - Optimal viewing for all sections

### Implementation Pattern

```typescript
const isMobile = useMediaQuery('(max-width: 768px)');
const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');

<div className={cn(
  isMobile ? "w-full" : "w-full md:w-[60%]",
  // ...
)}>
```

---

## 10. Testing Strategy

### Unit Tests (Priority)

**`dashboardDataAdapter.ts`:**
- ✅ Scenario switching (baseline ↔ low-clinker)
- ✅ Percentile placement vs `BENCHMARKS.distribution`
- ✅ Embodied vs operational split calculation
- ✅ Unit conversions (kg → t)
- ✅ Schema validation
- ✅ Fallback logic

**Component Tests:**
- ✅ Rendering with mock data
- ✅ Empty state handling
- ✅ Scenario dropdown onChange
- ✅ Chart data transformation

### Integration Tests

- ✅ Dashboard appears in INSIGHT_MODE
- ✅ Scenario change updates all sections
- ✅ Chat receives active scenario context
- ✅ localStorage persistence

### Visual Regression

- ✅ Screenshot comparison for all sections
- ✅ Responsive breakpoints
- ✅ Scenario switching animations

---

## 11. Migration Path

### Deprecate `demoData.ts`

**Strategy:**
1. Add `// TODO: Remove once BIM_CARBON_CONTEXT fully wired` at top
2. Create migration checklist:
   - [ ] Credits moved to `BIM_CARBON_CONTEXT`
   - [ ] Verra metadata moved to `BIM_CARBON_CONTEXT`
   - [ ] All references removed from new code
   - [ ] Legacy references updated
3. Use `demoData` only as temporary shim for fields not yet in context

---

## 12. Success Criteria

### Functional Requirements
- ✅ All 10 PRD sections implemented and wired to `BIM_CARBON_CONTEXT`
- ✅ Scenario selection dynamically updates all sections
- ✅ Dashboard appears with skeleton during PARSING/CALCULATING
- ✅ Dashboard fully populated in INSIGHT_MODE
- ✅ Chat suggestions are context-aware
- ✅ Bidirectional sync: Dashboard changes → Chat context, Chat queries → Dashboard can react
- ✅ Responsive design works on all breakpoints

### Performance Requirements
- ✅ Dashboard renders in < 500ms after INSIGHT_MODE
- ✅ Scenario switching updates in < 200ms
- ✅ No layout shifts or janky animations
- ✅ Lazy loading for heavy sections (if needed)

### UX Requirements
- ✅ Professional appearance (aligned with One Click LCA / IfcLCA)
- ✅ Clear visual hierarchy
- ✅ Smooth animations (Recharts built-in + custom)
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Data quality transparency (coverage badges, uncertainty indicators)

---

## 13. Action Items (Prioritized)

### Immediate (Week 1)
1. ✅ **Decide on canonical units** (kg internally, t in UI) and enforce everywhere
2. ✅ **Create `dashboardDataAdapter.ts`** with Zod validation
3. ✅ **Add schema versioning** to `BIM_CARBON_CONTEXT`
4. ✅ **Create design system base components** (`MetricCard`, `SectionCard`, `ChartContainer`)
5. ✅ **Implement v1 vertical slice**: Header + KPIs + Emissions Comparison + Scenario dropdown + Chat integration

### Short-Term (Week 2-3)
6. ✅ Implement v2: Breakdown + Scenario Explorer
7. ✅ Implement v3: Benchmark + Embodied vs Operational
8. ✅ Add coverage badges next to metrics
9. ✅ Implement skeleton states for progressive reveal

### Medium-Term (Week 4+)
10. ✅ Implement v4: Data Quality + BIM Integration
11. ✅ Add optional tab bar for organization
12. ✅ Performance optimization
13. ✅ Responsive design refinement
14. ✅ Consider comparison mode for scenarios (v2+)

---

## 14. Key Architectural Decisions

### ✅ Decisions Made
- **Single source of truth**: `BIM_CARBON_CONTEXT` (with `demoData` as temporary shim)
- **Canonical units**: kg internally, display t in UI
- **Design system layer**: Base components for consistency
- **Vertical slices**: v1 → v2 → v3 → v4 (always usable)
- **Progressive reveal**: Skeleton → populate sections as data ready
- **Bidirectional sync**: Dashboard ↔ Chat (state shared, actions independent)

### ⚠️ Risks & Mitigations
- **Risk**: Schema drift in `BIM_CARBON_CONTEXT`
  - **Mitigation**: Version + Zod validation
- **Risk**: Dual data sources (`demoData` vs context)
  - **Mitigation**: Explicit deprecation plan, adapter enforces priority
- **Risk**: Over-engineering first release
  - **Mitigation**: Vertical slices (v1 minimal but complete)
- **Risk**: Performance with large datasets
  - **Mitigation**: Memoization, lazy loading, code splitting

---

## Summary: How UI Works

### The User Journey

1. **Initial State (IDLE)**: User lands, sees chat with upload prompt
2. **Upload (PARSING)**: User uploads, dashboard skeleton appears (maintains orientation)
3. **Gap Detection (GAP_DETECTED)**: User confirms grid, skeleton still visible
4. **Calculations (CALCULATING)**: Dashboard progressively populates (KPIs → charts → details)
5. **Insight Mode (INSIGHT_MODE)**: Full dashboard slides in, chat becomes interactive

### Interaction Patterns

**Pattern A: Dashboard-Driven Exploration**
- User switches scenario in dropdown → Dashboard updates → Chat context updates → Next chat query uses new scenario

**Pattern B: Chat-Driven Exploration**
- User asks about scenario → Chat answers using active scenario → Dashboard stays current → User can manually switch to see it

**Pattern C: Hybrid Flow**
- Chat suggests scenario → User clicks → Dashboard switches → Chat follows up automatically

### State Flow

```
activeScenarioId (state)
  ↓
├→ Dashboard (reads state, displays scenario)
├→ Chat (receives state, uses in API request)
└→ localStorage (persists state, survives refresh)
```

### The "Right Things" Contract: What Shows Where

**Guarantee:** Every number/claim in chat exists on dashboard, and vice versa.

#### Header + KPI Row
- Always reflect `activeScenarioId`:
  - `Total tCO₂e` = `SCENARIOS[active].total_kgco2e / 1000`
  - `Intensidade` = `SCENARIOS[active].intensity_kgco2e_per_m2`
  - Benchmark badge uses `BENCHMARKS.distribution` and `BENCHMARKS.targets`
- Agent can say "Você está abaixo da meta 2030" and UI visually agrees

#### Emissions Comparison
- Shows baseline vs active scenario (optionally "best scenario")
- Metric toggle (tCO₂e / kg/m² / kg/m²·ano) re-scales but always uses `BIM_CARBON_CONTEXT` values
- Agent mentions same numbers visible in chart

#### Breakdown by System
- Uses `CARBON_BASELINE.by_category` plus scenario deltas
- `REDUCTION_STRATEGIES` provides "what to do" column
- Agent reuses same entries for advice (consistent copy across chart + chat)
- Micro-CTAs on rows trigger category-specific chat queries

#### Benchmarks & Embodied vs Operational
- Benchmark panel: Marker position = intensity on KPI card = value referenced by agent
- Embodied vs operational: Uses `CARBON_BASELINE.total_embodied_kgco2e` + `OPERATIONAL_CARBON.total_operational_kgco2e_lifetime_current_grid`
- Agent mentions ratio (e.g. "incorporado ~24% do total") → **visible** in that chart

#### Data Quality & BIM Integration
- `DATA_QUALITY.coverage` drives:
  - "Qualidade dos dados" KPI badge
  - Tooltips in charts where coverage incomplete
- `IFC_WRITEBACK` appears as descriptive text + export info
- Agent can reference when user asks "Como isso volta para o meu modelo BIM?"

### Key Insight

**The dashboard and chat are two faces of one brain:**
- **Dashboard** = Visual exploration tool (charts, comparisons, benchmarks, scenario switching)
- **Chat** = Conversational exploration tool (explanations, what-ifs, detailed analysis, narrative)

Both read/write the same state (`activeScenarioId`, `bimContext`, `appPhase`), ensuring perfect synchronization. When you switch anything on one side, the other side "just knows" and stays visually and verbally aligned.

**Pattern:** Mirrors Power BI Copilot + Autodesk Insight—dashboard is the stable cockpit, chat is the narrative and action surface, both backed by explicit documented assumptions.

---

**This plan delivers a professional, scalable dashboard that grows incrementally while maintaining tight integration with the chat UX.**
