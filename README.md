<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1OgTmcn7nVyBKtZeBb7jeC8xPx7z97-x0

## Setup and Execution

**Prerequisites:** Node.js, [Supabase CLI](https://supabase.com/docs/guides/cli)

### 1. Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create/Update `.env.local` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### 2. Backend Setup (AI Features)

The application now uses **Supabase Edge Functions** for secure AI processing.

1. **Set Gemini API Key**:
   Run this command to store your API key securely in Supabase:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=your_key_here
   ```
2. **Deploy Functions**:
   Deploy the required edge functions to your project:
   ```bash
   npx supabase functions deploy analyze-finance analyze-sales extract-bank-statement extract-identity extract-invoices
   ```

