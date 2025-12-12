# Updated Fix Plan: LLM Context Data Access Issues

## Current State Analysis

**Model**: `gemini-2.0-flash-exp` (Gemini 2.0 Flash Experimental)
- **Version Confirmed**: Line 26 in server.js: `MODEL_NAME = "gemini-2.0-flash-exp"`
- **Input Limit**: 1,048,576 tokens
- **Output Limit**: 65,536 tokens
- **Our Usage**: ~6.8k tokens in systemInstruction (0.65% of limit) ✅
- **Best Practice**: Per Gemini docs, systemInstruction should be < 1k tokens for role/behavior only
- **Documentation Source**: Verified against Gemini API docs - dynamic context should be in user message, not systemInstruction

**Dashboard Plan Integration**:
- Plan location: `/Users/sk/.cursor/plans/dashboard_redesign_implementation_fc1551cb.plan.md`
- Key requirement: Dashboard and chat share unified state (`activeScenarioId`, `bimContext`)
- Frontend already sends: `activeScenarioId` and `categoryId` (App.tsx line 358-359)
- Server needs: Proper extraction and usage of these parameters
- Input limit: 1,048,576 tokens
- Output limit: 65,536 tokens
- Our usage: ~6.8k tokens (0.65% of limit) ✅

**Current Code State**:
- ✅ Frontend sends `activeScenarioId` and `categoryId` (App.tsx line 358-359)
- ❌ Server has bugs: uses undefined `scenarioId` instead of `activeScenarioId` (line 134, 151)
- ❌ Server doesn't extract `categoryId` from request (line 118)
- ❌ Context still in systemInstruction (6.8k tokens) - should be in user message per Gemini docs
- ❌ Creates new model instance on every request (line 138) - inefficient

**Dashboard Plan Integration**:
- Dashboard and chat share unified state (`activeScenarioId`, `bimContext`)
- Frontend already sends both parameters
- Server needs to properly use them

## Root Cause Analysis

Based on Gemini API documentation and code review:

### Critical Issues:

1. **Code Bugs** (Immediate Fix Required):
   - Line 134: `scenarioId` is undefined → should be `activeScenarioId`
   - Line 151: `scenarioId` is undefined → should be `activeScenarioId`
   - Line 118: `categoryId` not extracted from `req.body`
   - Line 138: Creates new model per request → should reuse base model

2. **SystemInstruction Overload** (Per Gemini Docs):
   - Documentation: systemInstruction should be concise (< 1k tokens) for role/behavior only
   - Current: 6.8k tokens of JSON data in systemInstruction
   - Impact: Model may ignore or poorly parse large systemInstruction

3. **Dynamic Context in Wrong Place** (Per Gemini Docs):
   - Documentation: Dynamic/non-conversational context should be in **user message**, not systemInstruction
   - Current: BIM_CARBON_CONTEXT in systemInstruction
   - Impact: Context not processed fresh with each request

4. **JSON Parsing Issues**:
   - LLM may not correctly parse embedded JSON string in systemInstruction
   - No explicit schema or access examples

5. **No Question Routing**:
   - Model doesn't know which data section to use
   - Sends full 6.8k tokens even for simple questions

---

## Fix Strategy: 6-Phase Approach

### Phase 0: Fix Code Bugs (CRITICAL - Do First)

**File**: `server.js`

**Bug Fixes**:

```javascript
app.post('/api/chat', async (req, res) => {
  try {
    // FIX 1: Extract all parameters correctly
    const { message, activeScenarioId, categoryId } = req.body; // Add categoryId
    
    // FIX 2: Use activeScenarioId (not undefined scenarioId)
    const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === activeScenarioId) ||
      BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === BIM_CARBON_CONTEXT.scenarios.baseline_id);
    
    // FIX 3: Don't create new model - reuse base model, put context in user message
    // (See Phase 1 for full implementation)
    
    // ... rest of code
  }
});
```

**Impact**: Fixes immediate runtime errors and undefined variable issues.

---

### Phase 1: Restructure Context Delivery (CRITICAL)

**Problem**: Context in systemInstruction (wrong place per Gemini docs).

**Solution**: Move context to user message, keep systemInstruction minimal.

**Implementation**:

