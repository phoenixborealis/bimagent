# Final Implementation Plan: LLM Context Fix
## Aligned with Dashboard & Chat Integration Architecture

---

## Current Architecture Analysis

### Data Flow (Verified)

**Source → Adapter → Components:**
```
BIM_CARBON_CONTEXT (data/bimCarbonContext.js)
  ↓
createUnifiedDashboardData(activeScenarioId) (lib/dashboardDataAdapter.ts)
  ↓
Dashboard Components (all use useMemo([activeScenarioId, bimContext]))
```

**Chat → Backend:**
```
App.tsx handleSendMessage()
  ↓
Sends: { message, activeScenarioId, categoryId }
  ↓
server.js /api/chat
  ↓
Creates new model per request (INEFFICIENT)
  ↓
Context in systemInstruction (WRONG per Gemini docs)
```

### State Management (Unified)

**DashboardContext.tsx:**
- `activeScenarioId`: Persisted to localStorage, defaults to `'baseline_current_design'`
- `bimContext`: Set to `BIM_CARBON_CONTEXT` when entering `INSIGHT_MODE`
- All components read from same context via `useDashboardContext()`

**Scenario Selection Logic:**
- Dashboard: `createUnifiedDashboardData(activeScenarioId)` finds scenario:
  ```typescript
  const activeScenario = ctx.scenarios.scenarios.find(s => s.id === activeScenarioId) || 
    ctx.scenarios.scenarios.find(s => s.id === ctx.scenarios.baseline_id);
  ```
- Chat Backend: Currently does same logic (line 140-141) but creates new model per request

### Integration Points

1. **Dashboard → Chat (Scenario Switching)**:
   - User changes scenario in `DashboardHeader` or `ScenarioExplorer`
   - Calls `setActiveScenarioId(scenarioId)`
   - All dashboard components recompute via `useMemo([activeScenarioId, bimContext])`
   - Chat suggestions become context-aware (App.tsx lines 558-560)
   - Next chat message includes `activeScenarioId` in request

2. **Dashboard → Chat (Micro-CTAs)**:
   - User clicks "Perguntar" in `BreakdownPanel` (line 128-140)
   - Dispatches `CustomEvent('askAboutCategory', { categoryId, question })`
   - App.tsx listens (line 266-280) and auto-sends with `categoryId`

3. **Chat → Backend**:
   - Sends `activeScenarioId` and `categoryId` correctly (App.tsx line 358-359)
   - Backend receives them (server.js line 118-119)
   - Backend finds active scenario (line 140-141)
   - **PROBLEM**: Creates new model per request (line 148)
   - **PROBLEM**: Context in systemInstruction (6.8k tokens, wrong place)

---

## Root Cause Analysis

### Critical Issues

1. **Context in Wrong Place** (Per Gemini API Docs):
   - **Current**: 6.8k tokens of JSON in `systemInstruction`
   - **Should Be**: < 1k tokens for role/behavior only
   - **Fix**: Move `BIM_CARBON_CONTEXT` to user message prompt

2. **Inefficient Model Creation**:
   - **Current**: Creates new `getGenerativeModel()` on every request (line 148)
   - **Should Be**: Reuse base model, pass context in user message
   - **Fix**: Create model once at startup, reuse for all requests

3. **Context Not Fresh**:
   - **Current**: Context in systemInstruction (static, cached by SDK)
   - **Should Be**: Context in user message (fresh per request)
   - **Fix**: Include context in `enhancedPrompt` string

4. **No Question Routing**:
   - **Current**: Sends full 6.8k tokens for every question
   - **Should Be**: Send only relevant context sections
   - **Fix**: Implement question classifier and context routing

---

## Implementation Plan

### Phase 0: Fix Architecture (CRITICAL - Do First)

**Goal**: Align with Gemini API best practices and dashboard architecture.

**Changes to `server.js`:**

