# Dashboard Redesign Implementation Plan

## Executive Summary

This plan outlines the transformation of the current simple 3-KPI dashboard into a comprehensive BIM+Carbon cockpit aligned with professional tools (One Click LCA, IfcLCA, Autodesk Insight). The dashboard will be dynamically generated from `BIM_CARBON_CONTEXT` data structure and integrate seamlessly with the chat UX phases.

---

## 1. Data Architecture & Sources

### Current Data State
- ✅ **`data/bimCarbonContext.ts`** - Comprehensive structured context (PROJECT_SUMMARY, CARBON_BASELINE, SCENARIOS, BENCHMARKS, etc.)
- ✅ **`server-data.js`** - Raw IFC geometry data
- ✅ **`server.js`** - Already injects `BIM_CARBON_CONTEXT` to LLM
- ⚠️ **`data/demoData.ts`** - Simple legacy demo data (needs migration/alignment)

### Data Source Mapping to PRD Sections

| PRD Section | Primary Data Source | Secondary Source | Transformation Needed |
|------------|---------------------|------------------|----------------------|
| **1. Header Strip** | `PROJECT_SUMMARY` + `SCENARIOS` | `demoData.project` | Merge project metadata |
| **2. KPI Row** | `CARBON_BASELINE` + `SCENARIOS` + `BENCHMARKS` | `demoData.inventory_results` | Calculate intensity, benchmark comparison |
| **3. Emissions Comparison** | `SCENARIOS.scenarios[]` | `CARBON_BASELINE` | Toggle between tCO₂e, kg/m², kg/m²/ano |
| **4. Breakdown by System** | `CARBON_BASELINE.by_category` | `REDUCTION_STRATEGIES` | Map categories to suggestions |
| **5. Benchmark Panel** | `BENCHMARKS.distribution` + `CARBON_BASELINE` | `BENCHMARKS.targets` | Percentile positioning |
| **6. Scenario Explorer** | `SCENARIOS.scenarios[]` | `CARBON_BASELINE` | Card-based visualization |
| **7. Embodied vs Operational** | `CARBON_BASELINE` + `OPERATIONAL_CARBON` | - | 50-year comparison calculation |
| **8. Data Quality** | `DATA_QUALITY.coverage.*` | `DATA_QUALITY.known_gaps_en` | Coverage percentage calculation |
| **9. BIM Integration** | `IFC_WRITEBACK` | `server-data.js` | Export mapping (future implementation) |
| **10. Chat Panel** | `BIM_CARBON_CONTEXT` (already injected) | - | Enhanced suggestions based on dashboard context |

---

## 2. Dashboard Dynamic Creation & Chat UX Phase Integration

### Phase Mapping: Dashboard Visibility & Content

#### **Phase 1: IDLE** (Initial State)
- **Dashboard**: ❌ Not visible (hidden off-screen)
- **Chat**: ✅ Visible, shows upload prompt
- **State**: User hasn't started ingestion

#### **Phase 2: PARSING** (File Upload Processing)
- **Dashboard**: ❌ Not visible
- **Chat**: ✅ Shows progress messages
- **State**: Simulating IFC parsing, extracting geometry
- **Messages**: "📥 **Ingestão Iniciada**\n\nLendo geometria IFC..."

#### **Phase 3: GAP_DETECTED** (Missing Data Confirmation)
- **Dashboard**: ❌ Not visible
- **Chat**: ✅ Shows action request (Grid BR confirmation)
- **State**: Waiting for user to confirm grid electricity source
- **Messages**: "⚠️ **Dados Faltantes Detectados**..."

#### **Phase 4: CALCULATING** (Carbon Calculations Running)
- **Dashboard**: ❌ Not visible
- **Chat**: ✅ Shows calculation progress
- **State**: Executing carbon baseline + scenario calculations
- **Messages**: "🔄 **Executando Cálculos de Carbono...**"

#### **Phase 5: INSIGHT_MODE** (Dashboard Reveal & Chat Active) ⭐
- **Dashboard**: ✅ **SLIDES IN FROM LEFT** (60% width, animated)
- **Chat**: ✅ Visible on right (40% width)
- **State**: Calculations complete, dashboard fully populated
- **Trigger**: After 4-second delay in `resolveGap()` function
- **Data Population**: Dashboard reads from `BIM_CARBON_CONTEXT` (merged with `demoData` for legacy fields)

### Dashboard Reveal Animation Flow