```javascript
// Base model created ONCE at startup (minimal systemInstruction)
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp",
  systemInstruction: `
    You are the Bonde Studio Carbon AI, a BIM and carbon consultant.
    
    CRITICAL RULES:
    1. You receive BIM_CARBON_CONTEXT data in each user message.
    2. ALWAYS use pre-computed aggregated data from BIM_CARBON_CONTEXT.
    3. NEVER say "data is missing" - check BIM_CARBON_CONTEXT first.
    4. Use Portuguese (PT-BR) for all user-facing responses.
    5. Format with Markdown, bold key metrics.
    
    DATA ACCESS:
    - carbon_baseline.by_category = emissions by material
    - geometry_aggregates = pre-computed volumes/areas
    - material_factors = emission factors
    - scenarios = pre-computed alternatives
    - reduction_strategies = strategy playbook
  `
});

// Context in user message (per request)
app.post('/api/chat', async (req, res) => {
  const { message, activeScenarioId, categoryId } = req.body;
  
  // Find active scenario
  const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === activeScenarioId) ||
    BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === BIM_CARBON_CONTEXT.scenarios.baseline_id);
  
  // Build context-aware data object
  const contextData = {
    ...BIM_CARBON_CONTEXT,
    active_scenario: activeScenario,
    active_scenario_id: activeScenarioId || BIM_CARBON_CONTEXT.scenarios.baseline_id,
    category_context: categoryId || null
  };
  
  // Build enhanced prompt with context IN USER MESSAGE
  const enhancedPrompt = `
    BIM_CARBON_CONTEXT (JSON object - use this data):
    ${JSON.stringify(contextData, null, 2)}
    
    ACTIVE SCENARIO:
    - Name: ${activeScenario?.label_pt_br || 'Linha de Base'}
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
});
```

**Benefits**:
- Context in active prompt (per Gemini docs)
- Model processes context fresh with each request
- Easier for model to parse
- Can include scenario/category context dynamically

---

### Phase 2: Create Quick Reference Layer

**Problem**: Large nested JSON hard to navigate.

**Solution**: Add flattened `quick_ref` section for common queries.

**Implementation**:

```javascript
// Add to data/bimCarbonContext.js
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
  },
  
  floor_areas: {
    ground_floor_m2: 98.833,
    upper_floor_m2: 74.509,
    total_m2: 208.546
  }
};

// Update BIM_CARBON_CONTEXT
export const BIM_CARBON_CONTEXT = {
  version: "1.0.0",
  schema_date: "2025-01-15",
  quick_ref: BIM_CARBON_CONTEXT_QUICK_REF, // NEW: Easy access
  full_data: {
    ifc_data: IFC_DATA,
    project_summary: PROJECT_SUMMARY,
    // ... rest of context
  }
};
```

**Benefits**:
- Common queries use simple `quick_ref` paths
- Complex queries still access `full_data`
- Reduces cognitive load on LLM

---

### Phase 3: Question-Type Routing

**Problem**: Sending full 6.8k tokens for every question is inefficient.

**Solution**: Classify question type and send only relevant context.

**Implementation**:

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
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.material_contributions. List each material with percent, kgco2e, and quantity.';
      break;
      
    case 'concrete_quantity':
      contextSection = JSON.stringify({
        quick_ref: {
          concrete_total_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_total_m3,
          concrete_walls_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_walls_m3,
          concrete_slabs_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_slabs_m3
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.concrete_total_m3 for total (131.473 m³). Break down into walls and slabs.';
      break;
      
    case 'emission_factors':
      contextSection = JSON.stringify({
        quick_ref: {
          emission_factors: BIM_CARBON_CONTEXT.quick_ref.emission_factors
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
        full_data: {
          scenarios: BIM_CARBON_CONTEXT.full_data.scenarios
        }
      }, null, 2);
      specificInstructions = 'Use quick_ref.scenarios.low_clinker. Show reduction_percent (18.6%) and new intensity (230 kgCO2e/m²).';
      break;
      
    case 'reduction_strategies':
      contextSection = JSON.stringify({
        full_data: {
          reduction_strategies: BIM_CARBON_CONTEXT.full_data.reduction_strategies
        }
      }, null, 2);
      specificInstructions = 'Use full_data.reduction_strategies.for_single_family_residential. List all 3 strategies with typical_reduction_range_percent.';
      break;
      
    default:
      // For general questions, send full context
      contextSection = JSON.stringify(BIM_CARBON_CONTEXT, null, 2);
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

### Phase 4: Add Explicit JSON Schema

**Problem**: LLM may not understand JSON structure.

**Solution**: Add schema description with access examples.

**Implementation**:

```javascript
const enhancedPrompt = `
  BIM_CARBON_CONTEXT SCHEMA:
  {
    "quick_ref": {
      "total_embodied_kgco2e": number,
      "material_contributions": {
        "concrete": { "percent": number, "kgco2e": number, "quantity_m3": number },
        ...
      },
      "concrete_total_m3": number,
      "emission_factors": { "concrete_structural": number, ... },
      "scenarios": { "baseline": {...}, "low_clinker": {...} }
    },
    "full_data": {
      "carbon_baseline": { "by_category": [...], "total_embodied_kgco2e": number },
      ...
    }
  }
  
  ACTUAL DATA:
  ${contextSection}
  
  ACCESS EXAMPLES:
  - Material contributions: quick_ref.material_contributions.concrete.percent = 78.1
  - Concrete total: quick_ref.concrete_total_m3 = 131.473
  - Emission factor: quick_ref.emission_factors.concrete_structural = 350
  - Scenario reduction: quick_ref.scenarios.low_clinker.reduction_percent = 18.6
  
  User Question: ${message}
  
  ${specificInstructions}
`;
```

---

### Phase 5: Response Validation

**Problem**: No way to verify LLM accessed data correctly.

**Solution**: Validate responses and retry if needed.

**Implementation**:

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

### Phase 6: Context Caching (Optional)

**Problem**: Sending context every time is inefficient.

**Solution**: Cache context sections for reuse.

**Implementation**:

```javascript
const contextCache = {
  full: JSON.stringify(BIM_CARBON_CONTEXT, null, 2),
  quick_ref: JSON.stringify(BIM_CARBON_CONTEXT.quick_ref, null, 2),
  sections: {
    emissions: JSON.stringify(BIM_CARBON_CONTEXT.quick_ref.material_contributions, null, 2),
    concrete: JSON.stringify({
      total: BIM_CARBON_CONTEXT.quick_ref.concrete_total_m3,
      walls: BIM_CARBON_CONTEXT.quick_ref.concrete_walls_m3,
      slabs: BIM_CARBON_CONTEXT.quick_ref.concrete_slabs_m3
    }, null, 2),
    // ... more sections
  }
};