```javascript
// 1. Create base model ONCE at startup (minimal systemInstruction)
const model = genAI.getGenerativeModel({
  model: MODEL_NAME, // "gemini-2.0-flash-exp"
  systemInstruction: `
    You are the Bonde Studio Carbon AI, a BIM and carbon consultant.
    
    CRITICAL RULES:
    1. You receive BIM_CARBON_CONTEXT data in each user message.
    2. ALWAYS use pre-computed aggregated data from BIM_CARBON_CONTEXT.
    3. NEVER say "data is missing" - check BIM_CARBON_CONTEXT first.
    4. Use Portuguese (PT-BR) for all user-facing responses.
    5. Format with Markdown, bold key metrics.
    
    DATA ACCESS PATTERN:
    - carbon_baseline.by_category = emissions by material
    - geometry_aggregates = pre-computed volumes/areas
    - material_factors = emission factors
    - scenarios = pre-computed alternatives
    - reduction_strategies = strategy playbook
  `
});

// 2. Update /api/chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, activeScenarioId, categoryId } = req.body;
    const scenarioId = activeScenarioId || BIM_CARBON_CONTEXT.scenarios.baseline_id;
    
    // Find active scenario (same logic as dashboard adapter)
    const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === scenarioId) ||
      BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === BIM_CARBON_CONTEXT.scenarios.baseline_id);
    
    // Build context-aware data object (matches dashboard's view)
    const contextData = {
      ...BIM_CARBON_CONTEXT,
      active_scenario: activeScenario,
      active_scenario_id: scenarioId,
      category_context: categoryId || null
    };
    
    // Build enhanced prompt with context IN USER MESSAGE (not systemInstruction)
    const enhancedPrompt = `
      BIM_CARBON_CONTEXT (JSON object - use this data):
      ${JSON.stringify(contextData, null, 2)}
      
      ACTIVE SCENARIO:
      - Name: ${activeScenario?.label_pt_br || 'Linha de Base'}
      - ID: ${scenarioId}
      - Intensity: ${activeScenario?.intensity_kgco2e_per_m2 || 0} kgCO₂e/m²
      - Total: ${activeScenario?.total_kgco2e || 0} kgCO₂e
      ${activeScenario?.reduction_vs_baseline_percent ? `- Reduction: ${activeScenario.reduction_vs_baseline_percent}% vs baseline` : ''}
      
      ${categoryId ? `CATEGORY FOCUS: Answer specifically about category "${categoryId}" from carbon_baseline.by_category.` : ''}
      
      User Question: ${message}
      
      ANSWERING INSTRUCTIONS:
      1. Parse the JSON above as a JavaScript object
      2. Access data using dot notation: BIM_CARBON_CONTEXT.carbon_baseline.by_category[0].share_of_total_percent
      3. For "emissions by category" → use carbon_baseline.by_category
      4. For "concrete quantity" → use geometry_aggregates.structure or carbon_baseline.by_category[0].quantity_m3
      5. For "emission factors" → use material_factors.materials
      6. For "reduction strategies" → use reduction_strategies.for_single_family_residential
      7. For "what if low-carbon concrete" → use scenarios.scenarios[1] (low_clinker_concrete)
      8. When user asks about "current scenario" → use ACTIVE SCENARIO values above
      9. Always cite exact numbers from the context (e.g., "78.1%", "131.473 m³")
      10. Use name_pt_br fields for Portuguese responses
    `;
    
    // Reuse base model (don't create new one)
    const result = await model.generateContent(enhancedPrompt);
    const responseText = result.response.text();
    
    res.json({ reply: responseText });
  } catch (error) {
    // error handling...
  }
});
```

**Benefits**:
- ✅ Context in user message (per Gemini docs)
- ✅ Reuses base model (efficient)
- ✅ Context fresh per request
- ✅ Matches dashboard's scenario logic
- ✅ Includes category context from micro-CTAs

---

### Phase 1: Add Quick Reference Layer

**Goal**: Create flattened structure for common queries (reduces token usage).

**Changes to `data/bimCarbonContext.js`:**

