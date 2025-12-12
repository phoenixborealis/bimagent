# Full Fix Plan: LLM Context Data Access Issues

## Current State Analysis

**Model**: `gemini-2.0-flash-exp` (Gemini 2.0 Flash Experimental)
**Current Issues**: 
- 93% query failure rate (LLM says "no data" when data exists)
- Context in wrong place (systemInstruction instead of user message)
- Code bugs: `scenarioId` undefined, `categoryId` not extracted
- Creating new model instance on every request (inefficient)

## Root Cause Analysis

Based on Gemini API documentation and the analysis of 15 failed queries:

### Primary Issues:

1. **SystemInstruction Overload**: Documentation states systemInstruction should be concise and focused on role/behavior. We're putting 6.8k tokens of JSON data in systemInstruction, which may cause the model to ignore or poorly parse it.

2. **Dynamic Context in Wrong Place**: According to Gemini docs, dynamic/non-conversational context (like our BIM_CARBON_CONTEXT) should be in the **user message/prompt content**, not systemInstruction.

3. **Code Bugs**: 
   - Line 134: Uses `scenarioId` (undefined) instead of `activeScenarioId`
   - Line 151: Uses `scenarioId` (undefined) instead of `activeScenarioId`
   - Line 156: Uses `categoryId` but not extracted from `req.body`
   - Line 138: Creates new model instance on every request (should reuse base model)

4. **JSON Parsing Issues**: The LLM may not be correctly parsing the embedded JSON string in the systemInstruction template literal.

5. **No Explicit Data Access Instructions**: While we have mappings, the model may not understand how to navigate the JSON structure.

6. **Context Size**: 6.8k tokens in systemInstruction may be causing the model to truncate or ignore parts of it.

---

## Fix Strategy: Multi-Layered Approach

### Phase 1: Restructure Context Delivery (CRITICAL)

**Problem**: Context is in systemInstruction, but should be in user message.

**Solution**: Split context delivery:
- **systemInstruction**: Only role, behavior rules, and data access instructions (keep < 1k tokens)
- **User Message**: Include BIM_CARBON_CONTEXT JSON in the actual prompt content

**Implementation Plan**:

```javascript
// NEW: Minimal systemInstruction (role + behavior only)
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: `
    You are the Bonde Studio Carbon AI, a BIM and carbon consultant.
    
    CRITICAL RULES:
    1. You have access to BIM_CARBON_CONTEXT data provided in each user message.
    2. ALWAYS use the pre-computed aggregated data from BIM_CARBON_CONTEXT.
    3. NEVER say "data is missing" - check BIM_CARBON_CONTEXT first.
    4. Use Portuguese (PT-BR) for all user-facing responses.
    5. Format responses with Markdown, bold key metrics.
    
    DATA ACCESS PATTERN:
    - BIM_CARBON_CONTEXT.carbon_baseline.by_category = emissions by material
    - BIM_CARBON_CONTEXT.geometry_aggregates = pre-computed volumes/areas
    - BIM_CARBON_CONTEXT.material_factors = emission factors
    - BIM_CARBON_CONTEXT.scenarios = pre-computed alternatives
    - BIM_CARBON_CONTEXT.reduction_strategies = strategy playbook
  `
});

// NEW: Include context in user message
app.post('/api/chat', async (req, res) => {
  const { message, activeScenarioId } = req.body;
  
  // If activeScenarioId provided, use that scenario's data
  let contextToUse = BIM_CARBON_CONTEXT;
  if (activeScenarioId) {
    const scenario = BIM_CARBON_CONTEXT.scenarios?.scenarios?.find(s => s.id === activeScenarioId);
    if (scenario) {
      // Create scenario-specific context
      contextToUse = {
        ...BIM_CARBON_CONTEXT,
        active_scenario: scenario,
        carbon_baseline: {
          ...BIM_CARBON_CONTEXT.carbon_baseline,
          total_embodied_kgco2e: scenario.total_kgco2e,
          intensity_kgco2e_per_m2: scenario.intensity_kgco2e_per_m2
        }
      };
    }
  }
  
  // Build enhanced prompt with context
  const enhancedPrompt = `
    BIM_CARBON_CONTEXT (use this data to answer):
    ${JSON.stringify(contextToUse, null, 2)}
    
    User Question: ${message}
    
    Instructions:
    - Answer using data from BIM_CARBON_CONTEXT above
    - Use exact values from the JSON (e.g., carbon_baseline.by_category[0].share_of_total_percent)
    - If question is about emissions by category, use carbon_baseline.by_category
    - If question is about concrete quantity, use geometry_aggregates.structure or carbon_baseline.by_category[0].quantity_m3
    - If question is about emission factors, use material_factors.materials
    - If question is about reduction strategies, use reduction_strategies.for_single_family_residential
    - If question is "what if" about low-carbon concrete, use scenarios.scenarios[1] (low_clinker_concrete)
    ${activeScenarioId ? `- NOTE: Active scenario is ${activeScenarioId}. Use active_scenario data when relevant.` : ''}
  `;
  
  const result = await model.generateContent(enhancedPrompt);
  // ...
});
```

