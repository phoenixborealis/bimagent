# Fix Plan Summary: LLM Context Data Access

## 🔴 Critical Issue

**93% of queries fail** because LLM cannot access context data, even though it exists.

## 📊 Root Cause (Based on Gemini API Documentation)

1. **Context in Wrong Place**: 6.8k tokens of JSON in `systemInstruction` (should be in user message)
2. **SystemInstruction Overload**: Docs say keep it concise (< 1k tokens for role/behavior only)
3. **JSON Parsing**: Model may not parse embedded JSON string correctly
4. **No Routing**: Model doesn't know which data section to use for each question

## ✅ Solution: 6-Phase Fix

### Phase 1: Move Context to User Message (CRITICAL)
- **Current**: Context in `systemInstruction` (6.8k tokens)
- **Fix**: Move to user message prompt
- **Impact**: Model processes context fresh with each request

### Phase 2: Create Quick Reference Layer
- **Add**: Flattened `quick_ref` section with most-accessed values
- **Benefit**: Simpler navigation for common queries
- **Structure**: Top-level access to totals, material contributions, scenarios

### Phase 3: Question-Type Routing
- **Add**: Classifier function to identify question type
- **Benefit**: Send only relevant context (40-60% token reduction)
- **Types**: emissions_by_category, concrete_quantity, emission_factors, etc.

### Phase 4: Explicit JSON Schema
- **Add**: Schema description + access examples in prompt
- **Benefit**: Model understands data structure better

### Phase 5: Response Validation
- **Add**: Validate responses contain required data
- **Benefit**: Catch failures and retry with better instructions

### Phase 6: Context Caching (Optional)
- **Add**: Cache context sections for reuse
- **Benefit**: Further token optimization

## 📈 Expected Results

| Metric | Current | After Fix | Improvement |
|--------|---------|-----------|-------------|
| Success Rate | 7% | 85%+ | **12x** |
| Token Usage | 6.8k | 2-4k | **40-60% reduction** |
| Response Quality | Generic | Data-driven | **Exact numbers** |

## 🎯 Query Fixes

| Query | Current | After Fix |
|-------|---------|-----------|
| "Quais materiais mais contribuem?" | ❌ "No data" | ✅ "Concreto: 78.1% (46,015 kgCO2e)" |
| "Quanto concreto estrutural?" | ❌ "4.425 m³" (wrong) | ✅ "131.473 m³" (correct) |
| "Quais fatores de emissão?" | ❌ "No data" | ✅ Lists all 5 factors |
| "Qual a redução total?" | ❌ "No data" | ✅ "58.9 tCO2e" |
| "Se eu trocar concreto?" | ❌ Generic | ✅ "18.6% reduction, 230 kgCO2e/m²" |

## 🚀 Implementation Order

1. **Phase 1** (Critical): Move context to user message
2. **Phase 2** (Critical): Create quick_ref structure
3. **Phase 4** (Critical): Implement question routing
4. **Phase 3** (Important): Add JSON schema
5. **Phase 5** (Important): Add validation
6. **Phase 6** (Optional): Context caching

## 📝 Key Code Changes

### Before:
```javascript
// Context in systemInstruction (WRONG)
const model = genAI.getGenerativeModel({
  systemInstruction: `...${JSON.stringify(BIM_CARBON_CONTEXT)}...`
});
const result = await model.generateContent(message); // No context in message
```

### After:
```javascript
// Minimal systemInstruction (CORRECT)
const model = genAI.getGenerativeModel({
  systemInstruction: `You are Bonde Studio Carbon AI. Use BIM_CARBON_CONTEXT from user message.`
});

// Context in user message (CORRECT)
const enhancedPrompt = `
  BIM_CARBON_CONTEXT: ${JSON.stringify(BIM_CARBON_CONTEXT, null, 2)}
  User Question: ${message}
`;
const result = await model.generateContent(enhancedPrompt);
```

## ⚠️ Important Notes

1. **activeScenarioId Support**: User added this parameter - use it to filter context to scenario-specific data
2. **Backward Compatibility**: Keep full context available for complex queries
3. **Testing**: Test each question type after implementation
4. **Monitoring**: Log question types and validation results

## 📋 Full Details

See `FULL_FIX_PLAN.md` for complete implementation details, code examples, and testing plan.
