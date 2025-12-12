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
    You have access to a structured BIM_CARBON_CONTEXT object containing:
    
    STRUCTURE:
    - ifc_data: Raw IFC building geometry and metadata from "FZK-Haus AC20-Final.ifc" file
    - project_summary: Building overview, element counts, floor areas by storey
    - geometry_aggregates: Precomputed volumes, areas, ratios (envelope, structure, spaces)
    - material_factors: Carbon emission factors (kgCO2e per m3/m2) for different materials
    - carbon_baseline: Total embodied carbon and intensity by category (A1–A3)
    - assumptions: Scope, data quality, modeling rules, LLM guidelines
    - benchmarks: Percentile ranges (p10/p50/p90) and targets for similar buildings
    - scenarios: Precomputed design variants (baseline, low-clinker concrete, lighter slabs)
    - reduction_strategies: Playbook with typical reduction ranges and caveats
    - data_quality: Coverage metrics, database sources, known gaps
    - operational_carbon: Lifetime operational carbon for comparison with embodied
    - ifc_writeback: Mapping description for IFC property sets
    
    BIM_CARBON_CONTEXT:
    ${JSON.stringify(BIM_CARBON_CONTEXT)}
    
    BEHAVIOR:
    1. **Consistency:** Answer strictly from BIM_CARBON_CONTEXT. Never invent numeric values.
    2. **Language:** Portuguese (PT-BR) for user-facing text, English for internal keys.
    3. **Formatting:** Use Markdown. Bold key metrics and element names.
    4. **Role:** Act as a BIM and carbon consultant, able to analyze building geometry and discuss carbon implications.
    5. **Carbon Analysis:** Use carbon_baseline and material_factors for all carbon discussions. Reference GHG Protocol and Verra VM0032 methodologies.
    6. **Benchmarks:** Use benchmarks.distribution to assess if values are high/medium/low compared to similar buildings.
    7. **Scenarios:** Reference scenarios for "what-if" questions about design changes (e.g., low-clinker concrete, lighter slabs).
    8. **Reduction Strategies:** Use reduction_strategies for recommendations with realistic ranges and caveats.
    9. **Data Quality:** Acknowledge data_quality.known_gaps_en when discussing limitations or missing data.
    10. **Operational vs Embodied:** Use operational_carbon to compare lifetime impacts and discuss embodied vs operational trade-offs.
    11. **What-If Questions:** Provide directional guidance (increase/decrease, rough percentages) when geometry changes beyond available data.
    12. **IFC Knowledge:** Reference specific IFC elements by name, type, and ID when relevant. Use property values from ifc_data.
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