```
CALCULATING (4s delay)
  ↓
setAppState('INSIGHT_MODE')
  ↓
setShowContext(true)
  ↓
Dashboard slides in from left (-translate-x-full → translate-x-0)
  ↓
All 10 sections render with data from BIM_CARBON_CONTEXT
  ↓
Chat panel becomes interactive with context-aware suggestions
```

---

## 3. Component Architecture Plan

### New Component Structure

```
App.tsx (Main Orchestrator)
├── DashboardPanel (60% width, slides in)
│   ├── DashboardHeader (Section 1)
│   │   ├── ProjectMetadata
│   │   └── ScenarioSelector (dropdown)
│   ├── KPIRow (Section 2)
│   │   ├── TotalEmissionsCard
│   │   ├── IntensityCard (with benchmark badge)
│   │   ├── CreditsCard
│   │   └── DataQualityCard
│   ├── EmissionsComparisonPanel (Section 3)
│   │   ├── MetricToggle (tCO₂e / kg/m² / kg/m²/ano)
│   │   ├── ComparisonChart (Recharts horizontal bar)
│   │   └── SummaryText
│   ├── BreakdownPanel (Section 4)
│   │   ├── CategoryChart (Pie or stacked bar - Recharts)
│   │   └── CategoryTable (with reduction suggestions)
│   ├── BenchmarkPanel (Section 5)
│   │   ├── ViolinStripChart (custom SVG or Recharts area)
│   │   └── BenchmarkText
│   ├── ScenarioExplorer (Section 6)
│   │   └── ScenarioCard[] (grid layout)
│   ├── EmbodiedVsOperationalPanel (Section 7)
│   │   ├── LifetimePieChart (Recharts)
│   │   └── GridToggle (current / future)
│   ├── DataQualityPanel (Section 8)
│   │   ├── QualityGauge (custom SVG)
│   │   └── MethodologySummary
│   └── BIMIntegrationPanel (Section 9)
│       └── ExportButtons
└── ChatPanel (40% width, right side)
    └── (Existing chat components)
```

### Component Data Props Mapping

```typescript
// Dashboard receives unified data object
interface DashboardData {
  project: PROJECT_SUMMARY;
  carbonBaseline: CARBON_BASELINE;
  scenarios: SCENARIOS;
  activeScenarioId: string; // Selected scenario
  benchmarks: BENCHMARKS;
  operationalCarbon: OPERATIONAL_CARBON;
  dataQuality: DATA_QUALITY;
  reductionStrategies: REDUCTION_STRATEGIES;
}

// Each section component receives relevant slice
<KPIRow 
  baseline={carbonBaseline}
  activeScenario={scenarios.scenarios.find(s => s.id === activeScenarioId)}
  benchmarks={benchmarks}
  dataQuality={dataQuality}
/>
```

---

## 4. Data Transformation & Merging Strategy

### Challenge: Multiple Data Sources
- `bimCarbonContext.ts` has comprehensive structured data (SCENARIOS, BENCHMARKS, etc.)
- `demoData.ts` has legacy format with `inventory_results` (different structure)
- `server-data.js` has raw IFC geometry

### Solution: Create Unified Data Adapter

**New File: `lib/dashboardDataAdapter.ts`**

```typescript
// Purpose: Transform BIM_CARBON_CONTEXT + demoData into unified dashboard format

import { BIM_CARBON_CONTEXT } from '../data/bimCarbonContext';
import { demoData } from '../data/demoData';

export interface UnifiedDashboardData {
  // Header
  projectName: string;
  location: { city: string; state: string };
  typology: string;
  methodology: string;
  availableScenarios: Scenario[];
  activeScenarioId: string;
  
  // KPIs
  totalEmissions: number; // from active scenario
  intensity: number; // kgCO₂e/m²
  credits: number; // from demoData for now
  dataQuality: DataQualitySummary;
  
  // Emissions Comparison
  baselineEmissions: number;
  activeScenarioEmissions: number;
  bestScenarioEmissions: number;
  
  // Breakdown
  breakdownByCategory: CategoryBreakdown[];
  
  // Benchmarks
  percentilePosition: number; // p10, p50, p90
  targetComparison: TargetComparison;
  
  // Scenarios
  scenarios: Scenario[];
  
  // Embodied vs Operational
  embodiedTotal: number;
  operationalLifetime: number;
  operationalFuture: number;
  
  // Data Quality
  coveragePercentage: number;
  knownGaps: string[];
}

export function createUnifiedDashboardData(
  activeScenarioId: string = 'baseline_current_design'
): UnifiedDashboardData {
  const ctx = BIM_CARBON_CONTEXT;
  const activeScenario = ctx.scenarios.scenarios.find(s => s.id === activeScenarioId);
  
  // Merge logic:
  // 1. Use BIM_CARBON_CONTEXT as primary source
  // 2. Fallback to demoData for missing fields (credits, etc.)
  // 3. Compute derived metrics (intensity, percentile, etc.)
  
  return {
    projectName: ctx.project_summary.name_pt_br || demoData.project.name,
    location: demoData.project.location,
    typology: demoData.project.typology,
    methodology: demoData.project.methodologies[0],
    availableScenarios: ctx.scenarios.scenarios,
    activeScenarioId,
    
    totalEmissions: activeScenario?.total_kgco2e || ctx.carbon_baseline.total_embodied_kgco2e,
    intensity: activeScenario?.intensity_kgco2e_per_m2 || ctx.carbon_baseline.intensity_kgco2e_per_m2,
    credits: demoData.inventory_results.potential_credits, // Legacy field
    dataQuality: computeDataQualitySummary(ctx.data_quality),
    
    // ... rest of mappings
  };
}
```

