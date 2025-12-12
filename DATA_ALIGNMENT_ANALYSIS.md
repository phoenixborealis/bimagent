# Data Alignment Analysis: Understanding the Data Flow

## Current Situation

### Data Files Overview

1. **`server-data.js`** (SOURCE OF TRUTH for LLM)
   - Contains: Raw IFC geometry data (elements, properties, quantities)
   - References: "FZK-Haus AC20-Final.ifc"
   - Used by: `server.js` → sent to Gemini LLM as context
   - Structure: Detailed IFC element metadata (walls, slabs, windows, doors, spaces)

2. **`data/demoData.ts`** (Frontend Display Data)
   - Contains: Project summary, carbon inventory, materials
   - References: "Residencial Alto do Parque" + "AC20-FZK-Haus.ifc"
   - Used by: `App.tsx` → displays in UI (dashboard, charts, context panel)
   - Structure: High-level project info + carbon calculations

3. **`data/demo_building_data.json`**
   - Contains: Same as `demoData.ts` but in JSON format
   - Status: Appears to be duplicate/unused

### The Problem

**Current State:**
- `server-data.js` → "FZK-Haus AC20-Final.ifc" (IFC geometry)
- `demoData.ts` → "Residencial Alto do Parque" (project name)
- **Mismatch**: UI shows "Alto do Parque", LLM knows "FZK-Haus"

**User Requirement:**
- `server-data.js` is SOURCE OF TRUTH (what LLM sees)
- `demoData.ts` must align WITH `server-data.js`, not the other way around
- Option: Delete or update `demo_building_data.json` to match

---

## Understanding What `server-data.js` Contains

**Structure:**
- IFC metadata (schema, author, creation date)
- Building elements (walls, slabs, windows, doors, spaces)
- Element properties (dimensions, areas, volumes)
- Property sets (BaseQuantities)
- Unit definitions

**What it DOESN'T contain:**
- ❌ Project name (e.g., "Alto do Parque")
- ❌ Project location (city, state)
- ❌ Carbon inventory results
- ❌ Material baseline vs project comparisons
- ❌ Scope 1/2/3 emissions
- ❌ Reduction calculations

**Conclusion**: `server-data.js` is **purely geometric IFC data**, not project/carbon data.

---

## Solution Options

### Option A: Keep FZK-Haus as Project Name (Recommended)

**Rationale:**
- `server-data.js` references "FZK-Haus AC20-Final.ifc"
- Align frontend to show "FZK-Haus" as project name
- Keep all IFC geometry data consistent

**Changes Needed:**
1. Update `demoData.ts`:
   - Change `project.name` from "Residencial Alto do Parque" → "FZK-Haus"
   - Keep `bim_geometry.source_ifc_file` as "AC20-FZK-Haus.ifc" (already correct)
   - Extract/derive project metadata from IFC if possible
   - Or use placeholder/realistic data that aligns with IFC file

2. Update `demo_building_data.json`:
   - Same changes as `demoData.ts`

3. Update `server.js` system prompt:
   - Keep reference to "FZK-Haus AC20-Final.ifc" (already correct)
   - Add project-level context that matches frontend

**Pros:**
- ✅ Source of truth (`server-data.js`) remains unchanged
- ✅ Frontend and backend aligned on project name
- ✅ No LLM hallucination about project names

**Cons:**
- ⚠️ "FZK-Haus" is a German test building - might not be ideal for Brazilian sales demo
- ⚠️ Need to create realistic project metadata (location, typology) that matches IFC geometry

---

### Option B: Enrich `server-data.js` with Project Context (Alternative)

**Rationale:**
- Add project-level metadata to `server-data.js`
- Keep IFC geometry, add project summary
- Make `server-data.js` the complete source of truth

**Changes Needed:**
1. Update `server-data.js`:
   - Add `project` object with name, location, typology
   - Add `carbon_inventory` object (or keep separate)
   - Keep all existing IFC geometry data

2. Update `demoData.ts`:
   - Extract project data from `server-data.js` (if possible)
   - Or keep as separate display layer that references `server-data.js`

**Pros:**
- ✅ Single source of truth for everything
- ✅ Can keep "Alto do Parque" if desired

**Cons:**
- ⚠️ Violates user requirement (they want to keep `server-data.js` as-is)
- ⚠️ `server-data.js` becomes much larger
- ⚠️ Mixes geometric data with project/carbon data

---

## Recommended Solution: Option A (Align Frontend to IFC File)

### Step-by-Step Implementation

#### 1. Extract Project Metadata from IFC Data

From `server-data.js`, we can derive:
- **File name**: "FZK-Haus AC20-Final.ifc"
- **Author**: "Building Designer Office"
- **Creation date**: "2016-12-21"
- **Schema**: "IFC2X3"
- **Geometry**: We have element counts in `demoData.ts` that match the IFC structure

#### 2. Update `demoData.ts` to Reference FZK-Haus

**Project Name**: Change to "FZK-Haus" or "FZK-Haus AC20" (can add location if needed)

**Project Location**: 
- Option A: Use German location (matches IFC file origin)
- Option B: Use placeholder "São Paulo, SP" (for demo purposes)
- Option C: Use generic location

**Key Constraint**: Ensure `bim_geometry.elements_summary` values are consistent with what's in `server-data.js` (or at least realistic for the IFC file).

#### 3. Update `demo_building_data.json` (Same as `demoData.ts`)

#### 4. Update `server.js` System Prompt

Ensure prompt mentions:
- IFC file: "FZK-Haus AC20-Final.ifc"
- Project context (extracted from frontend data or kept generic)

---

## Questions to Clarify

1. **Project Name Preference**: 
   - Keep "FZK-Haus" (matches IFC file exactly)?
   - Or use "FZK-Haus - Residencial" (add residential context)?
   - Or use a different name that references the IFC file?

2. **Location**:
   - Match IFC file origin (likely Germany)?
   - Use Brazilian location for sales demo purposes?
   - Generic/placeholder?

3. **Carbon Data**:
   - Keep current carbon calculations (they're demo data anyway)?
   - Or should they reference the IFC geometry more directly?

---

## Proposed Changes Summary

### Files to Update:

1. **`data/demoData.ts`**:
   - Change `project.name`: "Residencial Alto do Parque" → "FZK-Haus" (or variant)
   - Verify `bim_geometry.source_ifc_file` matches IFC file reference
   - Optionally update location to match IFC origin or keep as demo location

2. **`data/demo_building_data.json`**:
   - Same changes as `demoData.ts` (keep in sync)

3. **`server.js`** (System Prompt):
   - Ensure consistency with project name shown in UI
   - Reference IFC file correctly: "FZK-Haus AC20-Final.ifc"

4. **No changes to `server-data.js`** (as per user requirement)

---

## Implementation Approach

**Recommended**: Create realistic project metadata that:
- ✅ References "FZK-Haus" as project name
- ✅ Keeps IFC file reference consistent
- ✅ Maintains demo carbon data (since it's a sales demo)
- ✅ Aligns frontend display with backend LLM context

This way, when user asks about the project, both UI and LLM will reference the same project name.
