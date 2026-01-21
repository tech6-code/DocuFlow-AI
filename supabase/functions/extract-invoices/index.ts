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
 * Invoice Schemas
 */
const lineItemSchema = {
    type: SchemaType.OBJECT,
    properties: {
        description: { type: SchemaType.STRING },
        quantity: { type: SchemaType.NUMBER },
        unitPrice: { type: SchemaType.NUMBER },
        subtotal: { type: SchemaType.NUMBER },
        taxRate: { type: SchemaType.NUMBER },
        taxAmount: { type: SchemaType.NUMBER },
        total: { type: SchemaType.NUMBER },
    },
    required: ["description", "quantity", "unitPrice", "total"],
};

const invoiceSchema = {
    type: SchemaType.OBJECT,
    properties: {
        invoiceId: { type: SchemaType.STRING },
        vendorName: { type: SchemaType.STRING },
        customerName: { type: SchemaType.STRING },
        invoiceDate: { type: SchemaType.STRING },
        dueDate: { type: SchemaType.STRING },
        totalAmount: { type: SchemaType.NUMBER },
        currency: { type: SchemaType.STRING },
        invoiceType: { type: SchemaType.STRING, enum: ["sales", "purchase"] },
        vendorTrn: { type: SchemaType.STRING },
        customerTrn: { type: SchemaType.STRING },
        lineItems: { type: SchemaType.ARRAY, items: lineItemSchema },
    },
    required: ["invoiceId", "vendorName", "totalAmount", "invoiceDate", "lineItems"],
};

const multiInvoiceSchema = {
    type: SchemaType.OBJECT,
    properties: {
        invoices: { type: SchemaType.ARRAY, items: invoiceSchema },
    },
};

Deno.serve(async (req: any) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { imageParts, userCompanyName, userCompanyTrn } = await req.json();
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

        const client = new GoogleGenerativeAI(apiKey);
        const model = client.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: multiInvoiceSchema,
            },
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [...imageParts, { text: "Extract invoices. Return JSON." }] }]
        });

        return new Response(
            result.response.text(),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

    } catch (error: any) {
        console.error("Error in extract-invoices:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
