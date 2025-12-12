# Chat Formatting Optimization Plan
## Based on Official Gemini Best Practices

---

## 📋 Executive Summary

**Goal**: Optimize chat responses to use structured formatting (tables, KPIs, bold metrics) instead of text paragraphs.

**Current Issue**: Model dumps text paragraphs instead of structured data.

**Approach**: Enhance system instructions and per-query instructions with explicit formatting rules, examples, and structured output guidance per official Gemini documentation.

---

## 🔍 Analysis: Current vs. Best Practices

### Current Implementation

**System Instruction** (Lines 31-48):
- ✅ Minimal (good - follows best practice)
- ✅ Role definition clear
- ❌ Formatting rules too vague: "Format with Markdown, bold key metrics"
- ❌ No table formatting instructions
- ❌ No examples provided
- ❌ No structured output schema

**Per-Query Instructions** (Lines 220-231):
- ✅ Context-specific instructions
- ❌ No formatting examples
- ❌ No table structure guidance
- ❌ Generic "Format with Markdown" not actionable

### Official Gemini Best Practices (From Documentation)

1. **System Instructions Should Specify Format**: "Clearly defining the format of the response can lead to more predictable outputs"
2. **Markdown Tables**: "Use basic GFM table syntax and do NOT include any extra whitespace or tabs for alignment"
3. **Provide Examples**: "Including examples of the desired output format in your prompt can guide the model"
4. **Structured Prompting**: Use SI → RI → QI (System Instruction → Role Instruction → Query Instruction)
5. **Temperature Settings**: Can help with table formatting (slightly higher for better alignment)

---

## 🎯 Optimization Plan

### Phase 1: Enhance System Instruction with Formatting Style Guide

**Current** (too vague):
```
5. Format with Markdown, bold key metrics.
```

**Enhanced** (explicit style guide):
```
FORMATTING STYLE GUIDE (STRICT):
1. KPIs FIRST: Start answers with the most important number in **Bold** (e.g., "**58.9 tCO₂e**")
2. USE TABLES: When comparing materials, categories, or scenarios, ALWAYS use Markdown tables
   - Use GFM table syntax: | Column | Column |
   - Do NOT add extra whitespace or tabs for alignment
   - Left-align text columns, right-align numbers
3. USE EMOJIS: Use emojis for section headers (🏗️ **Estrutura**, 📉 **Redução**, 📊 **Análise**)
4. NO FLUFF: Do not write "Based on the file provided..." or "According to the data...". Just give the insight.
5. LANGUAGE: Portuguese (PT-BR) for all user-facing text
6. STRUCTURE: Use headers (##) for major sections, bullet points for lists
```

**Rationale**: 
- Explicit table formatting rules prevent whitespace issues (known Gemini 2.0 Flash bug)
- Examples in instructions guide the model
- Clear structure reduces ambiguity

---

### Phase 2: Add Format Examples to System Instruction

**Add to System Instruction**:
```
EXAMPLE FORMATS:

For "Emissões por Categoria":
🏗️ **Resumo de Emissões (Linha de Base)**

O total de emissões incorporadas (A1-A3) é de **58.9 tCO₂e**.

| Categoria | Quantidade | Emissões (tCO₂e) | Impacto (%) |
| :--- | :--- | :---: | :---: |
| **Concreto Estrutural** | 131.5 m³ | **46.0** | 78.1% |
| **Esquadrias (Vidros)** | 23.2 m² | 2.1 | 3.5% |
| **Portas** | 12.1 m² | 0.6 | 1.0% |
| **Outros** | N/A | 10.2 | 17.4% |

📉 **Análise:** O concreto é o maior ofensor. Recomendo investigar o cenário de *Baixo Clínquer* para reduzir este impacto.

For "Fatores de Emissão":
📊 **Fatores de Emissão Utilizados**

| Material | Fator (kgCO₂e/m³ ou m²) | Uso |
| :--- | :---: | :--- |
| **Concreto Estrutural** | 350 | Lajes e paredes |
| **Concreto Baixo Clínquer** | 260 | Alternativa |
| **Vidro Duplo** | 90 | Janelas |
| **Portas** | 50 | Portas internas/externas |
```