---

## 5. Scenario Selection & Dynamic Updates

### State Management

**New State Variable in `App.tsx`:**
```typescript
const [activeScenarioId, setActiveScenarioId] = useState<string>('baseline_current_design');
```

### Scenario Dropdown (Header Section)

```tsx
<select 
  value={activeScenarioId}
  onChange={(e) => setActiveScenarioId(e.target.value)}
  className="..."
>
  {availableScenarios.map(scenario => (
    <option key={scenario.id} value={scenario.id}>
      {scenario.label_pt_br}
    </option>
  ))}
</select>
```

### Reactive Updates

When `activeScenarioId` changes:
1. **Recompute KPIs** using selected scenario
2. **Update Emissions Comparison** chart
3. **Update Benchmark** marker position
4. **Update Breakdown** (if scenario affects category breakdown)
5. **Re-render Scenario Explorer** (highlight active card)

**Implementation Pattern:**
```typescript
const dashboardData = useMemo(
  () => createUnifiedDashboardData(activeScenarioId),
  [activeScenarioId]
);
```

---

## 6. Chat UX Integration & Context-Aware Suggestions

### Enhanced Query Categories

**Update `QUERY_CATEGORIES` in `App.tsx`:**

```typescript
const QUERY_CATEGORIES: QueryCategory[] = [
  {
    id: 'materiais',
    label: 'Materiais',
    icon: Layers,
    color: 'emerald',
    suggestions: [
      'Quais materiais mais contribuem para as emissões totais?',
      `Quanto ${getActiveMaterial(dashboardData)} temos no projeto?`,
      'Qual a quantidade de aço utilizada por tipo?'
    ]
  },
  {
    id: 'cenários',
    label: 'Cenários',
    icon: Repeat,
    color: 'purple',
    suggestions: [
      `Compare o cenário "${activeScenario.label}" com a linha de base`,
      'Quais 3 mudanças mais eficientes para reduzir emissões?',
      'Mostre o impacto do cenário "Concreto baixo clínquer"'
    ]
  },
  // ... other categories
];
```

### Context Injection to Chat

**Update `/api/chat` handler in `server.js`:**

```javascript
// Already has BIM_CARBON_CONTEXT, but enhance with active scenario
const enhancedContext = {
  ...BIM_CARBON_CONTEXT,
  active_scenario_id: req.body.activeScenarioId || 'baseline_current_design',
  active_scenario_data: BIM_CARBON_CONTEXT.scenarios.scenarios.find(
    s => s.id === req.body.activeScenarioId
  )
};

systemInstruction: `
  ...
  ACTIVE SCENARIO: ${JSON.stringify(enhancedContext.active_scenario_data)}
  ...
`
```

### Frontend Chat Request Enhancement

