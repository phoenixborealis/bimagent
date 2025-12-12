import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IFC_DATA } from './server-data.js';

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase body limit just in case
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

if (!API_KEY) {
  console.error("CRITICAL: API_KEY is missing.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- CONFIGURE MODEL WITH DATA ---
// Instead of caching, we inject the data directly into the system instruction.
// Gemini 1.5 Flash has a 1 Million token window, so this fits easily.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Standard stable model alias
  systemInstruction: `
    You are the Bonde Studio Carbon AI.
    
    SOURCE OF TRUTH: 
    You have access to the following JSON object containing detailed IFC (Industry Foundation Classes) building data from the "FZK-Haus AC20-Final.ifc" file. This includes:
    - Building elements (walls, slabs, windows, doors, spaces) with IDs and metadata
    - Detailed properties and quantities (dimensions, areas, volumes) for each element
    - Property sets (BaseQuantities) linked to building elements
    - IFC metadata (schema version, author, creation date, creating application)
    - Unit definitions (length, area, volume, etc.)
    
    DATA CONTEXT:
    ${JSON.stringify(IFC_DATA)}
    
    BEHAVIOR:
    1. **Consistency:** Your answers must match the IFC data exactly (e.g., element dimensions, quantities, property values).
    2. **Language:** Portuguese (PT-BR).
    3. **Formatting:** Use Markdown. Bold key metrics and element names.
    4. **Role:** Act as a BIM and carbon consultant, able to analyze building geometry and discuss carbon implications.
    5. **IFC Knowledge:** Reference specific IFC elements by name, type, and ID when relevant. Use property values from the data.
    6. **Carbon Analysis:** When discussing carbon, reference GHG Protocol and Verra VM0032 methodologies.
  `,
});

// --- API Route ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log("Received chat request:", message);

    // Generate Content (Standard Stateless Request)
    const result = await model.generateContent(message);
    const responseText = result.response.text();

    return res.json({ reply: responseText });

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a friendly error so the UI doesn't look broken
    res.json({ reply: "Desculpe, estou ajustando meus parâmetros. Poderia perguntar novamente?" });
  }
});

// --- Catch-all for React Frontend ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
