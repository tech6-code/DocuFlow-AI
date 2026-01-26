import * as gemini from "./geminiService";

export async function handleAiAction(action: string, payload: any) {
  switch (action) {
    case "extractTransactionsFromImage":
      return gemini.extractTransactionsFromImage(payload.imageParts, payload.startDate, payload.endDate);
    case "extractInvoicesData":
      return gemini.extractInvoicesData(payload.imageParts, payload.knowledgeBase, payload.companyName, payload.companyTrn);
    case "extractProjectDocuments":
      return gemini.extractProjectDocuments(payload.imageParts, payload.companyName, payload.companyTrn);
    case "analyzeTransactions":
      return gemini.analyzeTransactions(payload.transactions);
    case "categorizeTransactionsByCoA":
      return gemini.categorizeTransactionsByCoA(payload.transactions);
    case "generateTrialBalance":
      return gemini.generateTrialBalance(payload.transactions);
    case "extractEmiratesIdData":
      return gemini.extractEmiratesIdData(payload.imageParts);
    case "extractPassportData":
      return gemini.extractPassportData(payload.imageParts);
    case "extractVisaData":
      return gemini.extractVisaData(payload.imageParts);
    case "extractTradeLicenseData":
      return gemini.extractTradeLicenseData(payload.imageParts);
    case "extractDataFromImage":
      return gemini.extractDataFromImage(payload.parts, payload.documentType);
    case "extractLegalEntityDetails":
      return gemini.extractLegalEntityDetails(payload.imageParts);
    case "extractGenericDetailsFromDocuments":
      return gemini.extractGenericDetailsFromDocuments(payload.imageParts);
    case "extractVat201Totals":
      return gemini.extractVat201Totals(payload.imageParts);
    case "extractBusinessEntityDetails":
      return gemini.extractBusinessEntityDetails(payload.imageParts);
    case "extractTradeLicenseDetailsForCustomer":
      return gemini.extractTradeLicenseDetailsForCustomer(payload.imageParts);
    case "extractMoaDetails":
      return gemini.extractMoaDetails(payload.imageParts);
    case "extractVatCertificateData":
      return gemini.extractVatCertificateData(payload.imageParts);
    case "extractCorporateTaxCertificateData":
      return gemini.extractCorporateTaxCertificateData(payload.imageParts);
    case "extractOpeningBalanceData":
      return gemini.extractOpeningBalanceData(payload.imageParts);
    case "extractTrialBalanceData":
      return gemini.extractTrialBalanceData(payload.imageParts);
    case "extractAuditReportDetails":
      return gemini.extractAuditReportDetails(payload.imageParts);
    case "generateAuditReport":
      return gemini.generateAuditReport(payload.trialBalance, payload.companyName);
    case "generateLeadScore":
      return gemini.generateLeadScore(payload.leadData);
    case "generateSalesEmail":
      return gemini.generateSalesEmail(payload.context);
    case "analyzeDealProbability":
      return gemini.analyzeDealProbability(payload.deal);
    case "parseSmartNotes":
      return gemini.parseSmartNotes(payload.notes);
    case "parseLeadSmartNotes":
      return gemini.parseLeadSmartNotes(payload.notes);
    case "generateDealScore":
      return gemini.generateDealScore(payload.dealData);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
