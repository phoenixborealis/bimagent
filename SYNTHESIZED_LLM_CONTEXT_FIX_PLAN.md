# Synthesized LLM Context Fix Plan
## Combining Pre-Computed Aggregates + Semantic Layer Separation

---

## Problem Analysis

### Root Cause
The LLM is accessing raw `ifc_data` (individual IFC elements) instead of pre-computed aggregated data because:

1. **Too much low-level data in context**: `ifc_data` is included in the same payload as aggregated data, causing the model to latch onto concrete, local values (individual walls/slabs) and recompute instead of using aggregates.

2. **Weak instruction enforcement**: Current instructions say "prefer aggregated data" but don't explicitly ban `ifc_data`, so the model still parses it when present.

3. **Default case sends everything**: The `default` case (line 194-202) sends full `BIM_CARBON_CONTEXT` including `ifc_data`, which confuses the model.

4. **Mixing data warehouse and semantic layer**: Raw facts (IFC elements) are mixed with semantic layer (carbon_baseline, quick_ref), violating analytics best practices.

---

## Solution Architecture

### Core Principle: Semantic Layer Only
- **Raw data** (`ifc_data`) stays on server for dashboards/tools/debug
- **Semantic layer** (aggregates) goes to LLM
- **Explicit bans** on raw data access
- **Targeted context slices** instead of full dumps

---

## Implementation Plan

### Phase 1: Remove `ifc_data` from LLM Context (CRITICAL)

**File**: `server.js`

**Change 1.1: Create safe context extractor**
```javascript
// Helper function to create safe context (no ifc_data)
function createSafeContext(includeSections = null) {
  const { ifc_data, ifc_writeback, ...safeContext } = BIM_CARBON_CONTEXT;
  
  // If specific sections requested, return only those
  if (includeSections) {
    const filtered = {};
    includeSections.forEach(section => {
      if (safeContext[section]) {
        filtered[section] = safeContext[section];
      }
    });
    return filtered;
  }
  
  return safeContext;
}
```

**Change 1.2: Update default case (line 194-202)**
```javascript
default:
  // For general questions, send targeted aggregate sections (NOT full context)
  contextSection = JSON.stringify({
    quick_ref: BIM_CARBON_CONTEXT.quick_ref,
    carbon_baseline: BIM_CARBON_CONTEXT.carbon_baseline,
    geometry_aggregates: BIM_CARBON_CONTEXT.geometry_aggregates,
    material_factors: BIM_CARBON_CONTEXT.material_factors,
    scenarios: BIM_CARBON_CONTEXT.scenarios,
    benchmarks: BIM_CARBON_CONTEXT.benchmarks,
    reduction_strategies: BIM_CARBON_CONTEXT.reduction_strategies,
    operational_carbon: BIM_CARBON_CONTEXT.operational_carbon,
    data_quality: BIM_CARBON_CONTEXT.data_quality,
    project_summary: BIM_CARBON_CONTEXT.project_summary,
    active_scenario: activeScenario,
    active_scenario_id: scenarioId,
    category_context: categoryId || null
    // NOTE: ifc_data and ifc_writeback explicitly excluded
  }, null, 2);
  specificInstructions = 'Use any relevant section from the context above. Check quick_ref first for common queries. DO NOT access ifc_data - it is not included in this context.';
  break;
```

**Change 1.3: Update all other cases to use safe context**
All existing cases (emissions_by_category, concrete_quantity, etc.) already exclude `ifc_data` - they're fine as-is. Just ensure they don't accidentally include it.

---

### Phase 2: Strengthen System Instructions (CRITICAL)

**File**: `server.js` (line 29-49)