**Update `handleSendMessage` in `App.tsx`:**

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: textToSend,
    activeScenarioId: activeScenarioId // Pass current scenario
  }),
});
```

---

## 7. Implementation Phases

### Phase 1: Data Layer (Foundation)
**Files to Create/Update:**
- ✅ Create `lib/dashboardDataAdapter.ts` - Unified data transformation
- ✅ Update `data/bimCarbonContext.ts` - Ensure all PRD fields exist
- ✅ Align `demoData.ts` structure with `BIM_CARBON_CONTEXT` (or deprecate)

**Deliverables:**
- Unified data adapter function
- TypeScript interfaces for dashboard data
- Data mapping documentation

---

### Phase 2: Component Structure (UI Foundation)
**Files to Create:**
- ✅ Create `components/dashboard/` directory
- ✅ Create `components/dashboard/DashboardHeader.tsx`
- ✅ Create `components/dashboard/KPIRow.tsx`
- ✅ Create `components/dashboard/EmissionsComparisonPanel.tsx`
- ✅ Create `components/dashboard/BreakdownPanel.tsx`
- ✅ Create `components/dashboard/BenchmarkPanel.tsx`
- ✅ Create `components/dashboard/ScenarioExplorer.tsx`
- ✅ Create `components/dashboard/EmbodiedVsOperationalPanel.tsx`
- ✅ Create `components/dashboard/DataQualityPanel.tsx`
- ✅ Create `components/dashboard/BIMIntegrationPanel.tsx`

**Deliverables:**
- All 10 section components (stubbed initially)
- Component props interfaces
- Basic layout structure

---

### Phase 3: Core Sections (Priority 1)
**Sections to Implement:**
1. ✅ **DashboardHeader** (Section 1) - Project metadata + scenario dropdown
2. ✅ **KPIRow** (Section 2) - 4 KPI cards with dynamic data
3. ✅ **EmissionsComparisonPanel** (Section 3) - Toggle + chart + summary

**Integration:**
- Wire to `dashboardDataAdapter`
- Connect scenario dropdown to state
- Test reactive updates

---

### Phase 4: Analysis Sections (Priority 2)
**Sections to Implement:**
4. ✅ **BreakdownPanel** (Section 4) - Pie chart + table with suggestions
5. ✅ **BenchmarkPanel** (Section 5) - Violin strip + percentile markers
6. ✅ **ScenarioExplorer** (Section 6) - Scenario cards grid

**Integration:**
- Connect to `CARBON_BASELINE.by_category`
- Connect to `BENCHMARKS` data
- Connect to `REDUCTION_STRATEGIES`

---

### Phase 5: Advanced Sections (Priority 3)
**Sections to Implement:**
7. ✅ **EmbodiedVsOperationalPanel** (Section 7) - Lifetime pie + grid toggle
8. ✅ **DataQualityPanel** (Section 8) - Gauge + methodology summary
9. ✅ **BIMIntegrationPanel** (Section 9) - Export buttons (UI only, export logic later)

**Integration:**
- Connect to `OPERATIONAL_CARBON`
- Connect to `DATA_QUALITY`
- Connect to `IFC_WRITEBACK` (for export mapping info)

---

### Phase 6: Chat Integration & Polish
**Tasks:**
- ✅ Update `QUERY_CATEGORIES` with scenario-aware suggestions
- ✅ Enhance `/api/chat` to receive `activeScenarioId`
- ✅ Update chat suggestions based on dashboard context
- ✅ Add smooth animations between scenario changes
- ✅ Responsive design testing (mobile, tablet, desktop)
- ✅ Performance optimization (React.memo, useMemo for heavy calculations)

---

## 8. Technical Implementation Details

### Scenario Selection State Flow

```
User selects scenario in dropdown
  ↓
setActiveScenarioId(newId)
  ↓
useMemo recomputes dashboardData
  ↓
All components re-render with new data
  ↓
Chart animations update (Recharts)
  ↓
Chat suggestions update (context-aware)
```

### Performance Considerations

**Memoization Strategy:**
```typescript
// Expensive calculations
const intensityComparison = useMemo(
  () => calculateBenchmarkPercentile(dashboardData.intensity, benchmarks),
  [dashboardData.intensity, benchmarks]
);

// Component memoization
const KPIRow = React.memo(({ data }: { data: KPIData }) => {
  // Component logic
});
```

**Lazy Loading (Future Optimization):**
- Load heavy chart components only when dashboard is visible
- Code-split ScenarioExplorer (many cards)

---

### Responsive Design Strategy

**Breakpoints:**
- **Mobile (< 768px)**: Dashboard full width, chat hidden (toggle button)
- **Tablet (768px - 1024px)**: Dashboard 60%, Chat 40% (stacked vertically if needed)
- **Desktop (> 1024px)**: Dashboard 60% left, Chat 40% right (current layout)

**Implementation:**
```typescript
const isMobile = window.innerWidth < 768;
const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

