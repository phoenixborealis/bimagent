# Fix Cloud Build Trigger Configuration

## ❌ Current Issue

Your Cloud Build trigger is configured to use **"In-line"** (Gravar YAML in-line) configuration, which means it's NOT reading the `cloudbuild.yaml` file from your repository.

Even though we created `cloudbuild.yaml` with the fix, it won't be used until you change the trigger to read from the repository.

---

## ✅ Solution: Change Trigger to Use Repository File

### Option 1: Update via Google Cloud Console (Recommended)

1. **Open the trigger editor** (you're already there)
2. **In "Configuração" section**, under **"Local"**:
   - Change from **"In-line"** (Gravar YAML in-line)
   - To **"Repositório"** (Repository)
3. **In the path field** that appears, enter:
   ```
   cloudbuild.yaml
   ```
   (or just leave it as the default if it auto-fills)
4. **Click "Salvar" (Save)** to save the trigger

### Option 2: Update via gcloud CLI

```bash
gcloud builds triggers update TRIGGER_NAME \
  --region=REGION \
  --build-config=cloudbuild.yaml \
  --repo=phoenixborealis/bimagent \
  --repo-type=GITHUB
```

Replace:
- `TRIGGER_NAME` with your trigger name
- `REGION` with your region (e.g., `us-west1`)

---

## ✅ After Changing to Repository

Once you change the trigger to use "Repositório" with path `cloudbuild.yaml`:

1. ✅ The trigger will read `cloudbuild.yaml` from your GitHub repo
2. ✅ The fix (uploading `dist/` to GCS) will be executed
3. ✅ New UI will render correctly

---

## 🔍 How to Verify

After updating:

1. **Check the trigger configuration**:
   - Should show "Repositório" (not "In-line")
   - Should show path: `cloudbuild.yaml`

2. **After next push**, check Cloud Build logs:
   - Should see Step 1: npm build
   - Should see Step 2: Upload to GCS
   - Should see Step 3: Docker build
   - Should see Step 4: Push image

3. **GCS bucket should be updated** with new `dist/` files

---

## ⚠️ Alternative: Update Inline Configuration

If you prefer to keep using inline configuration, you can copy the contents of `cloudbuild.yaml` and paste it into the inline editor. However, **using the repository file is recommended** because:
- ✅ Easier to maintain
- ✅ Version controlled in Git
- ✅ Changes with code pushes
- ✅ Better for collaboration
