# PocketVibe — Deployment Checklist

## Which AI setup does this app currently use?

The app auto-selects the AI path at runtime using this priority:

```
VITE_SUPABASE_URL set and valid?
  → YES → call Supabase Edge Function (pocketvibe-generate)
            Edge Function calls Gemini server-side using GEMINI_API_KEY secret
  → NO  → DEV build + VITE_GEMINI_API_KEY present?
              → YES → call Gemini directly from the browser (local dev only)
              → NO  → throw AIConfigError → user sees "AI is not connected"
```

You can inspect the active state at runtime with `getAIConnectionStatus()` from
`src/services/aiService.ts`. It returns `connected`, `activeProvider`, and `reason`.

---

## Setup A — Old setup: Vercel Gemini key (VITE_GEMINI_API_KEY)

### ⚠️ No longer supported in production

Setting `VITE_GEMINI_API_KEY` in Vercel **does not work** for production deployments.

**Why:** As of the current codebase, direct client-side Gemini access is guarded behind
`import.meta.env.DEV`. In a production build (`vite build`), `DEV` is `false`, so the
`generateViaGemini()` path is unreachable even if the key is present.

**What you will see instead:** `getAIConnectionStatus()` returns:
```json
{ "connected": false, "reason": "old_vercel_key_present_but_not_used" }
```
A `console.warn` is also logged:
> Gemini key exists in Vercel, but production AI now expects Supabase Edge Function config.

**Old env variable name:** `VITE_GEMINI_API_KEY`

**What to do:** Keep the key if you want local dev fallback (see `.env.local`), but
follow Setup B below for production. Vercel environment changes require a **redeploy**
before they take effect — changing a variable in the Vercel dashboard does not hot-reload
the running deployment.

---

## Setup B — Current recommended setup: Supabase Edge Function

### 1. Vercel — Frontend environment variables

Set these in: **Vercel Dashboard → Project → Settings → Environment Variables**

| Variable | Value | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase `anon` public key | Production, Preview, Development |

> Both keys are safe to include in the browser bundle — they are public keys, not secrets.
> Find them at: **Supabase Dashboard → Settings → API → Project API keys**.

After adding or changing variables, **trigger a redeploy** (Vercel does not rebuild automatically).

---

### 2. Supabase — Deploy the Edge Function

```powershell
# Install CLI (once)
npm install -g supabase

# Log in
supabase login

# Link to your project (use your project ref from the Supabase dashboard)
supabase link --project-ref <project-ref>

# Set the Gemini API key as a server-side secret (never goes in the browser)
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>

# Deploy the function
supabase functions deploy pocketvibe-generate --no-verify-jwt
```

> Docker does **not** need to be running for `supabase functions deploy`.
> The `--no-verify-jwt` flag is required — the frontend sends the anon key as a Bearer
> token, not a user JWT.

---

### 3. Verify the Edge Function is live

```powershell
$body    = '{"userRequest":"make a simple checklist","mode":"new"}'
$anonKey = "<your-supabase-anon-key>"
$headers = @{
  "Content-Type"  = "application/json"
  "Authorization" = "Bearer $anonKey"
  "apikey"        = $anonKey
}
$r = Invoke-WebRequest `
  -Uri "https://<project-ref>.supabase.co/functions/v1/pocketvibe-generate" `
  -Method POST -Headers $headers -Body $body -UseBasicParsing

"Status: $($r.StatusCode)"
($r.Content | ConvertFrom-Json).creationType
```

Expected output:
```
Status: 200
checklist
```

---

### 4. Confirm CORS

The Edge Function returns these headers on every response (including OPTIONS preflight):

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, apikey
```

If a browser request fails with a CORS error, redeploy the function — the headers are
set inside `index.ts` and only take effect after a new deployment.

---

### 5. Confirm the production frontend calls the Edge Function

After deploying to Vercel, open your production URL and open DevTools → Network.
Filter by `pocketvibe-generate`. When you create a tool you should see:

- Request URL: `https://<project-ref>.supabase.co/functions/v1/pocketvibe-generate`
- Method: `POST`
- Status: `200`

If you see no network request and get "AI is not connected", the Vercel env variables
are not set or the redeploy has not run yet.

---

## Manual QA Checklist (run after every production deployment)

### Create
- [ ] Type a prompt and submit
- [ ] A new tool appears with a relevant title and pre-filled content
- [ ] No "AI is not connected" message appears

### Improve
- [ ] Open an existing tool → tap the AI update / improve button
- [ ] Enter an improvement request (e.g. "add a section for snacks")
- [ ] The tool content visibly changes
- [ ] **All existing data is preserved** — nothing is deleted or reset
- [ ] The tool does NOT revert to blank or an error state

### Add
- [ ] Open an existing tool → tap the add button
- [ ] Enter an addition request (e.g. "add two more habits")
- [ ] New items appear alongside the existing ones
- [ ] Existing items are unchanged

### AI not connected (regression check)
- [ ] Temporarily remove `VITE_SUPABASE_URL` from Vercel and redeploy
- [ ] Creating a tool shows the offline fallback: "AI not connected — showing an example you can edit"
- [ ] Improving/adding to an existing tool shows: "AI is not connected right now, but you can still edit this tool directly"
- [ ] No existing creation is overwritten
- [ ] Re-add the variable and redeploy to restore normal service

### Invalid response guard
- [ ] If the Edge Function returns a malformed response, the creation is not silently overwritten
- [ ] An error message is shown; the original creation remains intact

---

## Redeployment quick reference

| What changed | Action needed |
|---|---|
| Vercel env variable added or changed | Redeploy on Vercel (Deployments → Redeploy) |
| Edge Function code changed | `supabase functions deploy pocketvibe-generate --no-verify-jwt` |
| Gemini API key rotated | `supabase secrets set GEMINI_API_KEY=<new-key>` then redeploy function |
| Frontend code changed | `git push` → Vercel auto-deploys from main |
