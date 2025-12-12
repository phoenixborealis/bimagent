# Dashboard Redesign Plan - Synthesized & Refined

## Executive Summary

This refined plan transforms the dashboard into a professional BIM+Carbon cockpit aligned with established tools (One Click LCA, IfcLCA, Autodesk Insight, Planetary), while maintaining tight bidirectional integration with the chat UX. The dashboard operates both as a **standalone control center** (users can explore scenarios, benchmarks, breakdowns independently) and as a **context provider** to the chat agent (ensuring chat answers reference the currently selected scenario).

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

## 2. UI Interaction Model: Dashboard ↔ Chat Bidirectional Flow

### The Two Modes of Interaction

#### Mode 1: Dashboard-Driven (User Explores Dashboard)
```
User selects scenario in dropdown
  ↓
setActiveScenarioId(newId)
  ↓
Dashboard recomputes (all sections update)
  ↓
activeScenarioId stored in localStorage
  ↓
Chat context updates (but chat doesn't auto-respond)
  ↓
Next chat query automatically uses new scenario
```

**Behavior:**
- User switches scenarios → Dashboard updates immediately
- Chat remains passive (no automatic response)
- Next chat message will reference the newly selected scenario
- Visual indicator in chat: "Cenário ativo: Concreto baixo clínquer" (subtle badge)

#### Mode 2: Chat-Driven (User Asks About Scenario)
```
User types: "Compare o cenário concreto baixo clínquer com a baseline"
  ↓
Chat API receives message + activeScenarioId
  ↓
LLM analyzes using BIM_CARBON_CONTEXT + activeScenarioId
  ↓
LLM response includes: scenario comparison, numbers, insights
  ↓
[Optional] Dashboard could highlight scenario if LLM mentions it
```

**Behavior:**
- Chat handles scenario-specific queries using context
- Dashboard remains in current state (doesn't auto-switch)
- If user says "mostre o cenário X", consider adding "switch scenario" action button in chat response

#### Mode 3: Hybrid (Chat Suggests, Dashboard Reflects)
```
Chat suggests: "Quer ver o impacto do cenário 'Lajes mais leves'?"
  ↓
User clicks suggestion in chat
  ↓
setActiveScenarioId('lighter_slab_plus_window_optimization')
  ↓
Dashboard updates to show new scenario
  ↓
Chat sends follow-up query: "Explique o cenário 'Lajes mais leves'"
```

**Behavior:**
- Chat can trigger dashboard scenario changes via clickable suggestions
- Creates seamless flow between chat exploration and visual exploration

### State Synchronization

**State Management:**
```typescript
// Top-level state in App.tsx
const [activeScenarioId, setActiveScenarioId] = useState<string>(
  () => localStorage.getItem('activeScenarioId') || 'baseline_current_design'
);

// Sync to localStorage
useEffect(() => {
  localStorage.setItem('activeScenarioId', activeScenarioId);
}, [activeScenarioId]);

// Dashboard reads state
<DashboardPanel 
  activeScenarioId={activeScenarioId}
  onScenarioChange={setActiveScenarioId}
/>

// Chat receives state
<ChatPanel 
  activeScenarioId={activeScenarioId}
/>
```

**Chat Context Injection (Server-Side):**
```javascript
// server.js - Enhanced context
const enhancedContext = {
  ...BIM_CARBON_CONTEXT,
  active_scenario_id: req.body.activeScenarioId || 'baseline_current_design',
  active_scenario: BIM_CARBON_CONTEXT.scenarios.scenarios.find(
    s => s.id === req.body.activeScenarioId
  )
};

// Send via tools/input_json if available, or structured system prompt
systemInstruction: `
  ...
  ACTIVE_SCENARIO: ${JSON.stringify(enhancedContext.active_scenario, null, 2)}
  ...
`
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

### Key Insight

**The dashboard and chat are two views of the same state:**
- **Dashboard** = Visual exploration tool (charts, comparisons, benchmarks)
- **Chat** = Conversational exploration tool (explanations, what-ifs, detailed analysis)

Both read from `activeScenarioId` and `BIM_CARBON_CONTEXT`, ensuring consistency while allowing independent interaction patterns.

---

**This plan delivers a professional, scalable dashboard that grows incrementally while maintaining tight integration with the chat UX.**
