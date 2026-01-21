declare const Deno: any;

// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, ...params } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const client = new GoogleGenerativeAI(apiKey);
    const modelId = "gemini-2.0-flash";

    let prompt = "";
    if (mode === "lead-score") {
      prompt = `Score this lead: ${JSON.stringify(params.leadData)}. Return JSON.`;
    } else if (mode === "sales-email") {
      prompt = `Write sales email for ${params.recipientName}. Return text.`;
    } else {
      prompt = `Analyze data: ${JSON.stringify(params)}. Return JSON.`;
    }

    const model = client.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(prompt);

    return new Response(
      result.response.text(),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: any) {
    console.error("Error in analyze-sales:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