**Benefits**:
- Context is in the active prompt, not buried in systemInstruction
- Model processes context fresh with each request
- Easier for model to parse and access
- Can dynamically filter context based on question type

---

### Phase 2: Optimize Context Structure

**Problem**: Large nested JSON may be hard to navigate.

**Solution**: Create a flattened "quick reference" section at the top of context.

**Implementation Plan**:

```javascript
// Add to bimCarbonContext.js
export const BIM_CARBON_CONTEXT_QUICK_REF = {
  // Most commonly accessed values at top level
  total_embodied_kgco2e: 58936.4,
  total_embodied_tco2e: 58.9,
  intensity_kgco2e_per_m2: 282.6,
  
  // Material contributions (simplified)
  material_contributions: {
    concrete: { percent: 78.1, kgco2e: 46015.4, quantity_m3: 131.473 },
    glazing: { percent: 3.5, kgco2e: 2085.3, quantity_m2: 23.17 },
    doors: { percent: 1.0, kgco2e: 607.0, quantity_m2: 12.14 },
    other: { percent: 17.4, kgco2e: 10228.6 }
  },
  
  // Concrete totals
  concrete_total_m3: 131.473,
  concrete_walls_m3: 54.481,
  concrete_slabs_m3: 76.992,
  
  // Emission factors (simplified)
  emission_factors: {
    concrete_structural: 350, // kgCO2e/m³
    concrete_low_clinker: 260, // kgCO2e/m³
    glazing: 90, // kgCO2e/m²
    doors: 50 // kgCO2e/m²
  },
  
  // Scenarios (simplified)
  scenarios: {
    baseline: { intensity: 282.6, total: 58936.4 },
    low_clinker: { intensity: 230, total: 48000, reduction_percent: 18.6 },
    lighter_slabs: { intensity: 210, total: 43500, reduction_percent: 26.2 }
  },
  
  // Floor areas
  floor_areas: {
    ground_floor_m2: 98.833,
    upper_floor_m2: 74.509,
    total_m2: 208.546
  }
};

// Include both in context
export const BIM_CARBON_CONTEXT = {
  quick_ref: BIM_CARBON_CONTEXT_QUICK_REF, // NEW: Easy access layer
  full_data: {
    ifc_data: IFC_DATA,
    project_summary: PROJECT_SUMMARY,
    // ... rest of context
  }
};
```

**Benefits**:
- Common queries can use quick_ref (simpler navigation)
- Complex queries can still access full_data
- Reduces cognitive load on LLM

---

### Phase 3: Add Explicit JSON Schema Instructions

**Problem**: LLM may not understand JSON structure.

**Solution**: Add explicit schema description and access examples.

**Implementation Plan**:

```javascript
const enhancedPrompt = `
  BIM_CARBON_CONTEXT (JSON Schema):
  
  {
    "quick_ref": {
      "total_embodied_kgco2e": number,
      "material_contributions": {
        "concrete": { "percent": number, "kgco2e": number, "quantity_m3": number },
        "glazing": { "percent": number, "kgco2e": number, "quantity_m2": number },
        ...
      },
      "concrete_total_m3": number,
      "emission_factors": { "concrete_structural": number, ... },
      "scenarios": { "baseline": {...}, "low_clinker": {...} }
    },
    "full_data": {
      "carbon_baseline": { "by_category": [...], "total_embodied_kgco2e": number },
      "geometry_aggregates": { "structure": {...} },
      ...
    }
  }
  
  ACTUAL DATA:
  ${JSON.stringify(BIM_CARBON_CONTEXT, null, 2)}
  
  User Question: ${message}
  
  ANSWERING INSTRUCTIONS:
  1. Parse the JSON above as a JavaScript object
  2. Access data using dot notation: BIM_CARBON_CONTEXT.quick_ref.material_contributions.concrete.percent
  3. For "emissions by category" → use quick_ref.material_contributions
  4. For "concrete quantity" → use quick_ref.concrete_total_m3
  5. For "emission factors" → use quick_ref.emission_factors
  6. For "reduction strategies" → use full_data.reduction_strategies
  7. For "what if low-carbon concrete" → use quick_ref.scenarios.low_clinker
`;
```

---

### Phase 4: Implement Question-Type Routing

**Problem**: LLM doesn't know which data section to use.

**Solution**: Add explicit question classification and routing.