```javascript
// Add quick reference section
export const BIM_CARBON_CONTEXT_QUICK_REF = {
  total_embodied_kgco2e: 58936.4,
  total_embodied_tco2e: 58.9,
  intensity_kgco2e_per_m2: 282.6,
  
  material_contributions: {
    concrete: { percent: 78.1, kgco2e: 46015.4, quantity_m3: 131.473 },
    glazing: { percent: 3.5, kgco2e: 2085.3, quantity_m2: 23.17 },
    doors: { percent: 1.0, kgco2e: 607.0, quantity_m2: 12.14 },
    other: { percent: 17.4, kgco2e: 10228.6 }
  },
  
  concrete_total_m3: 131.473,
  concrete_walls_m3: 54.481,
  concrete_slabs_m3: 76.992,
  
  emission_factors: {
    concrete_structural: 350,
    concrete_low_clinker: 260,
    glazing: 90,
    doors: 50
  },
  
  scenarios: {
    baseline: { intensity: 282.6, total: 58936.4 },
    low_clinker: { intensity: 230, total: 48000, reduction_percent: 18.6 },
    lighter_slabs: { intensity: 210, total: 43500, reduction_percent: 26.2 }
  }
};

// Update BIM_CARBON_CONTEXT export
export const BIM_CARBON_CONTEXT = {
  version: "1.0.0",
  schema_date: "2025-01-15",
  quick_ref: BIM_CARBON_CONTEXT_QUICK_REF, // NEW
  // ... rest of existing structure
};
```

**Update `server.js` to include quick_ref in context:**

```javascript
const contextData = {
  ...BIM_CARBON_CONTEXT,
  quick_ref: BIM_CARBON_CONTEXT.quick_ref, // Easy access for common queries
  active_scenario: activeScenario,
  active_scenario_id: scenarioId,
  category_context: categoryId || null
};
```

---

### Phase 2: Question-Type Routing

**Goal**: Send only relevant context sections (40-60% token reduction).

**Add to `server.js`:**

