declare const Deno: any;

// @ts-ignore
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai@0.22.0";

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
    const { imageParts, documentType } = await req.json();
    if (!documentType) throw new Error("Document type is required");

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    const client = new GoogleGenerativeAI(apiKey);

    const prompt = `Analyze this ${documentType} and extract key details into structured JSON.`;

    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }]
    });

    return new Response(
      result.response.text(),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: any) {
    console.error(`Error in extract-identity:`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
