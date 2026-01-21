declare const Deno: any;

// @ts-ignore
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai@0.22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const analyzeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    categorizedTransactions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          debit: { type: SchemaType.NUMBER },
          credit: { type: SchemaType.NUMBER },
          balance: { type: SchemaType.NUMBER },
          category: { type: SchemaType.STRING },
        },
      },
    },
    analysis: {
      type: SchemaType.OBJECT,
      properties: {
        spendingSummary: { type: SchemaType.STRING },
        cashFlow: {
          type: SchemaType.OBJECT,
          properties: {
            totalIncome: { type: SchemaType.NUMBER },
            totalExpenses: { type: SchemaType.NUMBER },
            netCashFlow: { type: SchemaType.NUMBER },
          },
        },
        recurringPayments: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              description: { type: SchemaType.STRING },
              amount: { type: SchemaType.NUMBER },
              frequency: { type: SchemaType.STRING },
            },
          },
        },
      },
    },
  },
};

Deno.serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { transactions } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analyzeSchema,
      },
    });

    const prompt = `Analyze these transactions and provide CoA categories and cashflow analysis: ${JSON.stringify(transactions)}`;
    const result = await model.generateContent(prompt);

    return new Response(
      result.response.text(),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: any) {
    console.error("Error in analyze-finance:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