```javascript
function classifyQuestion(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('materiais mais contribuem') || lower.includes('emissões por categoria')) {
    return 'emissions_by_category';
  }
  if (lower.includes('concreto estrutural') || lower.includes('quanto concreto')) {
    return 'concrete_quantity';
  }
  if (lower.includes('fatores de emissão') || lower.includes('emission factors')) {
    return 'emission_factors';
  }
  if (lower.includes('redução total') || lower.includes('total carbono')) {
    return 'total_carbon';
  }
  if (lower.includes('trocar concreto') || lower.includes('baixo carbono')) {
    return 'scenario_low_clinker';
  }
  if (lower.includes('alternativas') || lower.includes('reduzir emissões')) {
    return 'reduction_strategies';
  }
  if (lower.includes('por pavimento') || lower.includes('por andar')) {
    return 'emissions_by_floor';
  }
  if (lower.includes('resumo executivo')) {
    return 'executive_summary';
  }
  return 'general';
}

// Use in /api/chat
app.post('/api/chat', async (req, res) => {
  const { message, activeScenarioId, categoryId } = req.body;
  const questionType = classifyQuestion(message);
  
  // Select relevant context based on question type
  let contextSection = '';
  let specificInstructions = '';
  
  switch(questionType) {
    case 'emissions_by_category':
      contextSection = JSON.stringify({
        quick_ref: {
          material_contributions: BIM_CARBON_CONTEXT.quick_ref.material_contributions,
          total_embodied_kgco2e: BIM_CARBON_CONTEXT.quick_ref.total_embodied_kgco2e
        },
        carbon_baseline: {
          by_category: BIM_CARBON_CONTEXT.carbon_baseline.by_category
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.material_contributions or carbon_baseline.by_category. List each material with percent, kgco2e, and quantity.';
      break;
      
    case 'concrete_quantity':
      contextSection = JSON.stringify({
        quick_ref: {
          concrete_total_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_total_m3,
          concrete_walls_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_walls_m3,
          concrete_slabs_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_slabs_m3
        },
        geometry_aggregates: {
          structure: BIM_CARBON_CONTEXT.geometry_aggregates.structure
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.concrete_total_m3 for total (131.473 m³). Break down into walls and slabs.';
      break;
      
    case 'emission_factors':
      contextSection = JSON.stringify({
        quick_ref: {
          emission_factors: BIM_CARBON_CONTEXT.quick_ref.emission_factors
        },
        material_factors: {
          materials: BIM_CARBON_CONTEXT.material_factors.materials
        }
      }, null, 2);
      specificInstructions = 'List all emission factors with units (kgCO2e/m³ or kgCO2e/m²).';
      break;
      
    case 'total_carbon':
      contextSection = JSON.stringify({
        quick_ref: {
          total_embodied_kgco2e: BIM_CARBON_CONTEXT.quick_ref.total_embodied_kgco2e,
          total_embodied_tco2e: BIM_CARBON_CONTEXT.quick_ref.total_embodied_tco2e,
          intensity_kgco2e_per_m2: BIM_CARBON_CONTEXT.quick_ref.intensity_kgco2e_per_m2
        },
        active_scenario: activeScenario
      }, null, 2);
      specificInstructions = 'Use quick_ref.total_embodied_kgco2e or active_scenario.total_kgco2e. Convert to tCO2e for display (divide by 1000).';
      break;
      
    case 'scenario_low_clinker':
      contextSection = JSON.stringify({
        quick_ref: {
          scenarios: BIM_CARBON_CONTEXT.quick_ref.scenarios
        },
        scenarios: {
          scenarios: BIM_CARBON_CONTEXT.scenarios.scenarios
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.scenarios.low_clinker. Show reduction_percent (18.6%) and new intensity (230 kgCO2e/m²).';
      break;
      
    case 'reduction_strategies':
      contextSection = JSON.stringify({
        reduction_strategies: BIM_CARBON_CONTEXT.reduction_strategies
      }, null, 2);
      specificInstructions = 'Use reduction_strategies.for_single_family_residential. List all 3 strategies with typical_reduction_range_percent.';
      break;
      
    default:
      // For general questions, send full context
      contextSection = JSON.stringify({
        ...BIM_CARBON_CONTEXT,
        active_scenario: activeScenario,
        active_scenario_id: scenarioId,
        category_context: categoryId || null
      }, null, 2);
      specificInstructions = 'Use any relevant section from BIM_CARBON_CONTEXT.';
  }
  
  const enhancedPrompt = `
    RELEVANT DATA FOR THIS QUESTION:
    ${contextSection}
    
    ${activeScenario ? `ACTIVE SCENARIO: ${activeScenario.label_pt_br} (${activeScenario.intensity_kgco2e_per_m2} kgCO₂e/m²)` : ''}
    ${categoryId ? `CATEGORY FOCUS: ${categoryId}` : ''}
    
    User Question: ${message}
    
    ${specificInstructions}
    
    Answer in Portuguese (PT-BR). Use exact numbers from the data above.
  `;
  
  const result = await model.generateContent(enhancedPrompt);
  // ...
});
```

**Benefits**:
- 40-60% token reduction for targeted questions
- Explicit instructions per question type
- Higher accuracy (less noise)

---

### Phase 3: Response Validation (Optional)

**Goal**: Verify LLM accessed data correctly.

**Add to `server.js`:**