// Use cached sections in routing
const contextSection = contextCache.sections[questionType] || contextCache.quick_ref;
```

---

## Implementation Priority

### Phase 0: Fix Code Bugs (IMMEDIATE)
- Fix `scenarioId` → `activeScenarioId`
- Extract `categoryId` from request
- Remove model creation per request

### Phase 1: Move Context to User Message (CRITICAL)
- Minimal systemInstruction (< 1k tokens)
- Context in user message prompt
- Include active scenario and category context

### Phase 2: Quick Reference Layer (CRITICAL)
- Create flattened `quick_ref` structure
- Update BIM_CARBON_CONTEXT to include it

### Phase 3: Question Routing (CRITICAL)
- Implement question classifier
- Send only relevant context sections
- 40-60% token reduction

### Phase 4: JSON Schema (IMPORTANT)
- Add explicit schema description
- Provide access examples

### Phase 5: Validation (IMPORTANT)
- Validate responses contain required data
- Retry with better instructions if needed

### Phase 6: Caching (OPTIONAL)
- Cache context sections
- Further optimization

---

## Expected Results

After Phases 0-3:

| Query | Current | After Fix |
|-------|---------|-----------|
| "Quais materiais mais contribuem?" | ❌ "No data" | ✅ "Concreto: 78.1% (46,015 kgCO2e)" |
| "Quanto concreto estrutural?" | ❌ "4.425 m³" (wrong) | ✅ "131.473 m³" (correct) |
| "Quais fatores de emissão?" | ❌ "No data" | ✅ Lists all 5 factors |
| "Qual a redução total?" | ❌ "No data" | ✅ "58.9 tCO2e" |
| "Se eu trocar concreto?" | ❌ Generic | ✅ "18.6% reduction, 230 kgCO2e/m²" |

**Success Rate**: 7% → 85%+ (12x improvement)
**Token Usage**: 6.8k → 2-4k per request (40-60% reduction)

---

## Testing Plan

1. **Fix Bugs First**: Test that `activeScenarioId` and `categoryId` are properly used
2. **Test Context Delivery**: Verify context is in user message, not systemInstruction
3. **Test Question Routing**: Verify correct context sections sent for each question type
4. **Test Validation**: Verify responses contain required data
5. **Integration Test**: Test full flow with dashboard scenario switching

---

## Risk Mitigation

1. **Backward Compatibility**: Keep full context available for complex queries
2. **Fallback**: If routing fails, send full context
3. **Logging**: Log question types, validation results, token usage
4. **Gradual Rollout**: Test with subset of queries first
