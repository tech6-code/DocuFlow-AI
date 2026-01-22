<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OgTmcn7nVyBKtZeBb7jeC8xPx7z97-x0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_API_URL` in [.env.local](.env.local) to your backend URL (default `http://localhost:5050/api`)
3. Run the app:
   `npm run dev`

## Backend (Node.js)

The backend lives in `server/` and proxies all Gemini and database requests.

1. Install backend dependencies:
   `cd server && npm install`
2. Create `server/.env` (see `server/.env.example`) and set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
3. Start the backend:
   `npm run dev`