**Implementation Plan**:

```javascript
// Add question classifier function
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
  if (lower.includes('trocar concreto') || lower.includes('baixo carbono') || lower.includes('low carbon')) {
    return 'scenario_low_clinker';
  }
  if (lower.includes('alternativas') || lower.includes('reduzir emissões') || lower.includes('reduction strategies')) {
    return 'reduction_strategies';
  }
  if (lower.includes('por pavimento') || lower.includes('por andar') || lower.includes('por piso')) {
    return 'emissions_by_floor';
  }
  if (lower.includes('resumo executivo') || lower.includes('executive summary')) {
    return 'executive_summary';
  }
  return 'general';
}

// Use classifier to build targeted prompt
app.post('/api/chat', async (req, res) => {
  const { message, activeScenarioId } = req.body;
  const questionType = classifyQuestion(message);
  
  let contextSection = '';
  let specificInstructions = '';
  
  switch(questionType) {
    case 'emissions_by_category':
      contextSection = JSON.stringify({
        material_contributions: BIM_CARBON_CONTEXT.quick_ref.material_contributions,
        total: BIM_CARBON_CONTEXT.quick_ref.total_embodied_kgco2e
      }, null, 2);
      specificInstructions = 'Use material_contributions object. List each material with its percent, kgco2e, and quantity.';
      break;
      
    case 'concrete_quantity':
      contextSection = JSON.stringify({
        concrete_total_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_total_m3,
        concrete_walls_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_walls_m3,
        concrete_slabs_m3: BIM_CARBON_CONTEXT.quick_ref.concrete_slabs_m3
      }, null, 2);
      specificInstructions = 'Use concrete_total_m3 for total. Break down into walls and slabs.';
      break;
      
    case 'emission_factors':
      contextSection = JSON.stringify(BIM_CARBON_CONTEXT.quick_ref.emission_factors, null, 2);
      specificInstructions = 'List all emission factors with units (kgCO2e/m³ or kgCO2e/m²).';
      break;
      
    // ... more cases
  }
  
  const enhancedPrompt = `
    RELEVANT DATA FOR THIS QUESTION:
    ${contextSection}
    
    User Question: ${message}
    
    ${specificInstructions}
    
    Answer in Portuguese (PT-BR). Use exact numbers from the data above.
  `;
  
  const result = await model.generateContent(enhancedPrompt);
  // ...
});
```

**Benefits**:
- Only sends relevant context (reduces token usage)
- Explicit instructions for each question type
- Higher chance of correct data access

---

### Phase 5: Add Validation and Fallback

**Problem**: No way to verify if LLM accessed data correctly.

**Solution**: Add response validation and fallback mechanism.

**Implementation Plan**:

```javascript
// Add response validator
function validateResponse(responseText, questionType) {
  const checks = {
    'emissions_by_category': {
      required: ['78.1', 'concreto', '46,015'],
      forbidden: ['não tenho', 'missing', 'faltando']
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

// Use validator with retry
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const questionType = classifyQuestion(message);
  
  let attempts = 0;
  let responseText = '';
  let valid = false;
  
  while (attempts < 2 && !valid) {
    // Build prompt...
    const result = await model.generateContent(enhancedPrompt);
    responseText = result.response.text();
    
    const validation = validateResponse(responseText, questionType);
    valid = validation.valid;
    
    if (!valid && attempts === 0) {
      // Retry with more explicit instructions
      enhancedPrompt += `\n\nIMPORTANT: Your previous response was missing required data. Make sure to include: ${JSON.stringify(validation)}`;
    }
    attempts++;
  }
  
  res.json({ reply: responseText });
});
```

---

### Phase 6: Implement Context Caching (Optional Optimization)

**Problem**: Sending full context every time is inefficient.

**Solution**: Use Gemini's implicit caching (if available) or implement smart context selection.

**Implementation Plan**:

```javascript
// Cache systemInstruction (already done by SDK)
// For user messages, send only relevant context sections

// Create context cache
const contextCache = {
  full: JSON.stringify(BIM_CARBON_CONTEXT, null, 2),
  sections: {
    emissions: JSON.stringify(BIM_CARBON_CONTEXT.quick_ref.material_contributions, null, 2),
    concrete: JSON.stringify({
      total: BIM_CARBON_CONTEXT.quick_ref.concrete_total_m3,
      breakdown: {
        walls: BIM_CARBON_CONTEXT.quick_ref.concrete_walls_m3,
        slabs: BIM_CARBON_CONTEXT.quick_ref.concrete_slabs_m3
      }
    }, null, 2),
    // ... more sections
  }
};

// Use cached sections
app.post('/api/chat', async (req, res) => {
  const questionType = classifyQuestion(message);
  const relevantContext = contextCache.sections[questionType] || contextCache.full;
  // ...
});
```