**Rationale**: 
- Examples show exact desired format
- Model can pattern-match to examples
- Reduces formatting inconsistencies

---

### Phase 3: Enhance Per-Query Instructions with Format Templates

**Current** (generic):
```javascript
specificInstructions = 'Use quick_ref.material_contributions or carbon_baseline.by_category. List each material with percent, kgco2e, and quantity. Use name_pt_br fields for Portuguese.';
```

**Enhanced** (with format template):
```javascript
specificInstructions = `
  DATA TO USE: quick_ref.material_contributions or carbon_baseline.by_category
  FORMAT REQUIRED:
  1. Start with total in bold: **{total} tCO₂e**
  2. Create a Markdown table with columns: Categoria | Quantidade | Emissões (tCO₂e) | Impacto (%)
  3. Use name_pt_br fields for Portuguese material names
  4. Right-align numbers in table
  5. Add analysis section with emoji header: 📉 **Análise:**
`;
```

**Apply to All Question Types**:
- `emissions_by_category` → Table format template
- `concrete_quantity` → Structured breakdown with bold KPIs
- `emission_factors` → Table format template
- `total_carbon` → Bold KPI first, then details
- `scenario_low_clinker` → Comparison table (baseline vs. alternative)
- `reduction_strategies` → Table with strategy, range, caveats
- `emissions_by_floor` → Table with floor breakdown
- `executive_summary` → Structured sections with headers

**Rationale**:
- Question-specific format templates ensure consistency
- Reduces model's need to "decide" on format
- Each question type gets optimal structure

---

### Phase 4: Add Structured Output Schema (Optional Enhancement)

**For Critical Queries**, consider using Gemini's structured output feature:

```javascript
// For emissions_by_category queries
const responseSchema = {
  type: "object",
  properties: {
    total: {
      type: "string",
      description: "Total emissions in bold format (e.g., '**58.9 tCO₂e**')"
    },
    table: {
      type: "object",
      properties: {
        headers: {
          type: "array",
          items: { type: "string" }
        },
        rows: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    analysis: {
      type: "string",
      description: "Analysis section with emoji header"
    }
  }
};

// Use in generateContent
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: responseSchema
  }
});
```

**Rationale**:
- Guarantees structured output
- Easier to parse and format on frontend
- But: May reduce natural language flow

**Recommendation**: Start with Phase 1-3 (formatting instructions), add Phase 4 only if needed.

---

### Phase 5: Add Temperature Configuration (If Needed)

**Current**: No temperature specified (defaults to model default)

**Enhancement** (if table formatting issues persist):
```javascript
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: `...`,
  generationConfig: {
    temperature: 0.3, // Lower = more deterministic, but may cause table alignment issues
    // OR
    temperature: 0.7, // Higher = more creative, better table formatting (per Gemini docs)
  }
});
```

**Rationale**:
- Gemini docs suggest slightly higher temperature can help with table formatting
- But: May reduce consistency
- **Recommendation**: Test with default first, adjust only if needed

---

## 📝 Detailed Implementation Changes

### Change 1: Enhanced System Instruction

**File**: `server.js` (Lines 31-48)

**Current**:
```javascript
systemInstruction: `
  You are the Bonde Studio Carbon AI, a BIM and carbon consultant.
  
  CRITICAL RULES:
  1. You receive BIM_CARBON_CONTEXT data in each user message.
  2. ALWAYS use pre-computed aggregated data from BIM_CARBON_CONTEXT.
  3. NEVER say "data is missing" - check BIM_CARBON_CONTEXT first.
  4. Use Portuguese (PT-BR) for all user-facing responses.
  5. Format with Markdown, bold key metrics.
  
  DATA ACCESS PATTERN:
  - quick_ref = Flattened structure for common queries (fast access)
  - carbon_baseline.by_category = Emissions by material
  - geometry_aggregates = Pre-computed volumes/areas
  - material_factors = Emission factors
  - scenarios = Pre-computed alternatives
  - reduction_strategies = Strategy playbook
