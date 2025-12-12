# Context Delivery Analysis Report

## How Context Data is Sent

### Current Implementation

1. **When Context is Set:**
   - `systemInstruction` is set **ONCE** when the model is created (line 28-109 in `server.js`)
   - This happens at **server startup**, not per request
   - The model object is reused for all requests

2. **How It's Sent:**
   - `systemInstruction` is automatically included with **every** `generateContent()` call
   - Only the user's message is sent in the request body
   - The SDK handles including the system instruction automatically

3. **Code Flow:**
   ```javascript
   // Server startup (runs once)
   const model = genAI.getGenerativeModel({
     model: MODEL_NAME,
     systemInstruction: `...${JSON.stringify(BIM_CARBON_CONTEXT)}...`
   });

   // Each request (runs per chat message)
   app.post('/api/chat', async (req, res) => {
     const result = await model.generateContent(message); // systemInstruction included automatically
   });
   ```

## Context Size Analysis

### Measurements:
- **Total system prompt:** 27,272 characters (~6,818 tokens)
- **JSON portion:** 22,900 characters (~5,725 tokens)
- **Instructions portion:** 4,372 characters (~1,093 tokens)

### Limits:
- **Gemini 2.0 Flash Exp limit:** 1,048,576 tokens (input)
- **Our usage:** ~6.8k tokens (0.65% of limit) ✅ **Well within limits**

### Data Completeness:
- ✅ All 12 context sections present
- ✅ `carbon_baseline.by_category` exists with 4 categories
- ✅ Key values verified: 78.1%, 131.473 m³, etc.
- ✅ JSON is complete (starts/ends correctly)

## Prompt Caching Status

### Current Status: **NOT USING PROMPT CACHING**

**Why:**
- We're using `@google/generative-ai` SDK (not Vertex AI API)
- Prompt caching requires Vertex AI API with explicit caching setup
- `systemInstruction` is sent with every request (no caching)

**Impact:**
- Every request sends the full ~6.8k token system prompt
- This is **inefficient** but **functional**
- Cost: Paying for ~6.8k tokens on every request

**Potential Optimization:**
- Switch to Vertex AI API for explicit prompt caching
- Would cache the systemInstruction and only pay once
- Requires code changes and different API setup

## Potential Issues

### 1. LLM Not Using Context Data
**Symptoms:**
- LLM says "data is missing" when data exists
- LLM uses individual IFC elements instead of aggregates
- LLM doesn't reference scenarios or reduction strategies

**Possible Causes:**
- LLM might not be parsing the JSON correctly
- JSON might be too nested for LLM to navigate
- Instructions might not be clear enough

**Verification Needed:**
- Add logging to verify context is sent (✅ Added)
- Test if LLM can see the data by asking it to list context keys
- Consider flattening JSON structure or adding explicit examples

### 2. System Instruction Format
**Current:** JSON is embedded as string in template literal
```javascript
systemInstruction: `
  ...
  BIM_CARBON_CONTEXT:
  ${JSON.stringify(BIM_CARBON_CONTEXT)}
  ...
`
```

**Potential Issue:** LLM might not recognize this as structured data

**Potential Fix:** Add explicit instruction to parse JSON:
```javascript
systemInstruction: `
  ...
  BIM_CARBON_CONTEXT (JSON object - parse this):
  ${JSON.stringify(BIM_CARBON_CONTEXT, null, 2)}
  
  IMPORTANT: The above is a JSON object. Access data using dot notation:
  - BIM_CARBON_CONTEXT.carbon_baseline.by_category[0].share_of_total_percent
  - BIM_CARBON_CONTEXT.geometry_aggregates.structure.wall_net_volume_m3
  ...
`
```

### 3. Context Not Being Applied
**Check:** Verify the model actually receives the system instruction

**Test:** Add a test endpoint that asks the LLM to list what data it has access to:
```javascript
app.post('/api/test-context', async (req, res) => {
  const testPrompt = "List all the keys in BIM_CARBON_CONTEXT and tell me the value of carbon_baseline.total_embodied_kgco2e";
  const result = await model.generateContent(testPrompt);
  res.json({ reply: result.response.text() });
});
```

## Recommendations

### Immediate Actions:
1. ✅ **Added logging** to verify context data is available at request time
2. **Add test endpoint** to verify LLM can see the context
3. **Improve JSON formatting** - use `JSON.stringify(obj, null, 2)` for readability
4. **Add explicit JSON parsing instructions** in system prompt

### Medium-term Optimizations:
1. **Consider prompt caching** if switching to Vertex AI API
2. **Flatten JSON structure** if LLM has trouble navigating nested data
3. **Add data validation** to ensure context is complete before sending

### Long-term Considerations:
1. **Move to Vertex AI API** for better caching and cost optimization
2. **Consider RAG approach** - store context in vector DB, retrieve on demand
3. **Split context** - send only relevant sections per question type

## Verification Steps

1. **Check server logs** after deployment to see:
   - Context keys available
   - Sample data values
   - Response lengths

2. **Test with explicit questions:**
   - "What keys are in BIM_CARBON_CONTEXT?"
   - "What is the value of carbon_baseline.total_embodied_kgco2e?"
   - "List all categories in carbon_baseline.by_category"

3. **Monitor API responses** to see if LLM references context data