// Adjust layout classes dynamically
className={cn(
  isMobile ? "w-full" : "w-full md:w-[60%]",
  // ...
)}
```

---

## 9. Data Quality & Gap Handling

### Missing Data Scenarios

**Strategy:**
1. **Show placeholders** with "Dados não disponíveis" for missing fields
2. **Calculate partial metrics** when possible (e.g., intensity without total if area is missing)
3. **Tooltips explain** why data is missing (reference `DATA_QUALITY.known_gaps_en`)

**Implementation Pattern:**
```typescript
{dataQuality.coverage.structural > 0 ? (
  <MetricCard value={structuralEmissions} />
) : (
  <PlaceholderCard message="Cobertura estrutural insuficiente" />
)}
```

---

## 10. Integration with Existing Code

### App.tsx Changes Required

**Minimal Changes:**
1. Import `createUnifiedDashboardData`
2. Add `activeScenarioId` state
3. Replace existing dashboard content with new `<DashboardPanel />`
4. Pass `dashboardData` and `activeScenarioId` to chat

**Code Structure:**
```typescript
// In App.tsx
const [activeScenarioId, setActiveScenarioId] = useState('baseline_current_design');
const dashboardData = useMemo(
  () => createUnifiedDashboardData(activeScenarioId),
  [activeScenarioId]
);

// In DashboardPanel render
{isInsightMode && (
  <DashboardPanel 
    data={dashboardData}
    activeScenarioId={activeScenarioId}
    onScenarioChange={setActiveScenarioId}
  />
)}
```

---

## 11. Testing Strategy

### Unit Tests
- ✅ `dashboardDataAdapter.ts` - Test data transformation logic
- ✅ Component rendering with mock data
- ✅ Scenario switching logic

### Integration Tests
- ✅ Dashboard appears in INSIGHT_MODE
- ✅ Scenario dropdown updates all sections
- ✅ Chat receives active scenario context

### Visual Regression
- ✅ Screenshot comparison of dashboard sections
- ✅ Responsive layout breakpoints

---

## 12. Migration Path from Current Dashboard

### Current Dashboard Code (to Replace)

**Location:** `App.tsx` lines 341-423

**What Gets Replaced:**
- Simple 3 KPI cards → Full KPIRow with 4 cards
- Simple bar chart → EmissionsComparisonPanel with toggle
- Basic header → DashboardHeader with scenario dropdown
- **Add:** 7 new sections (Breakdown, Benchmark, ScenarioExplorer, etc.)

**Migration Steps:**
1. Create new components in parallel
2. Test new dashboard in isolation
3. Replace old dashboard with new components
4. Verify chat integration still works

---

## 13. Success Criteria

### Functional Requirements
- ✅ All 10 PRD sections implemented and wired to data
- ✅ Scenario selection dynamically updates all sections
- ✅ Dashboard appears smoothly in INSIGHT_MODE
- ✅ Chat suggestions are context-aware
- ✅ Responsive design works on all breakpoints

### Performance Requirements
- ✅ Dashboard renders in < 500ms after INSIGHT_MODE
- ✅ Scenario switching updates in < 200ms
- ✅ No layout shifts or janky animations

### UX Requirements
- ✅ Dashboard feels professional (like One Click LCA / IfcLCA)
- ✅ Clear visual hierarchy
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Smooth animations

---

## 14. Next Steps & Dependencies

### Immediate Next Steps
1. **Review this plan** - Confirm approach aligns with requirements
2. **Create `lib/dashboardDataAdapter.ts`** - Foundation data layer
3. **Create component directory structure** - `components/dashboard/`
4. **Implement DashboardHeader** - First section (easiest, establishes pattern)

### Dependencies
- ✅ `bimCarbonContext.ts` - Already exists and comprehensive
- ✅ Recharts library - Already installed
- ⚠️ May need additional chart types (violin plot - custom SVG or Recharts area)

### Blockers
- None identified - all data sources exist, all libraries available

---

## Summary

This plan transforms the simple dashboard into a comprehensive BIM+Carbon cockpit that:
- ✅ Connects to `BIM_CARBON_CONTEXT`, `IFC_DATA`, and server-side data
- ✅ Dynamically updates based on scenario selection
- ✅ Integrates with chat UX phases (appears in INSIGHT_MODE)
- ✅ Follows professional tool patterns (One Click LCA, IfcLCA, Insight)
- ✅ Maintains existing chat functionality while enhancing it

**Ready to proceed with implementation once approved.**
