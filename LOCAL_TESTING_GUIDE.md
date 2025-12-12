# Local Testing Guide

## Yes, You Can Test Locally! 🎯

The application can be run locally, but you need to run **two servers** simultaneously:
1. **Vite dev server** (frontend) - typically port 5173
2. **Express server** (backend API) - port 8080

---

## Prerequisites

1. **Node.js** installed (v18+ recommended)
2. **Gemini API Key** (from Google AI Studio)
3. All dependencies installed (`npm install` already done ✅)

---

## Setup Steps

### Step 1: Configure Environment Variables

You need a Gemini API key. Create or update `.env.local` file in the project root:

```bash
# .env.local
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

**OR** you can set it as an environment variable before running:

```bash
export GEMINI_API_KEY=your_actual_gemini_api_key_here
```

**How to get a Gemini API key:**
1. Go to https://aistudio.google.com/apikey
2. Create a new API key
3. Copy it to your `.env.local` file

---

## Option 1: Run Both Servers Separately (Recommended for Development)

### Terminal 1: Start Express Backend Server

```bash
# Set API key if not in .env.local
export GEMINI_API_KEY=your_key_here

# Start backend server
npm start
```

**Expected output:**
```
Server running on port 8080
```

The backend will serve:
- `/api/chat` endpoint
- Built frontend from `dist/` folder (if built)
- Falls back to serving static files

### Terminal 2: Start Vite Frontend Dev Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### ⚠️ Issue: CORS / API Proxy

**Problem**: Frontend (port 5173) tries to call `/api/chat`, but Express is on port 8080.

**Solution**: You need to configure Vite to proxy API requests. Add this to `vite.config.ts`:

```typescript
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
});
```

**Then access the app at**: `http://localhost:5173`

---

## Option 2: Production-Like Setup (Simpler)

This matches production behavior more closely:

### Step 1: Build the Frontend

```bash
npm run build
```

This creates a `dist/` folder with the compiled frontend.

### Step 2: Start the Express Server

```bash
# Set API key
export GEMINI_API_KEY=your_key_here

# Start server (serves built frontend + API)
npm start
```

**Access the app at**: `http://localhost:8080`

**Pros:**
- ✅ Simpler - only one server
- ✅ Matches production setup
- ✅ No proxy configuration needed

**Cons:**
- ❌ Slower development (need to rebuild on changes)
- ❌ No hot module replacement

---

## Option 3: Development with Auto-Rebuild (Best Developer Experience)

Use a tool like `concurrently` to run both servers and rebuild automatically:

### Install concurrently:
```bash
npm install --save-dev concurrently
```

### Add to package.json scripts:
```json
"scripts": {
  "dev": "vite",
  "dev:full": "concurrently \"npm run dev\" \"npm run dev:server\"",
  "dev:server": "node server.js",
  "build": "vite build",
  "preview": "vite preview",
  "start": "node server.js"
}
```

### Update vite.config.ts with proxy (as shown in Option 1)

### Run both together:
```bash
export GEMINI_API_KEY=your_key_here
npm run dev:full
```

---

## Testing Checklist

Once running, test these features:

### 1. Initial Load
- [ ] Page loads without errors
- [ ] Upload interface appears
- [ ] "Carregar Modelo de Exemplo" button is visible

### 2. Narrative Flow
- [ ] Click "Carregar Modelo de Exemplo"
- [ ] See "Ingestão Iniciada" message with element counts
- [ ] See "Dados Faltantes Detectados" gap request
- [ ] Click "Confirmar Grid BR (SIN)"
- [ ] See calculation progress
- [ ] Dashboard slides in from left
- [ ] Context panel appears (collapsible)

### 3. Insight Mode
- [ ] Query category tabs appear (Materiais, Emissões, etc.)
- [ ] Can click different categories
- [ ] Suggestions update based on selected category
- [ ] Can click suggestion buttons
- [ ] Chat input is enabled

### 4. Live Chat
- [ ] Type a question in the input
- [ ] Press Enter or click Send
- [ ] See loading indicator
- [ ] Receive AI response with markdown formatting
- [ ] Markdown renders correctly (bold, lists, etc.)

### 5. Visual Elements
- [ ] Animations work (slide-in, fade-in)
- [ ] Context panel expands/collapses
- [ ] Dashboard KPI cards show correct numbers
- [ ] Chart renders correctly
- [ ] All icons display properly

---

## Troubleshooting

### Issue: "API_KEY is missing"
**Solution**: Set `GEMINI_API_KEY` environment variable or add to `.env.local`

### Issue: "Cannot GET /" or 404 errors
**Solution**: Make sure Express server is running on port 8080

### Issue: "Network error" when sending chat messages
**Solutions**:
- Check if Express server is running
- Verify API endpoint is `/api/chat`
- Check browser console for CORS errors (if using Option 1, ensure proxy is configured)

### Issue: Markdown not rendering
**Solutions**:
- Verify `@tailwindcss/typography` is installed
- Check `tailwind.config.js` has Typography plugin
- Verify prose classes are in the CSS

### Issue: Animations not working
**Solutions**:
- Verify custom animations are in `index.css`
- Check browser console for CSS errors
- Ensure Tailwind is processing the custom classes

### Issue: TypeScript errors
**Solutions**:
- Run `npm install` to ensure all types are installed
- Check `tsconfig.json` is correct
- Verify all imports resolve correctly

---

## Quick Start (Recommended for First Test)

**Simplest approach for first test:**

1. **Set API key:**
   ```bash
   export GEMINI_API_KEY=your_key_here
   ```

2. **Build frontend:**
   ```bash
   npm run build
   ```

3. **Start server:**
   ```bash
   npm start
   ```

4. **Open browser:**
   ```
   http://localhost:8080
   ```

This works immediately without any proxy configuration!

---

## Ports Used

- **8080**: Express server (backend API + production frontend)
- **5173**: Vite dev server (frontend only, if running separately)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key for chat functionality |
| `PORT` | ❌ No | Server port (defaults to 8080) |

---

## Notes

- The backend server (`server.js`) uses Gemini API caching for context
- Frontend code uses demo data from `demoData.ts` (no real file upload)
- All document analysis is simulated (as per PRD requirements)
- Chat responses come from Gemini API with IFC data context

---

**You're ready to test locally! 🚀**
