declare const Deno: any;

// @ts-ignore
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai@0.22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Bank Statement Schema
 */
const unifiedBankStatementSchema = {
  type: SchemaType.OBJECT,
  properties: {
    transactions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Transaction date in YYYY-MM-DD or DD/MM/YYYY format" },
          description: { type: SchemaType.STRING, description: "Full, cleaned transaction description" },
          debit: { type: SchemaType.NUMBER, description: "Withdrawal or debit amount" },
          credit: { type: SchemaType.NUMBER, description: "Deposit or credit amount" },
          balance: { type: SchemaType.NUMBER, description: "Running balance after this transaction" },
        },
        required: ["date", "description"],
      },
    },
    summary: {
      type: SchemaType.OBJECT,
      properties: {
        totalDebits: { type: SchemaType.NUMBER },
        totalCredits: { type: SchemaType.NUMBER },
        openingBalance: { type: SchemaType.NUMBER, description: "The EXACT opening balance stated at the start of the period" },
        closingBalance: { type: SchemaType.NUMBER, description: "The EXACT closing balance stated at the end of the period" },
        accountNumber: { type: SchemaType.STRING, description: "The bank account number or IBAN" },
        accountHolder: { type: SchemaType.STRING, description: "The full name of the account holder" },
        statementPeriod: { type: SchemaType.STRING, description: "The period covered by this statement (e.g., Jan 2024)" },
      },
    },
    currency: { type: SchemaType.STRING, description: "The 3-letter ISO currency code (e.g., AED, USD, EUR)" },
  },
};

const getBankStatementPrompt = (startDate?: string, endDate?: string) => `
Extract all transactions and summary details from this bank statement.

Rules for Extraction:
1. **Account Details**: Extract the Account Holder Name and Account Number/IBAN exactly as they appear.
2. **Strict Balances**: Extract the Opening Balance and Closing Balance that are explicitly printed on the statement. DO NOT calculate them; if they are not present, return null.
3. **Transaction Precision**: Extract every single transaction. Ensure the date is clear, the description is cleaned of noisy OCR artifacts, and debit/credit/balance are accurate numbers.
4. **Currency**: Identify the currency used in the statement (e.g., AED, USD, GBP, EUR). Default to AED if uncertain but usually found in headers or amount columns.
5. **Deduplication**: If multiple pages are provided, ensure transactions are not duplicated across page breaks.

${startDate ? `Specific Interest Period Start: ${startDate}` : ""}
${endDate ? `Specific Interest Period End: ${endDate}` : ""}

Return the data in the specified JSON format.
`;

Deno.serve(async (req: any) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageParts, startDate, endDate } = await req.json();

    // Use Deno.env directly as it is standard in Edge Functions
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: unifiedBankStatementSchema,
      },
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [...imageParts, { text: getBankStatementPrompt(startDate, endDate) }] }]
    });

    const response = result.response;
    const text = response.text();

    return new Response(
      text,
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      },
    );

  } catch (error: any) {
    console.error("Error in extract-bank-statement:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 200, // Return 200 to ensure CORS headers are processed by browser
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      },
    );
  }
});