**Replace systemInstruction with:**
```javascript
systemInstruction: `
  You are the Bonde Studio Carbon AI, a carbon analysis copilot.
  
  You MUST answer using ONLY pre-computed, aggregated values from the JSON context provided in each user message.
  
  ABSOLUTE RULES:
  1. DO NOT read or use raw IFC elements (ifc_data) for calculations.
  2. DO NOT sum, count, or recompute geometry from raw data.
  3. DO NOT access individual IFC elements (walls, slabs, windows) by ID.
  4. USE ONLY these allowed sources for numbers:
     - quick_ref.* (flattened structure for common queries)
     - carbon_baseline.* (pre-computed emissions by category)
     - geometry_aggregates.* (pre-computed volumes/areas)
     - material_factors.* (emission factors)
     - scenarios.* (pre-computed alternatives)
     - benchmarks.* (market comparisons)
     - operational_carbon.* (lifetime operational emissions)
     - reduction_strategies.* (strategy playbook)
     - project_summary.* (project metadata)
     - data_quality.* (coverage metrics)
  
  5. If the user asks for a number you cannot find in these allowed fields, say clearly that it is not available instead of trying to calculate it yourself.
  
  6. Use Portuguese (PT-BR) for all user-facing responses.
  7. Format with Markdown, bold key metrics.
  
  EXAMPLE DATA PATHS (do not recalculate):
  - Main contributors by material:
    quick_ref.material_contributions.concrete.percent = 78.1 (%)
    carbon_baseline.by_category[0].share_of_total_percent = 78.1 (%)
  
  - Structural concrete volume:
    quick_ref.concrete_total_m3 = 131.473 (m³)
    geometry_aggregates.structure.wall_net_volume_m3 + slab_net_volume_m3 = 131.473 (m³)
  
  - Total embodied emissions:
    quick_ref.total_embodied_kgco2e = 58936.4 (kgCO₂e)
    carbon_baseline.total_embodied_kgco2e = 58936.4 (kgCO₂e)
  
  - Category shares:
    carbon_baseline.by_category[i].share_of_total_percent
    carbon_baseline.by_category[i].embodied_kgco2e
    carbon_baseline.by_category[i].quantity_m3 or quantity_m2
  
  - Emission factors:
    quick_ref.emission_factors.concrete_structural = 350 (kgCO₂e/m³)
    material_factors.materials[i].emission_factor_kgco2e_per_m3
  
  - Scenario comparisons:
    quick_ref.scenarios.baseline.intensity = 282.6 (kgCO₂e/m²)
    scenarios.scenarios[i].intensity_kgco2e_per_m2
    scenarios.scenarios[i].reduction_vs_baseline_percent
`
```

---

### Phase 3: Enhance User Message Instructions

**File**: `server.js` (line 220-231)

**Replace GENERAL RULES section with:**
```javascript
GENERAL RULES:
1. Parse the JSON above as a JavaScript object
2. Access data using dot notation (e.g., quick_ref.material_contributions.concrete.percent = 78.1)
3. Always cite exact numbers from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²")
4. Use name_pt_br fields for Portuguese responses
5. Format with Markdown, bold key metrics
6. When user asks about "current scenario" or "this project", use ACTIVE SCENARIO values above
7. NEVER say "não tenho dados" - check the allowed sources above first
8. CRITICAL: The context above does NOT include ifc_data (raw IFC elements). Do NOT attempt to access it or calculate from individual elements.
9. If you need a number that isn't in quick_ref, carbon_baseline, geometry_aggregates, or the other allowed sources, say "Este dado não está disponível nos agregados pré-computados" instead of calculating it.
```

---

### Phase 4: Improve Question Classifier

**File**: `server.js` (line 52-80)

**Enhance classifyQuestion() with more patterns:**
```javascript
function classifyQuestion(message) {
  const lower = message.toLowerCase();
  
  // Emissions by category - expanded patterns
  if (lower.includes('materiais mais contribuem') || 
      lower.includes('emissões por categoria') || 
      lower.includes('contribuem para as emissões') ||
      lower.includes('quais materiais') ||
      lower.includes('maior parte do carbono') ||
      lower.includes('onde está o carbono')) {
    return 'emissions_by_category';
  }
  
  // Concrete quantity - expanded patterns
  if (lower.includes('concreto estrutural') || 
      lower.includes('quanto concreto') || 
      lower.includes('quantidade de concreto') ||
      lower.includes('volume de concreto') ||
      lower.includes('m³ de concreto')) {
    return 'concrete_quantity';
  }
  
  // Emission factors - expanded patterns
  if (lower.includes('fatores de emissão') || 
      lower.includes('emission factors') || 
      lower.includes('fatores foram usados') ||
      lower.includes('coeficientes') ||
      lower.includes('kgco2e/m³') ||
      lower.includes('kgco2e/m²')) {
    return 'emission_factors';
  }
  
  // Total carbon - expanded patterns
  if (lower.includes('redução total') || 
      lower.includes('total carbono') || 
      lower.includes('total de carbono') || 
      lower.includes('total de emissões') ||
      lower.includes('emissões totais') ||
      lower.includes('carbono total')) {
    return 'total_carbon';
  }
  
  // Scenario low clinker - expanded patterns
  if (lower.includes('trocar concreto') || 
      lower.includes('baixo carbono') || 
      lower.includes('low-clinker') || 
      lower.includes('baixo clínquer') ||
      lower.includes('concreto baixo') ||
      lower.includes('cenário baixo carbono')) {
    return 'scenario_low_clinker';
  }
  
  // Reduction strategies - expanded patterns
  if (lower.includes('alternativas') || 
      lower.includes('reduzir emissões') || 
      lower.includes('estratégias') || 
      lower.includes('redução') ||
      lower.includes('como reduzir') ||
      lower.includes('opções para reduzir')) {
    return 'reduction_strategies';
  }
  
  // Emissions by floor - expanded patterns
  if (lower.includes('por pavimento') || 
      lower.includes('por andar') || 
      lower.includes('distribuem as emissões') ||
      lower.includes('emissões por piso') ||
      lower.includes('térreo') && lower.includes('superior')) {
    return 'emissions_by_floor';
  }
  
  // Executive summary
  if (lower.includes('resumo executivo') || 
      lower.includes('executivo') ||
      lower.includes('resumo do projeto')) {
    return 'executive_summary';
  }
  
  // Scenario comparison
  if (lower.includes('compare') || 
      lower.includes('comparar') ||
      lower.includes('diferença entre cenários')) {
    return 'scenario_comparison';
  }
  
  return 'general';
}
```

