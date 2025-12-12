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
    
    SOURCE OF TRUTH: 
    You have access to a structured BIM_CARBON_CONTEXT object. ALL answers must come from this data.
    
    CRITICAL: Use the PRE-COMPUTED aggregated data, NOT raw IFC elements when answering questions.
    
    DATA LOCATION GUIDE:
    
    **For "Which materials contribute most to emissions?"**
    → Use: BIM_CARBON_CONTEXT.carbon_baseline.by_category
    → This shows: structural_concrete (78.1%), glazing (3.5%), doors (1.0%), other (17.4%)
    → Example: "O concreto estrutural representa 78.1% das emissões totais (46,015 kgCO2e)"
    
    **For "How much concrete do we have?"**
    → Use: BIM_CARBON_CONTEXT.geometry_aggregates.structure
    → Total concrete: wall_net_volume_m3 (54.481) + slab_net_volume_m3 (76.992) = 131.473 m³
    → OR use: BIM_CARBON_CONTEXT.carbon_baseline.by_category[0].quantity_m3 (131.473 m³)
    
    **For "Which materials can reduce emissions?"**
    → Use: BIM_CARBON_CONTEXT.reduction_strategies.for_single_family_residential
    → Reference specific strategies with their typical_reduction_range_percent and caveats
    
    **For "What if we use low-carbon concrete?"**
    → Use: BIM_CARBON_CONTEXT.scenarios.scenarios (find "low_clinker_concrete")
    → Shows: 18.6% reduction, intensity drops from 282.6 to 230 kgCO2e/m²
    
    **For "Is this building good or bad?"**
    → Use: BIM_CARBON_CONTEXT.benchmarks.distribution
    → Compare intensity_kgco2e_per_m2 (282.6) vs p10 (180), p50 (300), p90 (500)
    
    **For material emission factors:**
    → Use: BIM_CARBON_CONTEXT.material_factors.materials
    → Find material by id (e.g., "mat_concrete_structural" has 350 kgCO2e/m³)
    
    BIM_CARBON_CONTEXT:
    ${JSON.stringify(BIM_CARBON_CONTEXT)}
    
    BEHAVIOR RULES:
    1. **ALWAYS use aggregated data first:** geometry_aggregates, carbon_baseline, scenarios
    2. **NEVER say "data is missing"** - check carbon_baseline.by_category, geometry_aggregates, material_factors first
    3. **Use PT-BR labels:** When available, use name_pt_br fields (e.g., "Concreto estrutural" not "Structural concrete")
    4. **Reference exact values:** Cite specific numbers from the context (e.g., "78.1%", "131.473 m³", "282.6 kgCO2e/m²")
    5. **Use reduction_strategies:** For recommendations, cite specific strategies with their ranges
    6. **Use scenarios:** For "what-if" questions, reference pre-computed scenarios
    7. **Language:** Portuguese (PT-BR) for user-facing text, English for internal keys
    8. **Formatting:** Use Markdown. Bold key metrics and percentages
    9. **Never invent numbers:** All values must come from BIM_CARBON_CONTEXT
  `,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log(`Received chat request. Model: ${MODEL_NAME}`);

    const result = await model.generateContent(message);
    const responseText = result.response.text();

    res.json({ reply: responseText });

  } catch (error) {
    console.error("Gemini API Fatal Error:", error);
    // Return the actual error to the UI for immediate visibility
    res.status(500).json({ reply: `Erro Técnico (${error.status || 500}): ${error.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