---

## Implementation Priority

### Critical (Must Fix - Code Bugs):
0. ✅ **Phase 0**: Fix code bugs (scenarioId → activeScenarioId, extract categoryId)
1. ✅ **Phase 1**: Move context from systemInstruction to user message
2. ✅ **Phase 2**: Create quick_ref flattened structure
3. ✅ **Phase 4**: Implement question-type routing

### Important (Should Fix):
4. ✅ **Phase 3**: Add explicit JSON schema instructions
5. ✅ **Phase 5**: Add validation and fallback

### Optional (Nice to Have):
6. ⚠️ **Phase 6**: Context caching optimization

## Code Bugs to Fix First

**File**: `server.js`

**Bug 1** (Line 134):
```javascript
// WRONG:
const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === scenarioId) ||
// FIX:
const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === activeScenarioId) ||
```

**Bug 2** (Line 151):
```javascript
// WRONG:
- Scenario ID: ${scenarioId}
// FIX:
- Scenario ID: ${activeScenarioId || BIM_CARBON_CONTEXT.scenarios.baseline_id}
```

**Bug 3** (Line 118):
```javascript
// CURRENT:
const { message, activeScenarioId } = req.body;
// MISSING:
const { message, activeScenarioId, categoryId } = req.body; // Add categoryId
```

**Bug 4** (Line 138):
```javascript
// WRONG: Creates new model on every request
const modelWithContext = genAI.getGenerativeModel({...});
// FIX: Reuse base model, put context in user message instead
const result = await model.generateContent(enhancedPrompt);
```

---

## Expected Outcomes

After implementing Phases 1-4:

1. **"Quais materiais mais contribuem?"**
   - ✅ Will access `quick_ref.material_contributions`
   - ✅ Will cite: "Concreto: 78.1% (46,015 kgCO2e)"

2. **"Quanto concreto estrutural?"**
   - ✅ Will access `quick_ref.concrete_total_m3`
   - ✅ Will cite: "131.473 m³"

3. **"Quais fatores de emissão?"**
   - ✅ Will access `quick_ref.emission_factors`
   - ✅ Will list all factors with units

4. **"Qual a redução total?"**
   - ✅ Will access `quick_ref.total_embodied_kgco2e`
   - ✅ Will cite: "58.9 tCO2e"

5. **"Se eu trocar o concreto por baixo carbono?"**
   - ✅ Will access `quick_ref.scenarios.low_clinker`
   - ✅ Will cite: "18.6% reduction, 230 kgCO2e/m²"

---

## Testing Plan

1. **Unit Tests**: Test question classifier with all query types
2. **Integration Tests**: Test each question type with actual LLM calls
3. **Validation Tests**: Verify responses contain required data
4. **Performance Tests**: Measure token usage reduction with routing

---

## Additional Considerations

### Scenario Support (activeScenarioId parameter)

**Current Implementation**: Frontend sends `activeScenarioId` and `categoryId` (from dashboard plan)
**Current Bug**: Server uses undefined `scenarioId` instead of `activeScenarioId`
**Fix**: Extract `activeScenarioId` and `categoryId` from `req.body`

**Implementation Note:**
- Extract `activeScenarioId` from request (already in code, but buggy)
- Extract `categoryId` from request (missing in current code)
- Find matching scenario from `scenarios.scenarios`
- Include active scenario data in user message context
- Reference scenario values when user asks about "current project"

### Dashboard Integration

**From Dashboard Plan**: 
- Dashboard and chat share unified state (`activeScenarioId`, `bimContext`)
- Frontend sends `activeScenarioId` and `categoryId` with each chat request
- Dashboard updates reactively when scenario changes
- Chat should reference active scenario in responses

**Current State**:
- ✅ Frontend sends `activeScenarioId` and `categoryId` (App.tsx line 358-359)
- ❌ Server has bugs: uses `scenarioId` instead of `activeScenarioId`
- ❌ Server doesn't extract `categoryId` from request
- ❌ Context still in systemInstruction (should be in user message)

## Risk Mitigation

1. **Backward Compatibility**: Keep full context available for complex queries
2. **Fallback Mechanism**: If routing fails, send full context
3. **Logging**: Log question types and validation results for monitoring
4. **Gradual Rollout**: Test with subset of queries first
5. **Scenario Handling**: Support both baseline and scenario-specific queries

---

## Estimated Impact

- **Success Rate**: 7% → 85%+ (12x improvement)
- **Token Usage**: 6.8k → 2-4k per request (40-60% reduction with routing)
- **Response Quality**: Generic → Specific with exact numbers
- **User Experience**: "No data" → Accurate, data-driven answers