```javascript
function validateResponse(responseText, questionType) {
  const checks = {
    'emissions_by_category': {
      required: ['78.1', 'concreto', '46,015'],
      forbidden: ['não tenho', 'missing', 'faltando', '4.425'] // Individual elements
    },
    'concrete_quantity': {
      required: ['131.473', 'm³'],
      forbidden: ['4.425', '4.214', '0.211'] // Individual elements, not total
    },
    'emission_factors': {
      required: ['350', 'kgCO2e'],
      forbidden: ['não tenho', 'missing']
    }
  };
  
  const check = checks[questionType];
  if (!check) return { valid: true };
  
  const hasRequired = check.required.some(term => 
    responseText.toLowerCase().includes(term.toLowerCase())
  );
  const hasForbidden = check.forbidden.some(term =>
    responseText.toLowerCase().includes(term.toLowerCase())
  );
  
  return {
    valid: hasRequired && !hasForbidden,
    hasRequired,
    hasForbidden
  };
}

// Use in chat handler with retry
let attempts = 0;
let responseText = '';
let valid = false;

while (attempts < 2 && !valid) {
  const result = await model.generateContent(enhancedPrompt);
  responseText = result.response.text();
  
  const validation = validateResponse(responseText, questionType);
  valid = validation.valid;
  
  if (!valid && attempts === 0) {
    enhancedPrompt += `\n\nIMPORTANT: Include these exact values: ${check.required.join(', ')}`;
  }
  attempts++;
}
```

---

## Integration with Dashboard

### Alignment Points

1. **Scenario Logic**: Backend uses same logic as `createUnifiedDashboardData()`:
   ```javascript
   const activeScenario = ctx.scenarios.scenarios.find(s => s.id === scenarioId) ||
     ctx.scenarios.scenarios.find(s => s.id === ctx.scenarios.baseline_id);
   ```

2. **State Synchronization**: Chat receives `activeScenarioId` from dashboard context, backend uses it to find scenario.

3. **Category Context**: Micro-CTAs from `BreakdownPanel` send `categoryId`, backend includes it in prompt.

4. **Data Consistency**: Both dashboard and chat use same `BIM_CARBON_CONTEXT` source.

### No Dashboard Changes Required

- Dashboard already sends `activeScenarioId` and `categoryId` correctly
- Dashboard already uses unified state via `DashboardContext`
- Backend just needs to use these parameters correctly (already fixed in user's code)

---

## Implementation Order

### Step 1: Phase 0 (CRITICAL - Do First)
- Move context from systemInstruction to user message
- Reuse base model instead of creating new one
- Test with simple queries

### Step 2: Phase 1 (IMPORTANT)
- Add quick_ref to `bimCarbonContext.js`
- Update context data structure
- Test quick_ref access

### Step 3: Phase 2 (OPTIMIZATION)
- Implement question classifier
- Add context routing
- Test token reduction

### Step 4: Phase 3 (OPTIONAL)
- Add response validation
- Test retry logic

---

## Expected Results

### Before (Current):
- ❌ Context in systemInstruction (wrong place)
- ❌ Creates new model per request (inefficient)
- ❌ 6.8k tokens for every question
- ❌ 7% success rate (LLM says "no data")

### After Phase 0:
- ✅ Context in user message (correct)
- ✅ Reuses base model (efficient)
- ✅ Context fresh per request
- ✅ Expected: 60-70% success rate

### After Phase 0-2:
- ✅ Question routing (40-60% token reduction)
- ✅ Quick reference for common queries
- ✅ Expected: 85%+ success rate

---

## Testing Plan

1. **Unit Tests**:
   - Test scenario finding logic matches dashboard
   - Test question classifier accuracy
   - Test context routing selects correct sections

2. **Integration Tests**:
   - Test scenario switching updates chat context
   - Test micro-CTAs send correct categoryId
   - Test chat responses match dashboard data

3. **End-to-End Tests**:
   - Test all 15 previously failed queries
   - Verify responses contain exact numbers
   - Verify responses reference active scenario

---

## Risk Mitigation

1. **Backward Compatibility**: Keep full context available for complex queries
2. **Fallback**: If routing fails, send full context
3. **Logging**: Log question types, validation results, token usage
4. **Gradual Rollout**: Test Phase 0 first, then add phases incrementally

---

## Success Criteria

- ✅ All 15 previously failed queries work
- ✅ Responses contain exact numbers from context
- ✅ Responses reference active scenario correctly
- ✅ Token usage reduced by 40-60% for targeted questions
- ✅ No dashboard changes required
- ✅ Chat and dashboard stay synchronized