`
```

**Enhanced**:
```javascript
systemInstruction: `
  You are the **Bonde Studio Carbon AI**, a specialized consultant for Embodied Carbon in BIM.
  
  ### 🧠 YOUR BRAIN (SOURCE OF TRUTH)
  You have access to a JSON object called **BIM_CARBON_CONTEXT** provided in each user message.
  - It contains **Geometry** (walls, slabs, windows).
  - It contains **Carbon Results** (baseline, scenarios, intensity).
  - It contains **Benchmarks** and **Reduction Strategies**.
  
  **CRITICAL:** You DO possess carbon data. Look inside 'carbon_baseline' and 'scenarios' objects. Never say you don't have emissions data.
  
  ### 🎨 FORMATTING STYLE GUIDE (STRICT)
  1. **KPIs FIRST:** Start answers with the most important number in **Bold** (e.g., "**58.9 tCO₂e**").
  2. **USE TABLES:** When comparing materials, categories, or scenarios, ALWAYS use Markdown tables.
     - Use GFM table syntax: | Column | Column |
     - Do NOT add extra whitespace or tabs for alignment
     - Left-align text columns (| :--- |), right-align numbers (| :---: |)
  3. **USE EMOJIS:** Use emojis for section headers (🏗️ **Estrutura**, 📉 **Redução**, 📊 **Análise**, 🔍 **Detalhes**).
  4. **NO FLUFF:** Do not write "Based on the file provided..." or "According to the data...". Just give the insight.
  5. **LANGUAGE:** Portuguese (PT-BR) for all user-facing text.
  6. **STRUCTURE:** Use headers (##) for major sections, bullet points for lists.
  
  ### 📋 EXAMPLE FORMATS
  
  **For "Emissões por Categoria":**
  🏗️ **Resumo de Emissões (Linha de Base)**
  
  O total de emissões incorporadas (A1-A3) é de **58.9 tCO₂e**.
  
  | Categoria | Quantidade | Emissões (tCO₂e) | Impacto (%) |
  | :--- | :--- | :---: | :---: |
  | **Concreto Estrutural** | 131.5 m³ | **46.0** | 78.1% |
  | **Esquadrias (Vidros)** | 23.2 m² | 2.1 | 3.5% |
  | **Portas** | 12.1 m² | 0.6 | 1.0% |
  | **Outros** | N/A | 10.2 | 17.4% |
  
  📉 **Análise:** O concreto é o maior ofensor. Recomendo investigar o cenário de *Baixo Clínquer* para reduzir este impacto.
  
  **For "Fatores de Emissão":**
  📊 **Fatores de Emissão Utilizados**
  
  | Material | Fator (kgCO₂e/m³ ou m²) | Uso |
  | :--- | :---: | :--- |
  | **Concreto Estrutural** | 350 | Lajes e paredes |
  | **Concreto Baixo Clínquer** | 260 | Alternativa |
  | **Vidro Duplo** | 90 | Janelas |
  | **Portas** | 50 | Portas internas/externas |
  
  ### 🧠 DATA ACCESS PATTERN
  - quick_ref = Flattened structure for common queries (fast access)
  - carbon_baseline.by_category = Emissions by material
  - geometry_aggregates = Pre-computed volumes/areas
  - material_factors = Emission factors
  - scenarios = Pre-computed alternatives
  - reduction_strategies = Strategy playbook
`
```

---

### Change 2: Enhanced Per-Query Instructions

**File**: `server.js` (Lines 110-203)

**For Each Question Type**, enhance `specificInstructions`:

#### Example 1: `emissions_by_category`

**Current**:
```javascript
specificInstructions = 'Use quick_ref.material_contributions or carbon_baseline.by_category. List each material with percent, kgco2e, and quantity. Use name_pt_br fields for Portuguese.';
```

**Enhanced**:
```javascript
specificInstructions = `
  DATA TO USE: quick_ref.material_contributions or carbon_baseline.by_category
  
  FORMAT REQUIRED:
  1. Start with emoji header: 🏗️ **Resumo de Emissões (Linha de Base)**
  2. First line: "O total de emissões incorporadas (A1-A3) é de **{total} tCO₂e**."
  3. Create Markdown table with columns:
     | Categoria | Quantidade | Emissões (tCO₂e) | Impacto (%) |
  4. Use name_pt_br fields for Portuguese material names
  5. Right-align numbers (| :---: |)
  6. Bold the highest emission category
  7. End with analysis: 📉 **Análise:** [insight about dominant material]
`;
```

#### Example 2: `concrete_quantity`

**Current**:
```javascript
specificInstructions = 'Use quick_ref.concrete_total_m3 for total (131.473 m³). Break down into walls (54.481 m³) and slabs (76.992 m³).';
```

**Enhanced**:
```javascript
specificInstructions = `
  DATA TO USE: quick_ref.concrete_total_m3, concrete_walls_m3, concrete_slabs_m3
  
  FORMAT REQUIRED:
  1. Start with bold KPI: **{total} m³** de concreto estrutural
  2. Use structured breakdown:
     - 🏗️ **Paredes:** {walls} m³
     - 🏗️ **Lajes:** {slabs} m³
  3. Or use table if comparing:
     | Componente | Volume (m³) | % do Total |
     | :--- | :---: | :---: |
     | Paredes | {walls} | {percent}% |
     | Lajes | {slabs} | {percent}% |
`;
```

#### Example 3: `scenario_low_clinker`

**Current**:
```javascript
specificInstructions = 'Use quick_ref.scenarios.low_clinker. Show reduction_percent (18.6%) and new intensity (230 kgCO2e/m²). Compare against baseline (282.6 kgCO2e/m²).';
```

**Enhanced**:
```javascript
specificInstructions = `
  DATA TO USE: quick_ref.scenarios.low_clinker and baseline
  
  FORMAT REQUIRED:
  1. Start with bold comparison: **Redução de {percent}%** vs. linha de base
  2. Create comparison table:
     | Cenário | Intensidade (kgCO₂e/m²) | Total (tCO₂e) | Redução |
     | :--- | :---: | :---: | :---: |
     | **Linha de Base** | 282.6 | 58.9 | - |
     | **Baixo Clínquer** | 230.0 | 48.0 | 18.6% |
  3. Add analysis: 📉 **Impacto:** [explanation of reduction]
`;
```

**Apply similar enhancements to all question types** (`emission_factors`, `total_carbon`, `reduction_strategies`, `emissions_by_floor`, `executive_summary`).

---

### Change 3: Update General Rules in Enhanced Prompt

**File**: `server.js` (Lines 223-230)

**Current**:
```javascript
GENERAL RULES:
1. Parse the JSON above as a JavaScript object
2. Access data using dot notation (e.g., quick_ref.material_contributions.concrete.percent = 78.1)
3. Always cite exact numbers from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²")
4. Use name_pt_br fields for Portuguese responses
5. Format with Markdown, bold key metrics
6. When user asks about "current scenario" or "this project", use ACTIVE SCENARIO values above
7. NEVER say "não tenho dados" - the data exists in the context above
```

**Enhanced**:
```javascript
GENERAL RULES:
1. Parse the JSON above as a JavaScript object
2. Access data using dot notation (e.g., quick_ref.material_contributions.concrete.percent = 78.1)
3. Always cite exact numbers from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²")
4. Use name_pt_br fields for Portuguese responses
5. FOLLOW THE FORMATTING STYLE GUIDE in system instructions:
   - Start with bold KPI
   - Use Markdown tables for comparisons
   - Use emojis for section headers
   - No fluff text
6. When user asks about "current scenario" or "this project", use ACTIVE SCENARIO values above
7. NEVER say "não tenho dados" - the data exists in the context above
8. For tables: Use GFM syntax, no extra whitespace, right-align numbers
```

---

## 🎯 Expected Results

### Before (Current):
```
User: "Me mostra um resumo de emissões por categoria."

Response: "Desculpe, não tenho dados específicos sobre as emissões por categoria no arquivo fornecido. No entanto, posso ajudá-lo a analisar os dados de carbono incorporado se você tiver essas informações disponíveis..."
```

### After (Optimized):
```
User: "Me mostra um resumo de emissões por categoria."

Response: 
🏗️ **Resumo de Emissões (Linha de Base)**

O total de emissões incorporadas (A1-A3) é de **58.9 tCO₂e**.

| Categoria | Quantidade | Emissões (tCO₂e) | Impacto (%) |
| :--- | :--- | :---: | :---: |
| **Concreto Estrutural** | 131.5 m³ | **46.0** | 78.1% |
| **Esquadrias (Vidros)** | 23.2 m² | 2.1 | 3.5% |
| **Portas** | 12.1 m² | 0.6 | 1.0% |
| **Outros** | N/A | 10.2 | 17.4% |

📉 **Análise:** O concreto estrutural representa 78.1% das emissões totais, sendo o maior ofensor. Recomendo investigar o cenário de *Baixo Clínquer* para reduzir este impacto em até 18.6%.
```

---

## 📊 Implementation Checklist

### Phase 1: System Instruction Enhancement
- [ ] Update system instruction with formatting style guide
- [ ] Add example formats (emissions table, factors table)
- [ ] Add emoji usage guidelines
- [ ] Add "no fluff" rule

### Phase 2: Per-Query Instructions Enhancement
- [ ] Enhance `emissions_by_category` instructions with table template
- [ ] Enhance `concrete_quantity` instructions with structured breakdown
- [ ] Enhance `emission_factors` instructions with table template
- [ ] Enhance `total_carbon` instructions with bold KPI first
- [ ] Enhance `scenario_low_clinker` instructions with comparison table
- [ ] Enhance `reduction_strategies` instructions with strategy table
- [ ] Enhance `emissions_by_floor` instructions with floor breakdown table
- [ ] Enhance `executive_summary` instructions with structured sections

### Phase 3: General Rules Update
- [ ] Update GENERAL RULES section with formatting reminders
- [ ] Add table formatting specifics (GFM syntax, no whitespace)

### Phase 4: Testing
- [ ] Test each question type for proper formatting
- [ ] Verify tables render correctly in frontend
- [ ] Check emoji display
- [ ] Verify bold KPIs appear first
- [ ] Confirm no "fluff" text

### Phase 5: Optional Enhancements (If Needed)
- [ ] Add structured output schema for critical queries (if Phase 1-3 insufficient)
- [ ] Adjust temperature settings (if table formatting issues persist)

---

## ⚠️ Important Notes

1. **Don't Over-Constrain**: While explicit instructions help, too much structure can make responses feel robotic. Balance is key.

2. **Test Incrementally**: Implement Phase 1 first, test, then Phase 2, etc. Don't change everything at once.

3. **Frontend Compatibility**: Ensure frontend Markdown renderer (react-markdown) supports:
   - GFM tables
   - Emojis
   - Bold text
   - Headers

4. **Token Usage**: Adding examples increases token usage slightly, but should be offset by better routing (already implemented).

5. **Model Version**: Current model is `gemini-2.0-flash-exp`. These practices apply to this version.

---

## 🎯 Success Criteria

✅ Responses start with bold KPIs
✅ Tables used for comparisons (materials, scenarios, floors)
✅ Emojis used for section headers
✅ No "fluff" text ("Based on the file...")
✅ Portuguese (PT-BR) maintained
✅ Exact numbers cited from context
✅ Tables render correctly in frontend
✅ Consistent formatting across question types

---

**Status**: 📋 **PLAN COMPLETE - READY FOR REVIEW**

**Next Step**: Review plan, then implement Phase 1-3 incrementally with testing after each phase.