**Add new case for scenario_comparison:**
```javascript
case 'scenario_comparison':
  contextSection = JSON.stringify({
    quick_ref: {
      scenarios: BIM_CARBON_CONTEXT.quick_ref.scenarios
    },
    scenarios: {
      scenarios: BIM_CARBON_CONTEXT.scenarios.scenarios,
      baseline_id: BIM_CARBON_CONTEXT.scenarios.baseline_id
    },
    active_scenario: activeScenario
  }, null, 2);
  specificInstructions = 'Compare scenarios using quick_ref.scenarios or scenarios.scenarios. Show intensity, total emissions, and reduction percentages. Use active_scenario for "current" or "this project" references.';
  break;
```

---

### Phase 5: Add Debug Mode (Optional)

**File**: `server.js`

**Add query parameter for raw IFC access (debug only):**
```javascript
app.post('/api/chat', async (req, res) => {
  try {
    const { message, activeScenarioId, categoryId, debug } = req.body;
    const enableDebug = debug === true || process.env.ENABLE_IFC_DEBUG === 'true';
    
    // ... existing code ...
    
    // In default case or when debug enabled, optionally include ifc_data
    if (enableDebug && questionType === 'general') {
      contextSection = JSON.stringify({
        ...createSafeContext(),
        ifc_data: BIM_CARBON_CONTEXT.ifc_data, // Only in debug mode
        active_scenario: activeScenario,
        active_scenario_id: scenarioId,
        category_context: categoryId || null
      }, null, 2);
      specificInstructions = 'DEBUG MODE: ifc_data is included. However, still prefer aggregated data from quick_ref, carbon_baseline, etc. Only use ifc_data if the aggregated data is insufficient.';
    }
    
    // ... rest of code ...
  }
});
```

---

## Expected Results

### Before Fix:
- ❌ LLM accesses raw `ifc_data` and calculates from individual elements
- ❌ Wrong answers (4.425 m³ instead of 131.473 m³)
- ❌ Says "não tenho dados" when data exists in aggregates
- ❌ 6.8k+ tokens per request (full context)

### After Fix:
- ✅ LLM uses only aggregated data (quick_ref, carbon_baseline, etc.)
- ✅ Correct answers (131.473 m³ from quick_ref)
- ✅ Clear "not available" messages when data truly missing
- ✅ 2-4k tokens per request (targeted slices)
- ✅ 85%+ accuracy on carbon questions

---

## Testing Checklist

1. **Test material contributions question:**
   - Question: "Quais materiais mais contribuem para as emissões totais?"
   - Expected: Uses `quick_ref.material_contributions` or `carbon_baseline.by_category`
   - Should NOT: Access individual IFC elements

2. **Test concrete quantity question:**
   - Question: "Quanto concreto estrutural temos no projeto?"
   - Expected: Uses `quick_ref.concrete_total_m3 = 131.473 m³`
   - Should NOT: Sum individual wall/slab volumes

3. **Test emission factors question:**
   - Question: "Quais fatores de emissão foram usados?"
   - Expected: Uses `quick_ref.emission_factors` or `material_factors.materials`
   - Should NOT: Say "não tenho dados"

4. **Test scenario comparison:**
   - Question: "Compare o cenário atual com a linha de base"
   - Expected: Uses `scenarios.scenarios` and `active_scenario`
   - Should NOT: Calculate from raw data

5. **Test unavailable data:**
   - Question: "Qual a quantidade de aço utilizada por tipo?"
   - Expected: Says "Este dado não está disponível nos agregados pré-computados"
   - Should NOT: Try to calculate from ifc_data

---

## Implementation Order

1. **Phase 1** (CRITICAL): Remove `ifc_data` from default case - immediate fix
2. **Phase 2** (CRITICAL): Strengthen system instructions - immediate fix
3. **Phase 3**: Enhance user message instructions - immediate fix
4. **Phase 4**: Improve question classifier - optimization
5. **Phase 5**: Add debug mode - optional

---

## Dashboard Impact

**No dashboard changes required.** This is purely a backend/LLM prompt fix. The dashboard continues to use `BIM_CARBON_CONTEXT` as before, and can still access `ifc_data` if needed for visualization.

---

## Success Criteria

- ✅ All material contribution questions use aggregated data
- ✅ All quantity questions use pre-computed values
- ✅ No "não tenho dados" for data that exists in aggregates
- ✅ Token usage reduced by 40-60% for targeted questions
- ✅ LLM never accesses `ifc_data` in normal Q&A mode
- ✅ Clear error messages when data truly unavailable
