import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAICacheManager } from '@google/generative-ai/server';
import { IFC_DATA } from './server-data.js';

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

if (!API_KEY) {
  console.error("CRITICAL: API_KEY is missing.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const cacheManager = new GoogleAICacheManager(API_KEY);

let currentCacheName = null;
const CACHE_TTL_SECONDS = 3600;

// --- Helper: Get or Create Cache ---
async function getOrCreateCache() {
  if (currentCacheName) {
    try {
      await cacheManager.getCache(currentCacheName);
      return currentCacheName;
    } catch (e) {
      console.log("Cache expired. Creating new one...");
      currentCacheName = null;
    }
  }

  console.log("Creating new Gemini Context Cache...");
  
  // UPDATED SYSTEM PROMPT FOR IFC DATA STRUCTURE
  const systemInstruction = `
    You are the Bonde Studio Carbon AI.
    
    SOURCE OF TRUTH: 
    You have access to a cached JSON object containing detailed IFC (Industry Foundation Classes) building data from the "FZK-Haus AC20-Final.ifc" file. This includes:
    - Building elements (walls, slabs, windows, doors, spaces) with IDs and metadata
    - Detailed properties and quantities (dimensions, areas, volumes) for each element
    - Property sets (BaseQuantities) linked to building elements
    - IFC metadata (schema version, author, creation date, creating application)
    - Unit definitions (length, area, volume, etc.)
    
    BEHAVIOR:
    1. **Consistency:** Your answers must match the IFC data exactly (e.g., element dimensions, quantities, property values).
    2. **Language:** Portuguese (PT-BR).
    3. **Formatting:** Use Markdown. Bold key metrics and element names.
    4. **Role:** Act as a BIM and carbon consultant, able to analyze building geometry and discuss carbon implications.
    5. **IFC Knowledge:** Reference specific IFC elements by name, type, and ID when relevant. Use property values from the data.
    6. **Carbon Analysis:** When discussing carbon, reference GHG Protocol and Verra VM0032 methodologies.
  `;

  const cacheResult = await cacheManager.create({
    model: "models/gemini-1.5-flash-002",
    displayName: "bonde-demo-cache-" + Date.now(),
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: JSON.stringify(IFC_DATA) }],
      },
    ],
    ttlSeconds: CACHE_TTL_SECONDS,
  });

  currentCacheName = cacheResult.name;
  console.log(`Cache created: ${currentCacheName}`);
  return currentCacheName;
}

// --- API Route ---
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    let cacheName = await getOrCreateCache();

    try {
      const model = genAI.getGenerativeModel({
        model: "models/gemini-1.5-flash-002",
        cachedContent: cacheName,
      });
      const result = await model.generateContent(message);
      return res.json({ reply: result.response.text() });

    } catch (genError) {
      console.warn(`Generation failed. Retrying with fresh cache...`);
      currentCacheName = null;
      cacheName = await getOrCreateCache();
      
      const model = genAI.getGenerativeModel({
        model: "models/gemini-1.5-flash-002",
        cachedContent: cacheName,
      });
      const retryResult = await model.generateContent(message);
      return res.json({ reply: retryResult.response.text() });
    }

  } catch (error) {
    console.error("Fatal error:", error);
    res.status(500).json({ error: "Failed to process request." });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});