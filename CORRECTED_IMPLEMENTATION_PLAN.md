# Corrected Implementation Plan - Data Alignment Fix

## Overview

This plan implements the complete fix with **data alignment** as the priority:
- **Source of Truth**: `server-data.js` (FZK-Haus IFC data) - **NO CHANGES**
- **Frontend Data**: `demoData.ts` and `demo_building_data.json` - **ALIGN TO server-data.js**
- **System Prompt**: `server.js` - ensure consistency

---

## Implementation Steps

### Step 1: Install Dependencies ✅ (No Change)
```bash
npm install react-markdown remark-gfm @tailwindcss/typography
```

### Step 2: Update `data/demoData.ts` to Align with `server-data.js`

**Changes:**
1. Change `project.name`: "Residencial Alto do Parque" → "FZK-Haus AC20"
2. Update `project.id`: "alto-do-parque-demo" → "fzk-haus-ac20-demo"
3. Update `bim_geometry.source_ifc_file`: "AC20-FZK-Haus.ifc" → "FZK-Haus AC20-Final.ifc" (exact match)
4. Keep all carbon data (demo values - appropriate for sales demo)
5. Keep location as "São Paulo, SP" (acceptable for Brazilian sales demo context)

**Rationale:**
- Project name matches IFC file reference
- IFC filename matches exactly what's in `server-data.js`
- Carbon data remains as realistic demo values

### Step 3: Update `data/demo_building_data.json` (Same Changes)

Apply identical changes to maintain consistency between TS and JSON formats.

### Step 4: Update `server.js` System Prompt

**Current prompt mentions:**
```
"...from the "FZK-Haus AC20-Final.ifc" file..."
```

**Keep as-is** - already correct! Just ensure it references the project consistently.

**Optional enhancement**: Add note that project is displayed as "FZK-Haus AC20" in the UI.

### Step 5: Update Tailwind Config ✅

Keep root-level content paths, add animations:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in-from-bottom': 'slideInFromBottom 0.5s ease-out forwards',
        'slide-in-from-left': 'slideInFromLeft 0.7s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideInFromBottom: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInFromLeft: { '0%': { transform: 'translateX(-20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } }
      }
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
```

### Step 6: Update CSS ✅

Use clean version:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

### Step 7: Replace Frontend (`App.tsx`) ✅

Use the synthesized optimal version (no changes needed - code is correct).

### Step 8: **CRITICAL - Build Frontend**
```bash
npm run build
```

### Step 9: Deploy
```bash
git add .
git commit -m "Complete Sales Demo V3 - Agent UI + Data Alignment (FZK-Haus)"
git push origin master
```

---

## Summary of Data Alignment Changes

### Files Changed:

1. **`data/demoData.ts`**:
   - `project.id`: "alto-do-parque-demo" → "fzk-haus-ac20-demo"
   - `project.name`: "Residencial Alto do Parque" → "FZK-Haus AC20"
   - `bim_geometry.source_ifc_file`: "AC20-FZK-Haus.ifc" → "FZK-Haus AC20-Final.ifc"

2. **`data/demo_building_data.json`**:
   - Same changes as `demoData.ts`

3. **`server.js`**:
   - System prompt already correct (mentions "FZK-Haus AC20-Final.ifc")
   - No changes needed (already aligned)

### Files NOT Changed:

- ✅ **`server-data.js`** - Remains unchanged (source of truth)

---

## Result

After implementation:
- ✅ Frontend displays: "FZK-Haus AC20"
- ✅ Backend LLM knows: "FZK-Haus AC20-Final.ifc"
- ✅ IFC file reference matches exactly
- ✅ No project name mismatches
- ✅ LLM won't hallucinate different project names
