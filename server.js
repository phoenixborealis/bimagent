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
  
  // UPDATED SYSTEM PROMPT FOR NEW DATA STRUCTURE
  const systemInstruction = `
    You are the Bonde Studio Carbon AI.
    
    SOURCE OF TRUTH: 
    You have access to a cached JSON object containing the Carbon Inventory of the "Residencial Alto do Parque" project.
    
    BEHAVIOR:
    1. **Consistency:** Your answers must match the JSON numbers exactly (e.g., 1054 credits).
    2. **Language:** Portuguese (PT-BR).
    3. **Formatting:** Use Markdown. Bold key metrics (e.g., **1.054 tCO₂e**).
    4. **Role:** Act as a consultant explaining the sustainability benefits of the project.
    5. **Methodology:** If asked, cite GHG Protocol and Verra VM0032 (Simulated).
  `;

  const cacheResult = await cacheManager.create({
    model: "models/gemini-1.5-flash-001",
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
        model: "models/gemini-1.5-flash-001",
        cachedContent: cacheName,
      });
      const result = await model.generateContent(message);
      return res.json({ reply: result.response.text() });

    } catch (genError) {
      console.warn(`Generation failed. Retrying with fresh cache...`);
      currentCacheName = null;
      cacheName = await getOrCreateCache();
      
      const model = genAI.getGenerativeModel({
        model: "models/gemini-1.5-flash-001",
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