import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BIM_CARBON_CONTEXT } from './data/bimCarbonContext.js';

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

if (!API_KEY) {
  console.error("CRITICAL: API_KEY is missing.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// STRICT CONFIGURATION: NO FALLBACKS
// Using the 2.0 Flash Experimental model as requested.
const MODEL_NAME = "gemini-2.0-flash-exp";

// Base model created ONCE at startup (minimal systemInstruction per Gemini docs)
const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
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
});

// Question classifier for context routing
function classifyQuestion(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('materiais mais contribuem') || lower.includes('emissões por categoria') || lower.includes('contribuem para as emissões')) {
    return 'emissions_by_category';
  }
  if (lower.includes('concreto estrutural') || lower.includes('quanto concreto') || lower.includes('quantidade de concreto')) {
    return 'concrete_quantity';
  }
  if (lower.includes('fatores de emissão') || lower.includes('emission factors') || lower.includes('fatores foram usados')) {
    return 'emission_factors';
  }
  if (lower.includes('redução total') || lower.includes('total carbono') || lower.includes('total de carbono') || lower.includes('total de emissões')) {
    return 'total_carbon';
  }
  if (lower.includes('trocar concreto') || lower.includes('baixo carbono') || lower.includes('low-clinker') || lower.includes('baixo clínquer')) {
    return 'scenario_low_clinker';
  }
  if (lower.includes('alternativas') || lower.includes('reduzir emissões') || lower.includes('estratégias') || lower.includes('redução')) {
    return 'reduction_strategies';
  }
  if (lower.includes('por pavimento') || lower.includes('por andar') || lower.includes('distribuem as emissões')) {
    return 'emissions_by_floor';
  }
  if (lower.includes('resumo executivo') || lower.includes('executivo')) {
    return 'executive_summary';
  }
  return 'general';
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, activeScenarioId, categoryId } = req.body;
    const scenarioId = activeScenarioId || BIM_CARBON_CONTEXT.scenarios.baseline_id;
    
    console.log(`Received chat request. Model: ${MODEL_NAME}`);
    console.log(`User message length: ${message.length} characters`);
    console.log(`Active scenario: ${scenarioId}`);
    if (categoryId) {
      console.log(`Category context: ${categoryId}`);
    }

    // Find active scenario (same logic as dashboard adapter)
    const activeScenario = BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === scenarioId) ||
      BIM_CARBON_CONTEXT.scenarios.scenarios.find(s => s.id === BIM_CARBON_CONTEXT.scenarios.baseline_id);
    
    if (activeScenario) {
      console.log(`Active scenario: ${activeScenario.label_pt_br}, Intensity: ${activeScenario.intensity_kgco2e_per_m2} kgCO2e/m²`);
    }

    // Classify question type for context routing
    const questionType = classifyQuestion(message);
    console.log(`Question type: ${questionType}`);

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
        specificInstructions = 'Use quick_ref.material_contributions or carbon_baseline.by_category. List each material with percent, kgco2e, and quantity. Use name_pt_br fields for Portuguese.';
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
        specificInstructions = 'Use quick_ref.concrete_total_m3 for total (131.473 m³). Break down into walls (54.481 m³) and slabs (76.992 m³).';
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
        specificInstructions = 'List all emission factors with units (kgCO2e/m³ or kgCO2e/m²). Use name_pt_br fields for material names.';
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
        specificInstructions = 'Use quick_ref.total_embodied_kgco2e or active_scenario.total_kgco2e. Convert to tCO2e for display (divide by 1000). When user asks about "current scenario", use active_scenario values.';
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
        specificInstructions = 'Use quick_ref.scenarios.low_clinker. Show reduction_percent (18.6%) and new intensity (230 kgCO2e/m²). Compare against baseline (282.6 kgCO2e/m²).';
        break;
        
      case 'reduction_strategies':
        contextSection = JSON.stringify({
          reduction_strategies: BIM_CARBON_CONTEXT.reduction_strategies
        }, null, 2);
        specificInstructions = 'Use reduction_strategies.for_single_family_residential. List all strategies with typical_reduction_range_percent. Use name_pt_br fields.';
        break;
        
      case 'emissions_by_floor':
        contextSection = JSON.stringify({
          quick_ref: {
            floor_areas: BIM_CARBON_CONTEXT.quick_ref.floor_areas,
            intensity_kgco2e_per_m2: BIM_CARBON_CONTEXT.quick_ref.intensity_kgco2e_per_m2
          },
          project_summary: {
            floor_area_by_storey: BIM_CARBON_CONTEXT.project_summary.floor_area_by_storey
          }
        }, null, 2);
        specificInstructions = 'Calculate emissions per floor: floor_area × intensity. Ground floor: 98.833 m² × intensity. Upper floor: 74.509 m² × intensity.';
        break;
        
      default:
        // For general questions, send full context
        contextSection = JSON.stringify({
          ...BIM_CARBON_CONTEXT,
          active_scenario: activeScenario,
          active_scenario_id: scenarioId,
          category_context: categoryId || null
        }, null, 2);
        specificInstructions = 'Use any relevant section from BIM_CARBON_CONTEXT. Check quick_ref first for common queries.';
    }

    // Build enhanced prompt with context IN USER MESSAGE (not systemInstruction)
    const enhancedPrompt = `
      RELEVANT DATA FOR THIS QUESTION:
      ${contextSection}
      
      ${activeScenario ? `ACTIVE SCENARIO:
      - Name: ${activeScenario.label_pt_br}
      - Intensity: ${activeScenario.intensity_kgco2e_per_m2} kgCO₂e/m²
      - Total: ${activeScenario.total_kgco2e} kgCO₂e
      ${activeScenario.reduction_vs_baseline_percent ? `- Reduction: ${activeScenario.reduction_vs_baseline_percent}% vs baseline` : ''}` : ''}
      
      ${categoryId ? `CATEGORY FOCUS: Answer specifically about category "${categoryId}" from carbon_baseline.by_category.` : ''}
      
      User Question: ${message}
      
      ANSWERING INSTRUCTIONS:
      ${specificInstructions}
      
      GENERAL RULES:
      1. Parse the JSON above as a JavaScript object
      2. Access data using dot notation (e.g., quick_ref.material_contributions.concrete.percent = 78.1)
      3. Always cite exact numbers from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²")
      4. Use name_pt_br fields for Portuguese responses
      5. Format with Markdown, bold key metrics
      6. When user asks about "current scenario" or "this project", use ACTIVE SCENARIO values above
      7. NEVER say "não tenho dados" - the data exists in the context above
    `;
    
    // Reuse base model (don't create new one)
    const result = await model.generateContent(enhancedPrompt);
    const responseText = result.response.text();
    
    // Log response length and token usage estimate
    console.log(`Response length: ${responseText.length} characters`);
    console.log(`Context section size: ~${Math.round(contextSection.length / 4)} tokens (estimated)`);

    res.json({ reply: responseText });

  } catch (error) {
    console.error("Gemini API Fatal Error:", error);
    console.error("Error details:", {
      status: error.status,
      message: error.message,
      stack: error.stack
    });
    // Return the actual error to the UI for immediate visibility
    res.status(500).json({ reply: `Erro Técnico (${error.status || 500}): ${error.message}` });
  }
});

// Test endpoint to verify LLM can see context
app.post('/api/test-context', async (req, res) => {
  try {
    const testPrompt = `
      BIM_CARBON_CONTEXT (JSON object - use this data):
      ${JSON.stringify(BIM_CARBON_CONTEXT, null, 2)}
      
      Test Question: List all the top-level keys in BIM_CARBON_CONTEXT. Then tell me the exact value of carbon_baseline.total_embodied_kgco2e and carbon_baseline.by_category[0].share_of_total_percent. Be specific with numbers.
      
      ANSWERING INSTRUCTIONS:
      - Parse the JSON above
      - List all top-level keys
      - Provide exact values: carbon_baseline.total_embodied_kgco2e and carbon_baseline.by_category[0].share_of_total_percent
      - Use exact numbers from the context
    `;
    console.log('Testing context visibility...');
    const result = await model.generateContent(testPrompt);
    const responseText = result.response.text();
    res.json({ reply: responseText, context_keys: Object.keys(BIM_CARBON_CONTEXT) });
  } catch (error) {
    console.error("Test context error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
