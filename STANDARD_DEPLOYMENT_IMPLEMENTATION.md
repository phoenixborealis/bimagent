# Standard Cloud Run Deployment Implementation (Best Practices)

Based on [Google Cloud Run Official Documentation](https://cloud.google.com/run/docs), this is the standard best practice implementation for serving static files from a Docker container.

## Current Issue

Cloud Run is mounting a GCS volume at `/app/dist`, which overrides the Docker image's built `dist/` folder. This is NOT the standard approach for static files.

**Standard Best Practice**: Static files should be included in the Docker image and served from the container, not from GCS volume mounts.

---

## Standard Implementation

### 1. Dockerfile (Already Follows Best Practices ✅)

Your current Dockerfile is correct and follows official Cloud Run best practices:
- ✅ Multi-stage build (separates build from runtime)
- ✅ Builds `dist/` in builder stage
- ✅ Copies `dist/` to final image
- ✅ Minimal runtime image (node:22-alpine)

**No changes needed** - your Dockerfile is already following best practices.

### 2. server.js (Already Correct ✅)

Your `server.js` correctly serves static files from the container:
- ✅ `app.use(express.static(path.join(__dirname, 'dist')))`
- ✅ Fallback route serves `index.html` for SPA routing

**No changes needed** - your server.js is correct.

### 3. Standard Cloud Run Deployment Pattern

According to official docs, the standard pattern is:

```
Source Code
  ↓
Docker Build (creates dist/)
  ↓
Docker Image (contains dist/)
  ↓
Cloud Run Container (serves from /app/dist in image)
  ↓
Express.static serves files from container
```

**NOT**:
```
Docker Build
  ↓
Cloud Run mounts GCS at /app/dist (overrides image)
  ↓
Serves old files from GCS
```

---

## The Problem

The GCS volume mount is being added automatically by AI Studio's deployment system. According to Cloud Run best practices:

- **GCS volume mounts** should be used for:
  - Large data files
  - Configuration files that change frequently
  - Shared assets across multiple services

- **Static files (dist/)** should be:
  - Built in Docker
  - Included in Docker image
  - Served from container

---

## Solution: Ensure Docker Build Is Used

The standard implementation requires that Cloud Run uses the Docker image's `dist/` folder, not a GCS mount. Since your Dockerfile and server.js are already correct, the issue is likely in the deployment configuration.

**Standard deployment command** (per official docs):
```bash
gcloud run deploy SERVICE_NAME \
  --source . \
  --platform managed \
  --region REGION
```

This will:
1. Build using Dockerfile (creates dist/ in image)
2. Deploy image to Cloud Run
3. Serve static files from container (not GCS)

---

## Verification

Your implementation already matches the standard. The issue is that a GCS volume mount is overriding it. The standard best practice is:

1. ✅ **Dockerfile builds dist/** - Already correct
2. ✅ **Docker image contains dist/** - Already correct  
3. ✅ **server.js serves from container** - Already correct
4. ❌ **GCS volume mount should NOT override /app/dist** - This is the issue

**Your code is already following best practices. The problem is the deployment configuration adding a GCS volume mount.**
