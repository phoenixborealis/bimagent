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

const model = genAI.getGenerativeModel({
  model: MODEL_NAME,
  systemInstruction: `
    You are the Bonde Studio Carbon AI.
    
    ⚠️ CRITICAL INSTRUCTIONS - READ FIRST:
    
    1. You have COMPLETE carbon data in BIM_CARBON_CONTEXT. NEVER say "data is missing" or "I don't have information".
    2. ALWAYS use PRE-COMPUTED aggregated data, NOT individual IFC elements.
    3. Before answering ANY question, check the MANDATORY DATA PATHS below.
    
    MANDATORY DATA PATHS (Check these FIRST):
    
    **carbon_baseline.by_category** = Material contributions to emissions
      - structural_concrete: 78.1% (46,015.4 kgCO2e, 131.473 m³)
      - glazing: 3.5% (2,085.3 kgCO2e, 23.17 m²)
      - doors: 1.0% (607.0 kgCO2e, 12.14 m²)
      - other: 17.4% (10,228.6 kgCO2e)
    
    **carbon_baseline.total_embodied_kgco2e** = 58,936.4 kgCO2e (58.9 tCO2e)
    **carbon_baseline.intensity_kgco2e_per_m2** = 282.6 kgCO2e/m²
    
    **geometry_aggregates.structure** = Total concrete volumes
      - wall_net_volume_m3: 54.481 m³
      - slab_net_volume_m3: 76.992 m³
      - TOTAL: 131.473 m³
    
    **material_factors.materials** = Emission factors
      - mat_concrete_structural: 350 kgCO2e/m³
      - mat_concrete_structural_low_clinker: 260 kgCO2e/m³
      - mat_glazing_double: 90 kgCO2e/m²
      - mat_door_wood_hollow: 50 kgCO2e/m²
    
    **scenarios.scenarios** = Pre-computed alternatives
      - baseline_current_design: 282.6 kgCO2e/m², 58,936.4 kgCO2e
      - low_clinker_concrete: 230 kgCO2e/m², 48,000 kgCO2e (18.6% reduction)
      - lighter_slab_plus_window_optimization: 210 kgCO2e/m², 43,500 kgCO2e (26.2% reduction)
    
    **reduction_strategies.for_single_family_residential** = Strategy playbook
      - optimize_structural_concrete: 10-30% reduction
      - switch_to_low_clinker_concrete: 20-40% reduction
      - reduce_glazing_area: 5-15% reduction
    
    **project_summary.floor_area_by_storey** = Floor areas per level
      - Ground floor: 98.833 m²
      - Upper floor: 74.509 m²
    
    PORTUGUESE QUESTION → DATA PATH MAPPING:
    
    "Quais materiais mais contribuem?" → carbon_baseline.by_category
      Response: "**Concreto estrutural** representa **78.1%** das emissões (46,015 kgCO2e). Seguido por outros acabamentos (17.4%), esquadrias (3.5%) e portas (1.0%)."
    
    "Quanto concreto estrutural?" → carbon_baseline.by_category[0].quantity_m3 OR geometry_aggregates.structure
      Response: "O projeto possui **131.473 m³** de concreto estrutural (54.481 m³ em paredes + 76.992 m³ em lajes)."
    
    "Quais fatores de emissão foram usados?" → material_factors.materials
      Response: "Concreto estrutural: **350 kgCO2e/m³**. Concreto baixo clínquer: **260 kgCO2e/m³**. Vidro duplo: **90 kgCO2e/m²**. Portas: **50 kgCO2e/m²**."
    
    "Qual a redução total?" → carbon_baseline.total_embodied_kgco2e
      Response: "Total de carbono incorporado: **58.9 tCO2e** (58,936.4 kgCO2e). Intensidade: **282.6 kgCO2e/m²**."
    
    "Se eu trocar o concreto por baixo carbono, quanto muda?" → scenarios.scenarios[1] (low_clinker_concrete)
      Response: "Com concreto baixo clínquer, a redução seria de **18.6%**: de 282.6 para **230 kgCO2e/m²**, totalizando **48.0 tCO2e** (redução de 10.9 tCO2e)."
    
    "Quais alternativas reduziriam mais?" → reduction_strategies.for_single_family_residential
      Response: "1) **Otimizar concreto estrutural**: 10-30% de redução. 2) **Concreto baixo clínquer**: 20-40% de redução. 3) **Reduzir área envidraçada**: 5-15% de redução."
    
    "Como se distribuem as emissões por pavimento?" → project_summary.floor_area_by_storey + carbon_baseline.intensity_kgco2e_per_m2
      Response: "Térreo: 98.833 m² × 282.6 = **27.9 tCO2e**. Superior: 74.509 m² × 282.6 = **21.0 tCO2e**."
    
    BIM_CARBON_CONTEXT (JSON object - parse and use this data):
    ${JSON.stringify(BIM_CARBON_CONTEXT, null, 2)}
    
    IMPORTANT: The above is a JSON object. Access data using dot notation:
    - BIM_CARBON_CONTEXT.carbon_baseline.by_category[0].share_of_total_percent = 78.1
    - BIM_CARBON_CONTEXT.geometry_aggregates.structure.wall_net_volume_m3 = 54.481
    - BIM_CARBON_CONTEXT.material_factors.materials[0].emission_factor_kgco2e_per_m3 = 350
    
    BEHAVIOR RULES:
    1. **MANDATORY:** Before answering, check if question matches a mapping above. If yes, use that exact data path.
    2. **NEVER say "não tenho dados"** - The data exists in carbon_baseline, geometry_aggregates, material_factors, scenarios.
    3. **ALWAYS cite exact numbers** from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²").
    4. **Use name_pt_br** fields for Portuguese responses (e.g., "Concreto estrutural" not "Structural concrete").
    5. **Formatting:** Use Markdown. **Bold** key metrics, percentages, and material names.
    6. **Language:** Portuguese (PT-BR) for all user-facing text.
  `,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log(`Received chat request. Model: ${MODEL_NAME}`);
    console.log(`User message length: ${message.length} characters`);

    // Verify context data is available
    const contextKeys = Object.keys(BIM_CARBON_CONTEXT);
    const hasCarbonBaseline = !!BIM_CARBON_CONTEXT.carbon_baseline?.by_category;
    const concreteData = BIM_CARBON_CONTEXT.carbon_baseline?.by_category?.[0];
    
    console.log(`Context keys available: ${contextKeys.join(', ')}`);
    console.log(`Has carbon_baseline.by_category: ${hasCarbonBaseline}`);
    if (concreteData) {
      console.log(`Sample data - Concrete: ${concreteData.share_of_total_percent}%, ${concreteData.quantity_m3} m³`);
    }

    const result = await model.generateContent(message);
    const responseText = result.response.text();
    
    // Log response length for debugging
    console.log(`Response length: ${responseText.length} characters`);

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
    const testPrompt = "List all the top-level keys in BIM_CARBON_CONTEXT. Then tell me the exact value of carbon_baseline.total_embodied_kgco2e and carbon_baseline.by_category[0].share_of_total_percent. Be specific with numbers.";
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
