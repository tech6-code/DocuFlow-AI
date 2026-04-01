import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const router = Router();

const mapFromDb = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  customerId: row.customer_id,
  ctTypeId: row.ct_type_id,
  periodFrom: row.period_from,
  periodTo: row.period_to,
  dueDate: row.due_date,
  status: row.status,
  createdAt: row.created_at
});

const mapToDb = (period: any) => ({
  user_id: period.userId,
  customer_id: period.customerId,
  ct_type_id: period.ctTypeId,
  period_from: period.periodFrom,
  period_to: period.periodTo,
  due_date: period.dueDate,
  status: period.status
});

const resolveCtTypeId = async (ctTypeId: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(ctTypeId)) {
    return ctTypeId;
  }

  // Otherwise, try to map from "1", "2", etc. to "CT Type 1", etc.
  const typeNum = ctTypeId.replace(/\D/g, "");
  if (!typeNum) return ctTypeId; // Fallback to original

  const targetName = `CT Type ${typeNum}`;
  const { data: ctType } = await supabaseAdmin
    .from("ct_types")
    .select("id")
    .ilike("name", targetName)
    .maybeSingle();

  return ctType?.id || ctTypeId;
};

// --- Date Formatting Helper ---
const formatDescriptiveDate = (dateStr: string) => {
  if (!dateStr) return "-";

  // Clean string if it contains extra text
  let cleanDate = dateStr.replace(/FOR THE PERIOD FROM|TO|for the period ended/gi, '').trim();
  // If it's still a range, pick the last part
  const parts = cleanDate.split(/\s+/).filter(p => p.match(/\d{4}-\d{2}-\d{2}/));
  if (parts.length > 0) cleanDate = parts[parts.length - 1];

  const date = new Date(cleanDate);
  if (isNaN(date.getTime())) return dateStr;

  const day = date.getDate();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  return `${day}${suffix} ${month} ${year}`;
};

const getStartAndEndDates = (period: string) => {
  if (!period) return { startDate: '', endDate: '' };

  const clean = period.replace(/For the period:|FOR THE PERIOD FROM/gi, '').trim();
  const dates = clean.split(/to/i).map(d => d.trim());

  return {
    startDate: dates[0] || '',
    endDate: dates[1] || dates[0] || ''
  };
};

const getYearLabelsFromPeriod = (period: string) => {
  const { endDate } = getStartAndEndDates(period || "");
  const parsedEndDate = endDate ? new Date(endDate) : null;
  const currentYear = parsedEndDate && !isNaN(parsedEndDate.getTime())
    ? parsedEndDate.getFullYear()
    : null;

  if (!currentYear) {
    return {
      currentYearLabel: "Current Year",
      previousYearLabel: "Previous Year"
    };
  }

  return {
    currentYearLabel: String(currentYear),
    previousYearLabel: String(currentYear - 1)
  };
};

const formatDateDdMmYyyy = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatMonthDayYear = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

const formatCoverEndDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr.toUpperCase();
  const dd = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const yyyy = date.getFullYear();
  return `${dd} ${month} ${yyyy}`;
};

const normalizeKey = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

const toNumberSafe = (value: any): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    if (Number.isFinite(value.currentYear)) return Number(value.currentYear);
    if (Number.isFinite(value.amount)) return Number(value.amount);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeFinalStepValue = (value: any): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    const rounded = Math.round(value);
    const formatted = Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 0 });
    return rounded < 0 ? `(${formatted})` : formatted;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const formatPdfAmount = (val: number) => {
  const rounded = Math.round(val);
  if (rounded === 0) return "-";
  const formatted = Math.abs(rounded).toLocaleString();
  if (rounded < 0) return `(${formatted})`;
  return formatted;
};

const PNL_EXPENSE_ITEM_IDS = new Set([
  "cost_of_revenue",
  "impairment_losses_ppe",
  "impairment_losses_intangible",
  "business_promotion_selling",
  "foreign_exchange_loss",
  "selling_distribution_expenses",
  "salaries_wages_charges",
  "administrative_expenses",
  "finance_costs",
  "depreciation_ppe",
  "provisions_corporate_tax"
]);

const formatPnlPdfAmount = (val: number, itemId?: string) => {
  const rounded = Math.round(val);
  if (rounded === 0) return "-";
  const formatted = Math.abs(rounded).toLocaleString();
  if (rounded < 0) return `(${formatted})`;
  if (itemId && PNL_EXPENSE_ITEM_IDS.has(itemId) && rounded > 0) return `(${formatted})`;
  return formatted;
};

const resolveFirstExistingPath = (candidates: Array<string | undefined>) => {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return "";
};

const resolveFinancialPdfFonts = () => {
  const winFonts = process.env.WINDIR ? path.join(process.env.WINDIR, "Fonts") : "C:\\Windows\\Fonts";
  const regular = resolveFirstExistingPath([
    process.env.ARIAL_UNICODE_MS_PATH,
    path.join(winFonts, "arialuni.ttf"),
    path.resolve(process.cwd(), "server", "assets", "fonts", "arialuni.ttf"),
    path.resolve(process.cwd(), "assets", "fonts", "arialuni.ttf")
  ]);
  if (!regular) return null;

  // Arial Unicode MS usually has only regular weight. Use Arial bold/italic files when available
  // so heading emphasis stays visible while keeping Unicode coverage for regular text.
  const bold = resolveFirstExistingPath([
    process.env.ARIAL_UNICODE_MS_BOLD_PATH,
    path.join(winFonts, "arialbd.ttf"),
    regular
  ]) || regular;
  const italic = resolveFirstExistingPath([
    process.env.ARIAL_UNICODE_MS_ITALIC_PATH,
    path.join(winFonts, "ariali.ttf"),
    regular
  ]) || regular;
  const boldItalic = resolveFirstExistingPath([
    process.env.ARIAL_UNICODE_MS_BOLDITALIC_PATH,
    path.join(winFonts, "arialbi.ttf"),
    bold,
    italic,
    regular
  ]) || bold || regular;

  return { regular, bold, italic, boldItalic };
};

const formatWorkingNoteAmount = (val: number, negativeAsBrackets = false) => {
  const rounded = Math.round(val);
  if (rounded === 0) return "-";
  const formatted = Math.abs(rounded).toLocaleString();
  if (negativeAsBrackets && rounded < 0) return `(${formatted})`;
  return formatted;
};

const DEFAULT_BS_STRUCTURE = [
  { id: 'assets_header',                      label: 'Assets',                                          type: 'header' },
  { id: 'non_current_assets_header',          label: 'Non-current assets',                              type: 'subheader' },
  { id: 'property_plant_equipment',           label: 'Property, plant and equipment',                   type: 'item' },
  { id: 'intangible_assets',                  label: 'Intangible assets',                               type: 'item' },
  { id: 'long_term_investments',              label: 'Long-term investments',                           type: 'item' },
  { id: 'other_non_current_assets',           label: 'Other non-current assets',                        type: 'item' },
  { id: 'total_non_current_assets',           label: 'Total non current assets',                        type: 'total' },
  { id: 'current_assets_header',             label: 'Current assets',                                  type: 'subheader' },
  { id: 'cash_bank_balances',                 label: 'Cash and bank balances',                          type: 'item' },
  { id: 'inventories',                        label: 'Inventories',                                     type: 'item' },
  { id: 'trade_receivables',                  label: 'Trade receivables',                               type: 'item' },
  { id: 'advances_deposits_receivables',      label: 'Advances, deposits and other receivables',        type: 'item' },
  { id: 'related_party_transactions_assets',  label: 'Related party transactions',                      type: 'item' },
  { id: 'total_current_assets',               label: 'Total current assets',                            type: 'total' },
  { id: 'total_assets',                       label: 'Total assets',                                    type: 'grand_total' },
  { id: 'equity_liabilities_header',          label: 'Equity and liabilities',                          type: 'header' },
  { id: 'equity_header',                      label: 'Equity',                                          type: 'subheader' },
  { id: 'share_capital',                      label: 'Share capital',                                   type: 'item' },
  { id: 'statutory_reserve',                  label: 'Statutory reserve',                               type: 'item' },
  { id: 'retained_earnings',                  label: 'Retained earnings',                               type: 'item' },
  { id: 'shareholders_current_accounts',      label: "Shareholders' current accounts",                  type: 'item' },
  { id: 'total_equity',                       label: 'Total equity',                                    type: 'total' },
  { id: 'non_current_liabilities_header',     label: 'Non-current liabilities',                         type: 'subheader' },
  { id: 'employees_end_service_benefits',     label: "Employees' end of service benefits",              type: 'item' },
  { id: 'bank_borrowings_non_current',        label: 'Bank borrowings - non current portion',           type: 'item' },
  { id: 'total_non_current_liabilities',      label: 'Total non-current liabilities',                   type: 'total' },
  { id: 'current_liabilities_header',         label: 'Current liabilities',                             type: 'subheader' },
  { id: 'short_term_borrowings',              label: 'Short term borrowings',                           type: 'item' },
  { id: 'related_party_transactions_liabilities', label: 'Related party transactions',                  type: 'item' },
  { id: 'trade_other_payables',               label: 'Trade and other payables',                        type: 'item' },
  { id: 'total_current_liabilities',          label: 'Total current liabilities',                       type: 'total' },
  { id: 'total_liabilities',                  label: 'Total liabilities',                               type: 'total' },
  { id: 'total_equity_liabilities',           label: 'Total equity and liabilities',                    type: 'grand_total' },
];

// Merges incoming bsStructure with the default so all standard items always appear in the PDF.
// Custom accounts added by the user are preserved at their original position.
const normalizeBsStructureForPdf = (incoming: any[]): any[] => {
  const incomingArr = Array.isArray(incoming) ? incoming : [];
  const defaultIds = new Set(DEFAULT_BS_STRUCTURE.map((i) => i.id));

  // Build base from default, overriding label with incoming where available
  const result: any[] = DEFAULT_BS_STRUCTURE.map((def) => {
    const match = incomingArr.find((i: any) => i?.id === def.id);
    return match ? { ...def, ...match } : { ...def };
  });

  // Append any custom items (not in default) in their original relative order
  const customItems = incomingArr.filter((i: any) => i?.id && !defaultIds.has(i.id));
  customItems.forEach((customItem: any) => {
    const incomingIdx = incomingArr.findIndex((i: any) => i?.id === customItem.id);
    // Find the next default-known item that follows this custom item in the incoming array
    let insertBeforeId: string | null = null;
    for (let j = incomingIdx + 1; j < incomingArr.length; j++) {
      if (defaultIds.has(incomingArr[j]?.id)) {
        insertBeforeId = incomingArr[j].id;
        break;
      }
    }
    if (insertBeforeId) {
      const insertIdx = result.findIndex((i) => i.id === insertBeforeId);
      if (insertIdx >= 0) { result.splice(insertIdx, 0, customItem); return; }
    }
    result.push(customItem);
  });

  return result;
};

const normalizePnlPdfStructure = (rows: any[]): any[] => {
  const structure = Array.isArray(rows) ? [...rows] : [];
  const labelOverrides: Record<string, string> = {
    operating_profit: "Profit/(Loss) from Operating Activities",
    profit_loss_year: "Net Profit/(Loss) for the year",
    other_income: "Other income"
  };

  const PDF_EXCLUDED_PNL_IDS = new Set(['items_may_reclassified']);

  const deduped: any[] = [];
  const seen = new Set<string>();
  structure.forEach((row) => {
    const id = String(row?.id || "");
    if (!id || seen.has(id) || PDF_EXCLUDED_PNL_IDS.has(id)) return;
    seen.add(id);
    deduped.push({
      ...row,
      label: labelOverrides[id] || row?.label
    });
  });

  // Always ensure revenue, cost_of_revenue, gross_profit appear at the top
  const ALWAYS_FIRST_ITEMS: any[] = [
    { id: 'revenue', label: 'Revenue', type: 'item' },
    { id: 'cost_of_revenue', label: 'Cost of revenue', type: 'item' },
    { id: 'gross_profit', label: 'Gross profit', type: 'total' },
  ];
  const alwaysFirstIds = new Set(ALWAYS_FIRST_ITEMS.map((r) => r.id));
  const withoutAlwaysFirst = deduped.filter((r) => !alwaysFirstIds.has(r?.id));
  const alwaysFirstRows = ALWAYS_FIRST_ITEMS.map((template) => {
    const existing = deduped.find((r) => r?.id === template.id);
    return existing || template;
  });
  const result = [...alwaysFirstRows, ...withoutAlwaysFirst];

  const otherIdx = result.findIndex((r) => r?.id === "other_income");
  const profitIdx = result.findIndex((r) => r?.id === "profit_loss_year");

  if (otherIdx >= 0 && profitIdx >= 0) {
    const [otherRow] = result.splice(otherIdx, 1);
    const updatedOperatingIdx = result.findIndex((r) => r?.id === "operating_profit");
    const updatedProfitIdx = result.findIndex((r) => r?.id === "profit_loss_year");
    const insertAt = updatedOperatingIdx >= 0 ? updatedOperatingIdx + 1 : updatedProfitIdx;
    result.splice(insertAt, 0, otherRow);
  }

  return result;
};

const extractFinalStepPeriodFromSections = (sections: any[]): string | null => {
  if (!Array.isArray(sections)) return null;

  let periodFrom = "";
  let periodTo = "";
  let taxPeriodDescription = "";

  for (const section of sections) {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    for (const row of rows) {
      if (row?.type === "header") continue;
      const label = String(row?.label || "").trim().toLowerCase();
      const value = row?.value;
      if (value === null || value === undefined || value === "") continue;

      if (label === "period from") periodFrom = String(value).trim();
      if (label === "period to") periodTo = String(value).trim();
      if (label === "tax period description") taxPeriodDescription = String(value).trim();
    }
  }

  if (periodFrom || periodTo) {
    return `FOR THE PERIOD FROM ${periodFrom || "-"} TO ${periodTo || "-"}`;
  }

  if (taxPeriodDescription) {
    return taxPeriodDescription;
  }

  return null;
};

router.get("/types", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("ct_types").select("*");
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

router.get("/filing-periods", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { customerId, ctTypeId: rawCtTypeId } = req.query as { customerId?: string; ctTypeId?: string };
  if (!customerId || !rawCtTypeId) {
    return res.status(400).json({ message: "customerId and ctTypeId are required" });
  }

  const ctTypeId = await resolveCtTypeId(rawCtTypeId);

  const { data, error } = await supabaseAdmin
    .from("ct_filing_period")
    .select("*")
    .eq("customer_id", customerId)
    .eq("ct_type_id", ctTypeId)
    .order("period_from", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapFromDb));
});

router.post("/filing-periods", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const period = req.body || {};
  const { data, error } = await supabaseAdmin
    .from("ct_filing_period")
    .insert([mapToDb(period)])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(mapFromDb(data));
});

router.get("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("ct_filing_period")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapFromDb(data));
});

router.put("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const dbPayload: any = {};
  if (updates.periodFrom) dbPayload.period_from = updates.periodFrom;
  if (updates.periodTo) dbPayload.period_to = updates.periodTo;
  if (updates.dueDate) dbPayload.due_date = updates.dueDate;
  if (updates.status) dbPayload.status = updates.status;

  const { data, error } = await supabaseAdmin
    .from("ct_filing_period")
    .update(dbPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapFromDb(data));
});

router.delete("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("ct_filing_period").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.post("/download-pdf", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const {
    companyName,
    period,
    pnlStructure,
    pnlValues,
    bsStructure,
    bsValues,
    location,
    customerId,
    pnlWorkingNotes,
    bsWorkingNotes,
    authorizedSignatoryName,
    taxComputationRows,
    taxApplicable,
    sbrClaimed,
    fixedAssetData
  } = req.body;

  try {
    let normalizedPnlStructure = normalizePnlPdfStructure(pnlStructure || []);

    let customerCountry = "";
    if (customerId) {
      const { data: customerRow } = await supabaseAdmin
        .from("customers")
        .select("country")
        .eq("id", customerId)
        .maybeSingle();
      customerCountry = String(customerRow?.country || "").trim();
    }

    const resolvedLocation = customerCountry
      ? (/uae/i.test(customerCountry) ? customerCountry : `${customerCountry}, UAE`)
      : (location || "DUBAI, UAE");

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const financialPdfFonts = resolveFinancialPdfFonts();
    const hasCustomPdfFonts = Boolean(financialPdfFonts);
    if (hasCustomPdfFonts && financialPdfFonts) {
      doc.registerFont("ArialUnicodeMS", financialPdfFonts.regular);
      doc.registerFont("ArialUnicodeMS-Bold", financialPdfFonts.bold);
      doc.registerFont("ArialUnicodeMS-Oblique", financialPdfFonts.italic);
      doc.registerFont("ArialUnicodeMS-BoldOblique", financialPdfFonts.boldItalic);
    }
    const taxPdfFont = hasCustomPdfFonts ? "ArialUnicodeMS" : "Helvetica";
    const taxPdfFontBold = hasCustomPdfFonts ? "ArialUnicodeMS-Bold" : "Helvetica-Bold";
    const taxPdfFontItalic = hasCustomPdfFonts ? "ArialUnicodeMS-Oblique" : "Helvetica-Oblique";
    const taxPdfFontSize = 10;

    // Enforce a consistent font family across the full financial statements PDF.
    if (hasCustomPdfFonts) {
      const originalFont = (doc.font as any).bind(doc);
      (doc as any).font = ((name?: string, ...args: any[]) => {
        const key = String(name || "").toLowerCase();
        if (key.includes("bold") && key.includes("oblique")) return originalFont("ArialUnicodeMS-BoldOblique", ...args);
        if (key.includes("bold")) return originalFont("ArialUnicodeMS-Bold", ...args);
        if (key.includes("oblique")) return originalFont("ArialUnicodeMS-Oblique", ...args);
        return originalFont("ArialUnicodeMS", ...args);
      }) as any;
    }

    // Set response headers
    const filename = `${(companyName || 'Financial_Report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    doc.pipe(res);

    // Section Page Trackers
    let indexPageNum = 0;
    let directorsPageNum = 0;
    let taxCompPageNum = 0;
    let taxCompEndPageNum = 0;
    let pnlPageNum = 0;
    let bsPageNum = 0;
    let bsEndPageNum = 0;
    let equityPageNum = 0;
    let equityEndPageNum = 0;
    let bsNotesPageNum = 0;
    let bsNotesEndPageNum = 0;
    let pnlNotesPageNum = 0;
    let pnlEndPageNum = 0;
    let pnlNotesEndPageNum = 0;
    let fixedAssetsEndPageNum = 0;

    const pageWidth = doc.page.width;
    const centerWidth = pageWidth - 100; // Total width minus margins (50 each side)

    // Helper for Borders
    const drawBorder = () => {
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor('#000000').stroke();
    };

    // Helper: sentence case for location (e.g. "Abu Dhabi, UAE")
    const toSentenceCase = (str: string) => {
      return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
        .replace(/\bUae\b/gi, 'UAE').replace(/\bLlc\b/gi, 'LLC').replace(/\bFz\b/gi, 'FZ')
        .replace(/\bFz-llc\b/gi, 'FZ-LLC').replace(/\bFzc\b/gi, 'FZC').replace(/\bFze\b/gi, 'FZE');
    };

    // Helper: title case for report names
    const toTitleCase = (str: string) => {
      const minorWords = new Set(['of', 'in', 'the', 'and', 'for', 'to', 'at', 'as', 'a', 'an', 'by', 'on']);
      return str.split(' ').map((word, idx) => {
        if (idx > 0 && minorWords.has(word.toLowerCase())) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
      }).join(' ');
    };

    // Shared page header — consistent formatting across all statement pages
    // Company Name: 12pt Bold uppercase | Address: 11pt Bold sentence case
    // Report Name: 11pt Bold title case underlined | Currency: 10pt Italics
    // Horizontal line below header
    const drawStandardPageHeader = (reportName: string, dateText: string, opts?: { continued?: boolean; leftMargin?: number }) => {
      const lm = opts?.leftMargin ?? 50;
      const rightEdge = doc.page.width - lm;
      drawBorder();
      doc.fillColor('#000000');

      // Company Name — 12pt Bold uppercase
      doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), lm, 50);

      // Company Address — 11pt Bold sentence case
      doc.fontSize(11).font('Helvetica-Bold').text(toSentenceCase(resolvedLocation), lm, doc.y + 2);

      // Report Name — 11pt Bold title case underlined (include date text)
      const fullReportName = opts?.continued ? `${reportName} (Continued)` : reportName;
      const reportLine = dateText ? `${fullReportName} ${dateText}` : fullReportName;
      doc.fontSize(11).font('Helvetica-Bold').text(reportLine, lm, doc.y + 2, { underline: true });

      // Currency — 10pt Italics
      doc.fontSize(10).font('Helvetica-Oblique').text('(In United Arab Emirates Dirhams)', lm, doc.y + 2);

      // Horizontal line below header
      const lineY = doc.y + 8;
      doc.moveTo(lm, lineY).lineTo(rightEdge, lineY).lineWidth(1).strokeColor('#000000').stroke();

      return lineY + 12;
    };

    const drawAuthorizedSignatoryFooter = () => {
      // Keep footer comfortably above bottom so spacing tweaks never spill text to a new page.
      const footerLineY = doc.page.height - 120;
      const footerLabelY = footerLineY + 16;
      const normalizedSignatoryName = String(authorizedSignatoryName || "").trim();
      const nameY = footerLabelY + 18;
      const footerCompanyY = normalizedSignatoryName ? nameY + 18 : footerLabelY + 20;

      // Shorter signatory line (not full width)
      const sigLineEnd = 250;
      doc.moveTo(50, footerLineY).lineTo(sigLineEnd, footerLineY).lineWidth(1).strokeColor('#000000').stroke();
      doc.fillColor('#000000').font('Helvetica').fontSize(10).text('Authorized Signatory', 55, footerLabelY, {
        lineBreak: false
      });
      if (normalizedSignatoryName) {
        doc.fillColor('#000000').font('Helvetica').fontSize(10).text(normalizedSignatoryName, 55, nameY, {
          width: doc.page.width - 110,
          lineBreak: false
        });
      }
      doc.fillColor('#000000').font('Helvetica').fontSize(10).text((companyName || '-').toUpperCase(), 55, footerCompanyY, {
        width: doc.page.width - 110,
        lineBreak: false
      });
    };

    // Page content limits:
    // - Regular pages can use more vertical space.
    // - Section-ending pages reserve room for signatory + page number.
    const contentBottomRegularY = doc.page.height - 70;
    const contentBottomWithFooterY = doc.page.height - 140;

    // --- PAGE 1: COVER PAGE ---
    drawBorder();
    doc.fillColor('#000000');

    // Period display — show exact date range when both start and end are available
    let periodText = 'FOR THE PERIOD';
    if (period) {
      const { startDate: coverStart, endDate: coverEnd } = getStartAndEndDates(period);
      const pStart = coverStart ? new Date(coverStart) : null;
      const pEnd = coverEnd ? new Date(coverEnd) : null;
      if (pStart && !isNaN(pStart.getTime()) && pEnd && !isNaN(pEnd.getTime())) {
        // Check if it's a standard calendar year (Jan 1 - Dec 31)
        const isCalendarYear = pStart.getMonth() === 0 && pStart.getDate() === 1
          && pEnd.getMonth() === 11 && (pEnd.getDate() === 31)
          && pStart.getFullYear() === pEnd.getFullYear();
        if (isCalendarYear) {
          periodText = `FOR THE YEAR ENDED ${formatCoverEndDate(coverEnd)}`;
        } else {
          periodText = `FOR THE PERIOD ${formatCoverEndDate(coverStart)} TO ${formatCoverEndDate(coverEnd)}`;
        }
      } else if (pEnd && !isNaN(pEnd.getTime())) {
        periodText = `FOR THE YEAR ENDED ${formatCoverEndDate(coverEnd)}`;
      } else if (pStart && !isNaN(pStart.getTime())) {
        periodText = `FOR THE YEAR ENDED ${formatCoverEndDate(coverStart)}`;
      } else {
        periodText = period.toUpperCase();
      }
    }
    const coverCompany = (companyName || 'COMPANY NAME').toUpperCase();
    const coverLocation = resolvedLocation.toUpperCase();
    const coverTitle = 'FINANCIAL STATEMENTS';
    const coverPeriod = periodText;

    // Center all cover content as one grouped block (horizontally + vertically).
    doc.fontSize(16).font('Helvetica-Bold');
    const companyH = doc.heightOfString(coverCompany, { width: centerWidth, align: 'center' });
    doc.fontSize(13).font('Helvetica-Bold');
    const locationH = doc.heightOfString(coverLocation, { width: centerWidth, align: 'center' });
    doc.fontSize(18).font('Helvetica-Bold');
    const titleH = doc.heightOfString(coverTitle, { width: centerWidth, align: 'center' });
    const titleUnderlineGap = 6;
    doc.fontSize(12).font('Helvetica-Bold');
    const periodH = doc.heightOfString(coverPeriod, { width: centerWidth, align: 'center' });

    const companyToLocationGap = 8;
    const blockGap = 90;
    const titleToPeriodGap = 16;
    const totalCoverBlockH =
      companyH + companyToLocationGap + locationH + blockGap + titleH + titleUnderlineGap + titleToPeriodGap + periodH;
    let coverY = (doc.page.height - totalCoverBlockH) / 2;

    // Company Name — 16pt Bold All Caps Centered
    doc.fontSize(16).font('Helvetica-Bold').text(coverCompany, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += companyH + companyToLocationGap;
    doc.fontSize(13).font('Helvetica-Bold').text(coverLocation, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += locationH + blockGap;

    // Document Title — 18pt Bold Centered with thick underline
    doc.fontSize(18).font('Helvetica-Bold').text(coverTitle, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += titleH;
    // Thick underline below title
    const titleTextWidth = doc.widthOfString(coverTitle);
    const titleUnderlineX = 50 + (centerWidth - titleTextWidth) / 2;
    doc.moveTo(titleUnderlineX, coverY + 2).lineTo(titleUnderlineX + titleTextWidth, coverY + 2).lineWidth(2).strokeColor('#000000').stroke();
    coverY += titleUnderlineGap + titleToPeriodGap;

    // Reporting Period — 12pt Bold All Caps Centered
    doc.fontSize(12).font('Helvetica-Bold').text(coverPeriod, 50, coverY, { width: centerWidth, align: 'center' });

    // --- PAGE 2: INDEX PAGE ---
    doc.addPage();
    indexPageNum = doc.bufferedPageRange().count;
    drawBorder();

    doc.fillColor('#000000');
    // Company Name — 12pt Bold uppercase
    doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 50);
    // Address — 11pt Bold sentence case
    doc.fontSize(11).font('Helvetica-Bold').text(toSentenceCase(resolvedLocation), 50, doc.y + 2);
    // Report Name — 11pt Bold title case underlined
    doc.fontSize(11).font('Helvetica-Bold').text('Financial Statements', 50, doc.y + 2, { underline: true });
    // Currency — 10pt Italics
    doc.fontSize(10).font('Helvetica-Oblique').text('(In United Arab Emirates Dirhams)', 50, doc.y + 2);

    const { startDate, endDate } = getStartAndEndDates(period || '');
    const { currentYearLabel, previousYearLabel } = getYearLabelsFromPeriod(period || "");
    const descriptiveEndDate = formatDescriptiveDate(endDate);
    const descriptiveStartDate = formatDescriptiveDate(startDate);
    const periodStartForDirectorReport = formatDateDdMmYyyy(startDate);
    const periodEndForDirectorReport = formatDateDdMmYyyy(endDate || startDate);
    const asAtDateForDirectorReport = formatMonthDayYear(endDate || startDate);
    const valueByNormalizedLabel: Record<string, number> = {};
    normalizedPnlStructure.forEach((item: any) => {
      if (!item || !item.id) return;
      const value = toNumberSafe(pnlValues?.[item.id]);
      if (!Number.isFinite(value)) return;
      valueByNormalizedLabel[normalizeKey(item.id)] = value;
      if (item.label) valueByNormalizedLabel[normalizeKey(item.label)] = value;
    });
    Object.entries(pnlValues || {}).forEach(([key, rawValue]) => {
      valueByNormalizedLabel[normalizeKey(key)] = toNumberSafe(rawValue);
    });

    const pickFirst = (keys: string[]) => {
      for (const key of keys) {
        const normalized = normalizeKey(key);
        const value = valueByNormalizedLabel[normalized];
        if (Number.isFinite(value)) return value;
      }
      return 0;
    };

    const costOfRevenueForDirectorReport = pickFirst([
      "cost_of_revenue",
      "cost of revenue",
      "costofrevenue",
      "cogs",
      "cost of goods sold",
      "costofgoodssold",
      "directservicecosts",
      "directcost"
    ]);
    let revenueForDirectorReport = pickFirst([
      "revenue",
      "sales revenue",
      "sales",
      "service revenue",
      "total revenue",
      "salesrevenuegoods",
      "servicerevenue",
      "operatingincome",
      "turnover"
    ]);
    const otherIncomeForDirectorReport = pickFirst([
      "other_income",
      "other income",
      "other operating income",
      "miscellaneous income",
      "interest income",
      "dividends received"
    ]) || 0;
    const grossProfitForDirectorReport = pickFirst([
      "gross_profit",
      "gross profit",
      "gross profit/(loss)",
      "gross profit/(loss) for the year"
    ]);
    const netProfitForDirectorReport = pickFirst([
      "profit_after_tax",
      "profit after tax",
      "profit_loss_year",
      "profit /(loss) for the year",
      "profit/(loss) for the year",
      "net profit",
      "net profit/(loss) for the year"
    ]);

    if (Math.abs(revenueForDirectorReport) < 0.0001 && Math.abs(grossProfitForDirectorReport) > 0.0001) {
      const derivedRevenue =
        costOfRevenueForDirectorReport < 0
          ? grossProfitForDirectorReport - costOfRevenueForDirectorReport
          : grossProfitForDirectorReport + costOfRevenueForDirectorReport;
      revenueForDirectorReport = derivedRevenue;
    }

    const revenuePlusOtherIncomeForDirectorReport = revenueForDirectorReport + otherIncomeForDirectorReport;
    const rawGrossProfitMarginPct = revenueForDirectorReport !== 0 ? (grossProfitForDirectorReport / revenueForDirectorReport) * 100 : 0;
    const rawNetProfitMarginPct = revenuePlusOtherIncomeForDirectorReport !== 0
      ? (netProfitForDirectorReport / revenuePlusOtherIncomeForDirectorReport) * 100
      : 0;
    const grossProfitMarginPct = Math.max(0, rawGrossProfitMarginPct);
    const netProfitMarginPct = Math.max(0, rawNetProfitMarginPct);
    const formatPercent = (value: number) => {
      if (!Number.isFinite(value)) return "0%";
      const abs = Math.abs(value);
      if (abs >= 1) return `${Math.round(value)}%`;
      return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
    };
    const normalizeTaxRows = Array.isArray(taxComputationRows)
      ? taxComputationRows
        .map((row: any) => ({
          label: String(row?.label || "").trim(),
          value: Number(row?.value) || 0
        }))
        .filter((row: { label: string; value: number }) => row.label.length > 0)
      : [];
    const findTaxRowValue = (rowNo: number, labelKeyword: string) => {
      const byNumber = normalizeTaxRows.find((row) => {
        const match = row.label.match(/^\s*(\d+)\./);
        return match ? Number(match[1]) === rowNo : false;
      });
      if (byNumber) return Number(byNumber.value) || 0;
      const byLabel = normalizeTaxRows.find((row) =>
        row.label.toLowerCase().includes(labelKeyword.toLowerCase())
      );
      return byLabel ? Number(byLabel.value) || 0 : 0;
    };
    const corporateTaxLiabilityValue = findTaxRowValue(24, "corporate tax liability");
    const corporateTaxPayableValue = findTaxRowValue(26, "corporate tax payable");
    // Business rule:
    // - SBR claimed => do not show tax computation page
    // - taxApplicable=false => do not show tax computation page
    // - Otherwise show only when row 24 or 26 has a value
    const isSbrClaimed = String(sbrClaimed || "").toLowerCase() === "true" || sbrClaimed === true;
    const isTaxApplicable =
      taxApplicable === undefined || taxApplicable === null
        ? true
        : (String(taxApplicable).toLowerCase() === "true" || taxApplicable === true);
    const shouldRenderTaxComputationPage =
      !isSbrClaimed &&
      isTaxApplicable &&
      normalizeTaxRows.length > 0 &&
      (Math.abs(corporateTaxLiabilityValue) > 0 || Math.abs(corporateTaxPayableValue) > 0);
    const hasMeaningfulAmount = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) && Math.abs(num) > 0;
    };

    // P&L items that must always appear regardless of whether they have a value
    const MANDATORY_PNL_IDS = new Set([
      'revenue', 'cost_of_revenue', 'gross_profit',
      'operating_profit', 'profit_loss_year',
      'other_comprehensive_income', 'total_comprehensive_income',
      'profit_after_tax'
    ]);

    const pnlItemHasValue = (id: string) => {
      const vals = pnlValues?.[id];
      const cur = typeof vals === 'object' ? vals?.currentYear : vals;
      const prev = typeof vals === 'object' ? vals?.previousYear : 0;
      return hasMeaningfulAmount(cur) || hasMeaningfulAmount(prev);
    };

    // Filter P&L structure: mandatory IDs + totals/headers always shown;
    // regular items only shown when they have a value.
    // subsection_headers only shown when at least one of their child items survives.
    const pnlFiltered = normalizedPnlStructure.filter((item: any) => {
      const id = item?.id;
      const type = item?.type;
      if (MANDATORY_PNL_IDS.has(id)) return true;
      if (type === 'total' || type === 'header') return true;
      if (type === 'item') return pnlItemHasValue(id);
      return true; // subsection_headers: evaluated in next pass
    });
    // Remove subsection_headers whose child items were all filtered out
    normalizedPnlStructure = pnlFiltered.filter((item: any, idx: number) => {
      if (item?.type !== 'subsection_header') return true;
      for (let j = idx + 1; j < pnlFiltered.length; j++) {
        const next = pnlFiltered[j];
        if (next.type !== 'item') break;
        if (pnlItemHasValue(next.id)) return true;
      }
      return false;
    });
    const hasYearDataInValues = (valuesObj: Record<string, any>, yearKey: "currentYear" | "previousYear") =>
      Object.values(valuesObj || {}).some((val: any) => hasMeaningfulAmount(val?.[yearKey]));
    const hasYearDataInNotes = (notesObj: Record<string, any[]>, yearKey: "current" | "previous") =>
      Object.values(notesObj || {}).some((notes: any) =>
        Array.isArray(notes) &&
        notes.some((note: any) => {
          if (yearKey === "current") return hasMeaningfulAmount(note?.currentYearAmount ?? note?.amount ?? 0);
          return hasMeaningfulAmount(note?.previousYearAmount ?? 0);
        })
      );

    let showCurrentYearColumn =
      hasYearDataInValues(bsValues || {}, "currentYear") ||
      hasYearDataInValues(pnlValues || {}, "currentYear") ||
      hasYearDataInNotes(bsWorkingNotes || {}, "current") ||
      hasYearDataInNotes(pnlWorkingNotes || {}, "current");

    let showPreviousYearColumn =
      hasYearDataInValues(bsValues || {}, "previousYear") ||
      hasYearDataInValues(pnlValues || {}, "previousYear") ||
      hasYearDataInNotes(bsWorkingNotes || {}, "previous") ||
      hasYearDataInNotes(pnlWorkingNotes || {}, "previous");

    if (!showCurrentYearColumn && !showPreviousYearColumn) {
      showCurrentYearColumn = true;
    }

    const yearColumns = [
      showCurrentYearColumn ? { key: "current", label: currentYearLabel, x: 350, width: 100 } : null,
      showPreviousYearColumn ? { key: "previous", label: previousYearLabel, x: 460, width: 100 } : null
    ].filter(Boolean) as { key: "current" | "previous"; label: string; x: number; width: number }[];
    const yearColumnsRightEdge = yearColumns.length
      ? Math.max(...yearColumns.map((col) => col.x + col.width))
      : (doc.page.width - 50);
    const drawYearAmountLine = (y: number, width = 1) => {
      yearColumns.forEach((col) => {
        const startX = col.x + 2;
        const endX = col.x + col.width - 2;
        doc.moveTo(startX, y).lineTo(endX, y).lineWidth(width).strokeColor('#000000').stroke();
      });
    };

    const notesYearColumns = [
      showCurrentYearColumn ? { key: "current", label: currentYearLabel, x: 350, width: 90 } : null,
      showPreviousYearColumn ? { key: "previous", label: previousYearLabel, x: 450, width: 90 } : null
    ].filter(Boolean) as { key: "current" | "previous"; label: string; x: number; width: number }[];
    const notesYearColumnsRightEdge = notesYearColumns.length
      ? Math.max(...notesYearColumns.map((col) => col.x + col.width))
      : (doc.page.width - 50);
    const bsDisplayStructure = normalizeBsStructureForPdf(bsStructure || []).filter((item: any) => {
      // Headers, subheaders, totals and grand totals are always mandatory
      if (item?.type !== 'item') return true;
      // Line items only appear when they have a value in either year
      const vals = bsValues?.[item.id] || { currentYear: 0, previousYear: 0 };
      return hasMeaningfulAmount(vals.currentYear) || hasMeaningfulAmount(vals.previousYear);
    });

    // --- Build Note Number Map ---
    // Assign sequential note numbers to accounts that have working notes.
    // BS notes come first (assets, then equity & liabilities), then P&L notes.
    // PPE (property_plant_equipment) gets a number if it has a fixed asset schedule.
    // depreciation_ppe in P&L is covered by the PPE schedule, so it shares the PPE note number.
    const noteNumberMap = new Map<string, string>();
    let noteCounter = 1;

    // BS accounts — iterate in display structure order (assets first, then equity & liabilities)
    const safeBsWorkingNotes = bsWorkingNotes || {};
    const safePnlWorkingNotes = pnlWorkingNotes || {};

    for (const item of bsDisplayStructure) {
      if (item.type !== 'item') continue;
      const hasNotes = Array.isArray(safeBsWorkingNotes[item.id]) && safeBsWorkingNotes[item.id].some(
        (n: any) => hasMeaningfulAmount(n?.currentYearAmount ?? n?.amount ?? 0) || hasMeaningfulAmount(n?.previousYearAmount ?? 0)
      );
      const hasPpe = item.id === 'property_plant_equipment' && hasMeaningfulAmount((bsValues as any)?.property_plant_equipment?.currentYear);
      if (hasNotes || hasPpe) {
        noteNumberMap.set(item.id, String(noteCounter));
        noteCounter++;
      }
    }

    // P&L accounts — iterate in normalized structure order
    for (const item of normalizedPnlStructure) {
      if (item.type !== 'item') continue;
      // depreciation_ppe shares the PPE note number from BS
      if (item.id === 'depreciation_ppe' && noteNumberMap.has('property_plant_equipment')) {
        noteNumberMap.set(item.id, noteNumberMap.get('property_plant_equipment')!);
        continue;
      }
      const hasNotes = Array.isArray(safePnlWorkingNotes[item.id]) && safePnlWorkingNotes[item.id].some(
        (n: any) => hasMeaningfulAmount(n?.currentYearAmount ?? n?.amount ?? 0) || hasMeaningfulAmount(n?.previousYearAmount ?? 0)
      );
      if (hasNotes) {
        noteNumberMap.set(item.id, String(noteCounter));
        noteCounter++;
      }
    }

    doc.fontSize(11).font('Helvetica-Bold').text(`as at ${descriptiveEndDate}`, 50, doc.y + 2);
    // Horizontal line below header
    const indexHeaderLineY = doc.y + 8;
    doc.moveTo(50, indexHeaderLineY).lineTo(doc.page.width - 50, indexHeaderLineY).lineWidth(1).strokeColor('#000000').stroke();

    doc.moveDown(4);
    doc.fontSize(14).font('Helvetica-Bold').text('TABLE OF CONTENTS', 50, doc.y, { width: centerWidth, align: 'center' });
    doc.moveDown(3);

    const tocY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold').text('Contents', 50, tocY);
    doc.text('Pages', 450, tocY, { width: 90, align: 'right' });
    doc.moveTo(50, tocY + 15).lineTo(doc.page.width - 50, tocY + 15).lineWidth(1).strokeColor('#000000').stroke();

    const tocItemsY = tocY + 40;

    // NO TOC CONTENT HERE - Rendered once at the end to avoid overlap

    // --- PAGE 3: DIRECTOR'S REPORT ---
    doc.addPage();
    directorsPageNum = doc.bufferedPageRange().count;
    const directorsContentY = drawStandardPageHeader("Director's Report", `as at ${descriptiveEndDate}`);

    let directorsY = directorsContentY + 8;
    doc.fontSize(11).font('Helvetica').fillColor('#000000').text(`The Directors present their financial statements For the period from ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`, 50, directorsY, {
      width: 490
    });

    const metricsStartY = directorsY + 38;

    // ── Metrics table — centered on page ─────────────────────────────────
    const mTblW = 420;
    const mTblX = (doc.page.width - mTblW) / 2;
    const mDescW = 270;
    const mValW = mTblW - mDescW;
    const mRowH = 22;
    const mHeaderH = 22;
    const mRows = [
      { label: 'Revenue', value: formatPdfAmount(revenueForDirectorReport), isSectionEnd: true },
      { label: 'Gross Profit / (Loss) for the year', value: formatPdfAmount(grossProfitForDirectorReport), isSectionEnd: true },
      { label: 'Net Profit / (Loss) for the year', value: formatPdfAmount(netProfitForDirectorReport), isSectionEnd: false },
      { label: 'Gross Profit Margin', value: formatPercent(grossProfitMarginPct), isSectionEnd: false },
      { label: 'Net Profit Margin', value: formatPercent(netProfitMarginPct), isSectionEnd: false },
    ];
    const mPad = 6;

    // Gray header row
    doc.rect(mTblX, metricsStartY, mTblW, mHeaderH).fill('#e8e8e8');
    doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');
    doc.text('Description', mTblX + mPad, metricsStartY + 6, { width: mDescW - mPad, lineBreak: false });
    doc.text(asAtDateForDirectorReport, mTblX + mDescW + mPad, metricsStartY + 6,
      { width: mValW - mPad * 2, align: 'right', lineBreak: false });
    // Header bottom line
    doc.moveTo(mTblX, metricsStartY + mHeaderH)
      .lineTo(mTblX + mTblW, metricsStartY + mHeaderH)
      .lineWidth(0.75).strokeColor('#000000').stroke();

    // Data rows
    mRows.forEach((row, i) => {
      const ry = metricsStartY + mHeaderH + i * mRowH;
      // Alternating very light stripe
      if (i % 2 === 0) doc.rect(mTblX, ry, mTblW, mRowH).fill('#f7f7f7');
      doc.fillColor('#000000').fontSize(11).font('Helvetica');
      doc.text(row.label, mTblX + mPad, ry + 6, { width: mDescW - mPad, lineBreak: false });
      doc.font('Helvetica-Bold');
      doc.text(row.value, mTblX + mDescW + mPad, ry + 6,
        { width: mValW - mPad * 2, align: 'right', lineBreak: false });
      // Row separator — thicker after section-ending rows (Revenue, Gross Profit)
      const sepLineWidth = row.isSectionEnd ? 0.75 : 0.3;
      const sepColor = row.isSectionEnd ? '#999999' : '#cccccc';
      doc.moveTo(mTblX, ry + mRowH).lineTo(mTblX + mTblW, ry + mRowH)
        .lineWidth(sepLineWidth).strokeColor(sepColor).stroke();
    });
    // Outer border
    doc.rect(mTblX, metricsStartY, mTblW, mHeaderH + mRows.length * mRowH)
      .lineWidth(0.75).strokeColor('#000000').stroke();

    // Footer — consistent "By order of the Board" section
    doc.fontSize(10).font('Helvetica').fillColor('#000000').text('By order of the Board of Directors', 50, doc.page.height - 260);
    doc.fontSize(10).font('Helvetica').text('Managing Director', 50, doc.page.height - 165);
    doc.fontSize(10).font('Helvetica').text((companyName || 'COMPANY NAME').toUpperCase(), 50, doc.page.height - 135);
    doc.fontSize(10).font('Helvetica').text(toSentenceCase(resolvedLocation), 50, doc.page.height - 105);

    if (shouldRenderTaxComputationPage) {
      const tableX = 50;
      const descWidth = 360;
      const amountWidth = 135;
      const tableTopY = 208;
      const footerTopY = doc.page.height - 170;
      const tableBottomY = footerTopY - 14;
      const cellPaddingX = 6;
      let sectionRowHeight = 16;
      let itemRowHeight = 16;

      const taxDefaultLabels: Record<number, string> = {
        1: 'Accounting Income for the Tax Period (AED)',
        2: 'Share of profits / (losses) relating to investments accounted for under the Equity Method of Accounting (AED)',
        3: 'Accounting net profits / (losses) derived from Unincorporated Partnerships (AED)',
        4: 'Gains / (losses) on the disposal of an interest in an Unincorporated Partnership which meets the conditions of the Participation Exemption (AED)',
        5: 'Gains / (losses) reported in the Financial Statements that would not subsequently be recognised in the income statement (AED)',
        6: 'Realisation basis adjustments (AED)',
        7: 'Transitional adjustments (AED)',
        8: 'Dividends and profit distributions received from UAE Resident Persons (AED)',
        9: 'Income / (losses) from Participating Interests (AED)',
        10: 'Taxable Income / (Tax Losses) from Foreign Permanent Establishments (AED)',
        11: 'Income / (losses) from international aircraft / shipping (AED)',
        12: 'Adjustments arising from transfers within a Qualifying Group (AED)',
        13: 'Adjustments arising from Business Restructuring Relief (AED)',
        14: 'Adjustments for non-deductible expenditure (AED)',
        15: 'Adjustments for Interest expenditure (AED)',
        16: 'Adjustments for transactions with Related Parties and Connected Persons (AED)',
        17: 'Adjustments for income and expenditure derived from Qualifying Investment Funds (AED)',
        18: 'Other adjustments (AED)',
        19: 'Taxable Income / (Tax Loss) before any Tax Loss adjustments (AED)',
        20: 'Tax Losses utilised in the current tax Period (AED)',
        21: 'Tax Losses claimed from other group entities (AED)',
        22: 'Pre-Grouping Tax Losses (AED)',
        23: 'Taxable Income / (Tax Loss) for the Tax Period (AED)',
        24: 'Corporate Tax Liability @ 9% (AED)',
        25: 'Tax Credits (AED)',
        26: 'Corporate Tax Payable (AED)'
      };

      const taxRowsByNo: Record<number, { label: string; value: number }> = {};
      normalizeTaxRows.forEach((row: { label: string; value: number }) => {
        const match = String(row.label || '').match(/^\s*(\d+)\./);
        const numberKey = match ? Number(match[1]) : NaN;
        if (Number.isFinite(numberKey)) {
          taxRowsByNo[numberKey] = row;
        }
      });

      const cleanTaxLabel = (label: string) => String(label || '').replace(/^\s*\d+\.\s*/, '').trim();
      const getTaxRow = (num: number) => {
        const fromInput = taxRowsByNo[num];
        if (fromInput) return { label: cleanTaxLabel(fromInput.label), value: Number(fromInput.value) || 0 };
        return { label: taxDefaultLabels[num] || '-', value: 0 };
      };

      const sectionDefs = [
        { title: 'ACCOUNTING INCOME', rows: [1], alwaysFull: false },
        { title: 'ACCOUNTING ADJUSTMENTS', rows: [2, 3, 4, 5, 6, 7], alwaysFull: false },
        { title: 'EXEMPT INCOME', rows: [8, 9, 10, 11], alwaysFull: false },
        { title: 'RELIEFS', rows: [12, 13], alwaysFull: false },
        { title: 'NONDEDUCTIBLE EXPENDITURE', rows: [14, 15], alwaysFull: false },
        { title: 'OTHER ADJUSTMENTS', rows: [16, 17, 18], alwaysFull: false },
        { title: 'TAX LIABILITY AND TAX CREDITS', rows: [19, 20, 21, 22, 23], alwaysFull: true }
      ];

      const tableEntries: Array<
        { kind: 'section'; text: string } |
        { kind: 'item'; text: string; value: number; isKey: boolean; isNil?: boolean }
      > = [];

      sectionDefs.forEach((section) => {
        const sectionRows = section.rows.map((n) => getTaxRow(n));
        const visibleRows = section.alwaysFull
          ? sectionRows
          : sectionRows.filter((row) => hasMeaningfulAmount(row.value));

        if (!visibleRows.length) {
          tableEntries.push({ kind: 'section', text: section.title });
          return;
        }

        tableEntries.push({ kind: 'section', text: section.title });
        visibleRows.forEach((row) => {
          const isKey = /corporate tax liability|corporate tax payable/i.test(row.label);
          tableEntries.push({
            kind: 'item',
            text: row.label,
            value: Number(row.value) || 0,
            isKey
          });
        });
      });

      // UAE Corporate Tax Threshold Breakdown
      const UAE_CT_THRESHOLD = 375000;
      const taxableIncome = getTaxRow(23).value;
      const balanceTaxableIncome = Math.max(0, taxableIncome - UAE_CT_THRESHOLD);
      const ctLiabilityRow = getTaxRow(24);
      const taxCreditsRow = getTaxRow(25);
      const taxPayableRow = getTaxRow(26);

      tableEntries.push({ kind: 'item', text: 'Tax Upto 375,000 AED (Nil Rate)', value: 0, isKey: false, isNil: true });
      if (balanceTaxableIncome > 0) {
        tableEntries.push({ kind: 'item', text: 'Balance Taxable Income Above AED 375,000', value: balanceTaxableIncome, isKey: false });
        tableEntries.push({ kind: 'item', text: `Tax @ 9% of ${formatPdfAmount(balanceTaxableIncome)} (AED)`, value: Math.round(balanceTaxableIncome * 0.09 * 100) / 100, isKey: false });
      }
      tableEntries.push({ kind: 'item', text: ctLiabilityRow.label, value: ctLiabilityRow.value, isKey: true });
      tableEntries.push({ kind: 'item', text: taxCreditsRow.label, value: taxCreditsRow.value, isKey: false });
      tableEntries.push({ kind: 'item', text: taxPayableRow.label, value: taxPayableRow.value, isKey: true });

      let headerHeight = 16;
      const tableHeaderFont = 10;
      const sectionFont = 10;
      const itemFont = 10;
      const requiredHeight = () => (
        headerHeight + tableEntries.reduce((sum, entry) => sum + (entry.kind === 'section' ? sectionRowHeight : itemRowHeight), 0)
      );
      const availableHeight = tableBottomY - tableTopY;

      if (requiredHeight() > availableHeight) {
        headerHeight = 14;
        sectionRowHeight = 14;
        itemRowHeight = 14;
      }

      const drawTaxFooter = () => {
        doc.fontSize(taxPdfFontSize).font(taxPdfFont).fillColor('#000000').text('By order of the Board of Directors', 50, doc.page.height - 170);
        doc.fontSize(taxPdfFontSize).font(taxPdfFont).text('Managing Director', 50, doc.page.height - 118);
        doc.fontSize(taxPdfFontSize).font(taxPdfFont).text((companyName || 'COMPANY NAME').toUpperCase(), 50, doc.page.height - 98);
        doc.fontSize(taxPdfFontSize).font(taxPdfFont).text(toSentenceCase(resolvedLocation), 50, doc.page.height - 78);
      };

      doc.addPage();
      taxCompPageNum = doc.bufferedPageRange().count;
      const taxContentY = drawStandardPageHeader('Corporate Tax Computation Report', `as at ${descriptiveEndDate}`);

      // Period description — normal text (not bold), with spacing below header
      doc.fontSize(taxPdfFontSize).font(taxPdfFont).fillColor('#000000').text(
        `Corporate Tax Computation Report for the period ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`,
        50,
        taxContentY + 4,
        { width: 500 }
      );

      const headerY = tableTopY;
      const tableRight = tableX + descWidth + amountWidth;

      // Header row — gray fill, no vertical borders
      doc.rect(tableX, headerY, descWidth + amountWidth, headerHeight).fill('#e8e8e8');
      doc.moveTo(tableX, headerY).lineTo(tableRight, headerY).lineWidth(1).strokeColor('#000000').stroke();
      doc.moveTo(tableX, headerY + headerHeight).lineTo(tableRight, headerY + headerHeight).lineWidth(1).strokeColor('#000000').stroke();
      doc.fontSize(tableHeaderFont).font(taxPdfFontBold).fillColor('#000000');
      const headerTextY = headerY + Math.max(3, Math.floor((headerHeight - 10) / 2));
      doc.text('Description', tableX + cellPaddingX, headerTextY, { width: descWidth - (cellPaddingX * 2), align: 'left', lineBreak: false });
      doc.text('Amount (AED)', tableX + descWidth + cellPaddingX, headerTextY, { width: amountWidth - (cellPaddingX * 2), align: 'right', lineBreak: false });

      const isLastEntry = (idx: number) => idx === tableEntries.length - 1;

      let rowY = headerY + headerHeight;
      tableEntries.forEach((entry, entryIdx) => {
        const rowHeight = entry.kind === 'section' ? sectionRowHeight : itemRowHeight;
        if (rowY + rowHeight > tableBottomY) return;

        // No vertical borders — only bottom horizontal separator
        const isLast = isLastEntry(entryIdx);
        const isSection = entry.kind === 'section';

        if (isSection) {
          // Light gray background for section rows
          doc.rect(tableX, rowY, descWidth + amountWidth, rowHeight).fill('#f2f2f2');
        }

        doc.moveTo(tableX, rowY + rowHeight)
          .lineTo(tableRight, rowY + rowHeight)
          .lineWidth(isSection ? 0.75 : 0.3)
          .strokeColor(isSection ? '#999999' : '#dddddd')
          .stroke();

        if (isSection) {
          doc.fontSize(sectionFont).font(taxPdfFontBold).fillColor('#000000');
          const textY = rowY + Math.max(1, Math.floor((rowHeight - 10) / 2));
          doc.text(entry.text, tableX + cellPaddingX, textY, {
            width: descWidth - (cellPaddingX * 2),
            align: 'left',
            lineBreak: false
          });
        } else {
          const isCTLiability = /corporate tax liability/i.test(entry.text);
          doc.fontSize(itemFont).font(entry.isKey ? taxPdfFontBold : taxPdfFont).fillColor('#000000');
          const textY = rowY + Math.max(1, Math.floor((rowHeight - 10) / 2));
          // Sub-items get indent (1-2 spaces to the right)
          const itemIndent = entry.isKey ? 0 : 12;
          doc.text(entry.text, tableX + cellPaddingX + itemIndent, textY, {
            width: descWidth - (cellPaddingX * 2) - itemIndent,
            align: 'left',
            lineBreak: false
          });
          const amountDisplay = entry.isNil ? '- NIL -' : formatPdfAmount(entry.value);
          doc.text(amountDisplay, tableX + descWidth + cellPaddingX, textY, {
            width: amountWidth - (cellPaddingX * 2),
            align: 'right',
            lineBreak: false
          });

          // Bold single line above Corporate Tax Liability amount
          if (isCTLiability) {
            const lineStartX = tableX + descWidth + 8;
            const lineEndX = tableRight - 8;
            doc.moveTo(lineStartX, rowY).lineTo(lineEndX, rowY).lineWidth(1).strokeColor('#000000').stroke();
          }

          // Double underline beneath the last row (Corporate Tax Payable) — slightly shorter
          if (isLast) {
            const ul1 = rowY + rowHeight + 2;
            const ul2 = ul1 + 3;
            const dblLineStartX = tableX + descWidth + 8;
            const dblLineEndX = tableRight - 8;
            doc.moveTo(dblLineStartX, ul1).lineTo(dblLineEndX, ul1).lineWidth(1).strokeColor('#000000').stroke();
            doc.moveTo(dblLineStartX, ul2).lineTo(dblLineEndX, ul2).lineWidth(1).strokeColor('#000000').stroke();
          }
        }

        rowY += rowHeight;
      });

      drawTaxFooter();
      taxCompEndPageNum = taxCompPageNum;
    }

    // --- PAGE 4: BALANCE SHEET (Statement of Financial Position) ---
    const drawBsPageHeader = (continued = false) => {
      const contentStart = drawStandardPageHeader('Statement of Financial Position', `as at ${descriptiveEndDate}`, { continued });

      const bsTableTop = contentStart + 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Description', 50, bsTableTop);
      doc.text('Notes', 310, bsTableTop, { width: 35, align: 'center' });
      yearColumns.forEach((col) => {
        doc.fillColor(col.key === 'previous' ? '#888888' : '#000000');
        doc.text(col.label, col.x, bsTableTop, { width: col.width, align: 'right' });
      });
      doc.fillColor('#000000');
      doc.moveTo(50, bsTableTop + 15).lineTo(yearColumnsRightEdge, bsTableTop + 15).strokeColor('#000000').stroke();
      return bsTableTop + 25;
    };

    const measureBsRowReq = (item: any) => {
      const isHeader = item.type === 'header';
      const isSubHeader = item.type === 'subheader';
      const isSecHeader = isHeader || isSubHeader;
      const topPad = isSecHeader ? 6 : ((item.type === 'total' || item.type === 'grand_total') ? 2 : 0);
      const sanitizedLabel = String(item.label || '').replace(/:\s*$/, '');
      const label = item.type === 'item' ? `    ${sanitizedLabel}` : sanitizedLabel;

      if (isHeader) {
        doc.font('Helvetica-Bold').fontSize(12);
      } else if (isSubHeader) {
        doc.font('Helvetica-Oblique').fontSize(11);
      } else if (item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10);
      } else {
        doc.font('Helvetica').fontSize(10);
      }

      const labelHeight = doc.heightOfString(String(label || ''), { width: 280 });
      const base = (item.type === 'total' || item.type === 'grand_total') ? 26 : 17;
      const body = Math.max(base, labelHeight + 2);
      const totalExtra = (item.type === 'total' || item.type === 'grand_total') ? 4 : 0;
      return topPad + body + totalExtra;
    };

    doc.addPage();
    bsPageNum = doc.bufferedPageRange().count;
    let currentY = drawBsPageHeader(false);

    for (let idx = 0; idx < bsDisplayStructure.length; idx++) {
      const item: any = bsDisplayStructure[idx];
      const currentRowReq = measureBsRowReq(item);
      const remainingReq = bsDisplayStructure
        .slice(idx)
        .reduce((sum: number, row: any) => sum + measureBsRowReq(row), 0);

      // Reserve footer space only when this page can finish the section.
      const pageBottomLimit = (currentY + remainingReq <= contentBottomWithFooterY)
        ? contentBottomWithFooterY
        : contentBottomRegularY;

      if (currentY + currentRowReq > pageBottomLimit) {
        doc.addPage();
        currentY = drawBsPageHeader(true);
      }

      const values = bsValues[item.id] || { currentYear: 0, previousYear: 0 };
      const sanitizedLabel = String(item.label || '').replace(/:\s*$/, '');
      const isHeader = item.type === 'header';
      const isSubHeader = item.type === 'subheader';
      const isSecHeader = isHeader || isSubHeader;
      const displayLabel = isHeader
        ? sanitizedLabel.toUpperCase()
        : isSubHeader ? sanitizedLabel
        : item.type === 'item' ? `    ${sanitizedLabel}` : sanitizedLabel;
      const label = displayLabel;
      const rowTopPad = isSecHeader ? 6 : ((item.type === 'total' || item.type === 'grand_total') ? 2 : 0);
      const labelWidth = 280;

      if (isHeader) {
        // Main headings (ASSETS, EQUITY AND LIABILITIES) — 12pt Bold
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
      } else if (isSubHeader) {
        // Sub-headings (Non-current Assets, etc.) — 11pt Italic
        doc.font('Helvetica-Oblique').fontSize(11).fillColor('#000000');
      } else if (item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }
      const labelHeight = doc.heightOfString(String(label || ''), { width: labelWidth });
      const baseRowAdvance = (item.type === 'total' || item.type === 'grand_total') ? 26 : 17;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 4);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      // Render note number in the Notes column for item rows
      if (item.type === 'item' && noteNumberMap.has(item.id)) {
        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(noteNumberMap.get(item.id)!, 310, currentY, { width: 35, align: 'center' });
      }

      if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
        const isBold = item.type === 'total' || item.type === 'grand_total';
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          const formattedValue = formatPnlPdfAmount(rawValue, item.id);
          doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
          doc.fillColor(col.key === 'previous' ? '#888888' : '#000000');
          doc.text(formattedValue, col.x, currentY, { width: col.width, align: 'right' });
        });
        doc.fillColor('#000000');
      }

      if (item.type === 'total' || item.type === 'grand_total') {
        // Add top line at totals as per statement style.
        drawYearAmountLine(currentY - 5, 0.75);
        // Draw underline BELOW totals only (no upper overlapping line).
        drawYearAmountLine(currentY + 20, 0.9);

        if (item.type === 'grand_total') {
          drawYearAmountLine(currentY + 23, 0.9);
        }
      }

      currentY += rowAdvance;
    }
    bsEndPageNum = doc.bufferedPageRange().count;

    // --- PAGE 4: PROFIT & LOSS (Statement of Comprehensive Income) ---
    const drawPnlPageHeader = (continued = false) => {
      const contentStart = drawStandardPageHeader('Statement of Comprehensive Income', `for the period ended ${descriptiveEndDate}`, { continued });

      const tableTop = contentStart + 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Description', 50, tableTop);
      doc.text('Notes', 310, tableTop, { width: 35, align: 'center' });
      yearColumns.forEach((col) => {
        doc.fillColor(col.key === 'previous' ? '#888888' : '#000000');
        doc.text(col.label, col.x, tableTop, { width: col.width, align: 'right' });
      });
      doc.fillColor('#000000');
      doc.moveTo(50, tableTop + 15).lineTo(yearColumnsRightEdge, tableTop + 15).strokeColor('#000000').stroke();
      return tableTop + 25;
    };

    const measurePnlRowReq = (item: any) => {
      const topPad = (item.type === 'header' || item.type === 'subsection_header') ? 5 : (item.type === 'total' ? 2 : 0);
      const sanitizedLabel = String(item.label || '').replace(/:\s*$/, '');
      const label = item.indent ? `    ${sanitizedLabel}` : sanitizedLabel;

      if (item.type === 'header' || item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10);
      } else if (item.type === 'subsection_header') {
        doc.font('Helvetica-Oblique').fontSize(9);
      } else {
        doc.font('Helvetica').fontSize(10);
      }

      const labelHeight = doc.heightOfString(String(label || ''), { width: 280 });
      const base = item.type === 'total' ? 24 : 15;
      const body = Math.max(base, labelHeight + 2);
      const totalExtra = item.type === 'total' ? 4 : 0;
      return topPad + body + totalExtra;
    };

    // Ensure P&L total entries exist (use client-computed values which are already rounded correctly)
    const ensurePnlEntry = (id: string) => {
      if (!(pnlValues as any)[id]) (pnlValues as any)[id] = { currentYear: 0, previousYear: 0 };
    };
    ensurePnlEntry('gross_profit'); ensurePnlEntry('operating_profit');
    ensurePnlEntry('profit_loss_year'); ensurePnlEntry('total_comprehensive_income'); ensurePnlEntry('profit_after_tax');

    doc.addPage();
    pnlPageNum = doc.bufferedPageRange().count;
    currentY = drawPnlPageHeader(false);

    for (let idx = 0; idx < normalizedPnlStructure.length; idx++) {
      const item: any = normalizedPnlStructure[idx];
      const currentRowReq = measurePnlRowReq(item);
      const remainingReq = normalizedPnlStructure
        .slice(idx)
        .reduce((sum: number, row: any) => sum + measurePnlRowReq(row), 0);

      // Reserve footer space only when this page can finish the section.
      const pageBottomLimit = (currentY + remainingReq <= contentBottomWithFooterY)
        ? contentBottomWithFooterY
        : contentBottomRegularY;

      if (currentY + currentRowReq > pageBottomLimit) {
        doc.addPage();
        currentY = drawPnlPageHeader(true);
      }

      const values = pnlValues[item.id] || { currentYear: 0, previousYear: 0 };
      const sanitizedLabel = String(item.label || '').replace(/:\s*$/, '');
      const isPnlHeader = item.type === 'header';
      const isPnlSubHeader = item.type === 'subsection_header';
      const label = isPnlHeader
        ? sanitizedLabel.toUpperCase()
        : item.indent ? `    ${sanitizedLabel}` : sanitizedLabel;
      const rowTopPad = (isPnlHeader || isPnlSubHeader) ? 6 : (item.type === 'total' ? 2 : 0);
      const labelWidth = 280;

      if (isPnlHeader) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
      } else if (item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (isPnlSubHeader) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }
      const labelHeight = doc.heightOfString(String(label || ''), { width: labelWidth });
      const baseRowAdvance = item.type === 'total' ? 24 : 17;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 2);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      // Render note number in the Notes column for item rows
      if (item.type === 'item' && noteNumberMap.has(item.id)) {
        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(noteNumberMap.get(item.id)!, 310, currentY, { width: 35, align: 'center' });
      }

      if (item.type === 'item' || item.type === 'total') {
        const isProfitAfterTax = item.id === 'profit_after_tax';
        const isBold = item.type === 'total' || isProfitAfterTax;
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          const formattedValue = formatPnlPdfAmount(rawValue, item.id);
          doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
          doc.fillColor(col.key === 'previous' ? '#888888' : '#000000');
          doc.text(formattedValue, col.x, currentY, { width: col.width, align: 'right' });
        });
        doc.fillColor('#000000');
      }

      if (item.type === 'total') {
        // Single line above totals
        drawYearAmountLine(currentY - 5, 0.75);
        // Double line below totals
        drawYearAmountLine(currentY + 18, 0.9);
        drawYearAmountLine(currentY + 21, 0.9);
      }
      if (item.id === 'profit_after_tax') {
        // Single line above and double line below Profit after Tax
        drawYearAmountLine(currentY - 3, 0.75);
        drawYearAmountLine(currentY + 18, 0.9);
        drawYearAmountLine(currentY + 21, 0.9);
      }

      currentY += rowAdvance;
    }
    pnlEndPageNum = doc.bufferedPageRange().count;

    // --- PAGE 5: STATEMENT OF CHANGES IN EQUITY ---
    doc.addPage();
    equityPageNum = doc.bufferedPageRange().count;
    const equityContentY = drawStandardPageHeader('Statement of Changes in Equity', `for the period ended ${descriptiveEndDate}`);

    // Identify Equity Columns Dynamically
    const equityItems: any[] = [];
    let inEquity = false;
    bsDisplayStructure.forEach((item: any) => {
      if (item.id === 'equity_header') {
        inEquity = true;
        return;
      }
      if (item.id === 'total_equity') {
        inEquity = false;
        return;
      }
      if (inEquity && (item.type === 'item')) {
        equityItems.push(item);
      }
    });

    const equityTableTop = equityContentY + 10;
    const tableLeft = 50;
    const tableRight = doc.page.width - 50;
    const tableWidth = tableRight - tableLeft;
    const descColWidth = 190;
    const valueColCount = Math.max(1, equityItems.length + 1); // + Total column
    const valueColWidth = (tableWidth - descColWidth) / valueColCount;
    const valuesStartX = tableLeft + descColWidth;

    // Table Header — vertically centered alignment
    doc.fontSize(10).font('Helvetica-Bold');
    const headerCells = [
      { text: 'Description', x: tableLeft, width: descColWidth, align: 'left' as const },
      ...equityItems.map((item, idx) => ({
        text: String(item.label || '').replace(/:\s*$/, ''),
        x: valuesStartX + (idx * valueColWidth),
        width: valueColWidth,
        align: 'center' as const
      })),
      { text: 'Total', x: valuesStartX + (equityItems.length * valueColWidth), width: valueColWidth, align: 'center' as const }
    ];
    const eqHeaderHeight = Math.max(
      ...headerCells.map((cell) =>
        doc.heightOfString(cell.text, { width: cell.width, align: cell.align, lineBreak: true })
      ),
      12
    ) + 4;

    // Vertically center each header cell
    headerCells.forEach((cell) => {
      const cellH = doc.heightOfString(cell.text, { width: cell.width, align: cell.align, lineBreak: true });
      const verticalOffset = Math.max(0, (eqHeaderHeight - cellH) / 2);
      doc.text(cell.text, cell.x, equityTableTop + verticalOffset, { width: cell.width, align: cell.align, lineBreak: true });
    });

    doc.moveTo(tableLeft, equityTableTop + eqHeaderHeight + 4).lineTo(tableRight, equityTableTop + eqHeaderHeight + 4).strokeColor('#000000').stroke();

    let equityY = equityTableTop + eqHeaderHeight + 12;

    const renderEquityRow = (label: string, getVal: (item: any) => number, isBold = false) => {
      if (isBold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fontSize(10);
      const labelHeight = doc.heightOfString(label, { width: descColWidth, lineBreak: true });
      const rowHeight = Math.max(labelHeight, 12) + 6;
      const valueTextY = equityY + Math.max(0, Math.floor((rowHeight - 10) / 2));
      const rowTop = equityY;

      doc.text(label, tableLeft, equityY, { width: descColWidth, lineBreak: true });
      let rowTotal = 0;
      equityItems.forEach((item, idx) => {
        const val = getVal(item);
        rowTotal += Math.round(val);
        const formattedValue = formatPdfAmount(val);
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(formattedValue, valuesStartX + (idx * valueColWidth), valueTextY, { width: valueColWidth, align: 'right', lineBreak: false });
      });
      const formattedTotal = formatPdfAmount(rowTotal);
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(formattedTotal, valuesStartX + (equityItems.length * valueColWidth), valueTextY, { width: valueColWidth, align: 'right', lineBreak: false });
      equityY += rowHeight;
      return { rowTop, valueTextY, rowHeight, rowBottom: equityY };
    };

    const drawEquityValueAreaLine = (y: number, width = 1) => {
      for (let idx = 0; idx < valueColCount; idx++) {
        const cellX = valuesStartX + (idx * valueColWidth);
        const startX = cellX + 2;
        const endX = cellX + valueColWidth - 2;
        doc.moveTo(startX, y).lineTo(endX, y).lineWidth(width).strokeColor('#000000').stroke();
      }
    };

    const profit = pnlValues['profit_after_tax']?.currentYear || 0;

    // 1. Balance at start — use the actual period start date, not hardcoded January 1st
    const equityStartDate = startDate
      ? new Date(startDate)
      : (() => { const d = new Date(endDate); d.setMonth(0, 1); return d; })();
    const descriptiveStartYearDate = formatDescriptiveDate(equityStartDate.toISOString().split('T')[0]);

    renderEquityRow('Balance as at ' + descriptiveStartYearDate, (item) => bsValues[item.id]?.previousYear || 0);

    // 2. Profit for the period
    renderEquityRow('Net Profit for the period', (item) => {
      if (item.id === 'retained_earnings') return profit;
      return 0;
    });

    // 3. Other movements (Net difference to reconcile)
    renderEquityRow('Other movements', (item) => {
      const cur = bsValues[item.id]?.currentYear || 0;
      const prev = bsValues[item.id]?.previousYear || 0;
      const p = (item.id === 'retained_earnings') ? profit : 0;
      return cur - (prev + p);
    });

    // 4. Balance at end
    const finalEquityRow = renderEquityRow('Balance as at ' + descriptiveEndDate, (item) => bsValues[item.id]?.currentYear || 0, true);
    // Accounting style: single line above final values, double line below final values.
    drawEquityValueAreaLine(finalEquityRow.valueTextY - 3, 0.9);
    drawEquityValueAreaLine(finalEquityRow.valueTextY + 13, 0.9);
    drawEquityValueAreaLine(finalEquityRow.valueTextY + 16, 0.9);
    equityEndPageNum = doc.bufferedPageRange().count;

    // --- WORKING NOTES Helper ---
    const renderNotesBlock = (
      workingNotes: Record<string, any[]>,
      structure: any[],
      mainTitle: string,
      formatPnlExpenses = false,
      noteNumbers?: Map<string, string>
    ) => {
      const isBalanceSheetNotes = /financial position/i.test(mainTitle);
      let firstNote = true;
      let startPage = 0;
      let endPage = 0;
      const measureNoteRowHeight = (note: any) => {
        const description = ((note?.description || '-') as string).replace(/^\[Grouped Selected TB\]\s*/, '');
        const noteTextHeight = doc.heightOfString(description, { width: 280 });
        return Math.max(noteTextHeight, 12) + 8;
      };

      // Sort working note keys by their position in the structure (e.g. Assets before Equity & Liabilities)
      const structureOrder = new Map<string, number>();
      (Array.isArray(structure) ? structure : []).forEach((item: any, idx: number) => {
        if (item?.id) structureOrder.set(item.id, idx);
      });
      const sortedNoteKeys = Object.keys(workingNotes || {}).sort((a, b) => {
        const posA = structureOrder.has(a) ? structureOrder.get(a)! : Number.MAX_SAFE_INTEGER;
        const posB = structureOrder.has(b) ? structureOrder.get(b)! : Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });

      sortedNoteKeys.forEach((accountId) => {
        const notes = workingNotes[accountId];
        if (!notes || notes.length === 0) return;
        // PPE is already shown in the fixed asset schedule — skip it from working notes
        if (isBalanceSheetNotes && accountId === 'property_plant_equipment') return;
        // Depreciation details are already shown in the fixed asset schedule — skip from P&L working notes
        if (!isBalanceSheetNotes && accountId === 'depreciation_ppe') return;

        const visibleNotes = notes.filter((note) => {
          const curVal = note?.currentYearAmount ?? note?.amount ?? 0;
          const preVal = note?.previousYearAmount ?? 0;
          return hasMeaningfulAmount(curVal) || hasMeaningfulAmount(preVal);
        });
        if (visibleNotes.length === 0) return;

        if (firstNote) {
          doc.addPage();
          startPage = doc.bufferedPageRange().count;
          currentY = drawStandardPageHeader(mainTitle, `as at ${descriptiveEndDate}`);
          firstNote = false;
        }

        const accountLabel = String(structure.find(s => s.id === accountId)?.label || accountId).replace(/:\s*$/, '');
        const rowHeights = visibleNotes.map(measureNoteRowHeight);
        const fullBlockHeight = 15 + 10 + 15 + rowHeights.reduce((sum, h) => sum + h, 0) + 30;
        const remainingSpace = contentBottomWithFooterY - currentY;
        const pageCapacity = contentBottomWithFooterY - 50;

        // If this full note block can fit on a fresh page, do not split it at page end.
        if (fullBlockHeight <= pageCapacity && fullBlockHeight > remainingSpace) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }

        const drawAccountSectionHeader = (continued = false) => {
          const noteNum = noteNumbers?.get(accountId);
          const notePrefix = noteNum ? `${noteNum}    ` : '';
          const heading = continued ? `${notePrefix}${accountLabel.toUpperCase()} (CONTINUED)` : `${notePrefix}${accountLabel.toUpperCase()}`;
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(heading, 50, currentY);
          currentY += 15;
          doc.moveTo(50, currentY).lineTo(notesYearColumnsRightEdge, currentY).lineWidth(0.5).strokeColor('#000000').stroke();
          currentY += 10;

          // Make column headers slightly bolder/darker for better readability.
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
          doc.text('Description', 60, currentY);
          notesYearColumns.forEach((col) => {
            doc.text(col.label, col.x, currentY, { width: col.width, align: 'right' });
          });
          currentY += 15;
        };

        // Keep heading + column header + at least first note row + subtotal together.
        const firstRowHeight = measureNoteRowHeight(visibleNotes[0]);
        const minSectionStartReq = 15 + 10 + 15 + firstRowHeight + 30;
        if (currentY + minSectionStartReq > contentBottomWithFooterY) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }

        drawAccountSectionHeader(false);

        let noteTotalCurrent = 0;
        let noteTotalPrevious = 0;

        visibleNotes.forEach((note) => {
          const curVal = note.currentYearAmount ?? note.amount ?? 0;
          const preVal = note.previousYearAmount ?? 0;

          const description = (note.description || '-').replace(/^\[Grouped Selected TB\]\s*/, '');
          const noteTextHeight = doc.heightOfString(description, { width: 280 });
          const noteRequiredHeight = Math.max(noteTextHeight, 12) + 8;

          // Ensure total row does not get stranded on the next page.
          if (currentY + noteRequiredHeight + 30 > contentBottomWithFooterY) {
            doc.addPage();
            drawBorder();
            currentY = 50;
            drawAccountSectionHeader(true);
          }

          doc.fontSize(9).font('Helvetica').fillColor('#333333');
          const startNoteY = currentY;
          doc.text(description, 60, currentY, { width: 280 });

          notesYearColumns.forEach((col) => {
            const rawValue = col.key === "current" ? curVal : preVal;
            doc.text(formatWorkingNoteAmount(rawValue, isBalanceSheetNotes), col.x, startNoteY, { width: col.width, align: 'right' });
          });

          noteTotalCurrent += curVal;
          noteTotalPrevious += preVal;
          currentY = startNoteY + Math.max(noteTextHeight, 12) + 4;
        });

        // Subtotal for note
        if (currentY + 30 > contentBottomWithFooterY) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }
        // Single line above total
        notesYearColumns.forEach((col) => {
          doc
            .moveTo(col.x, currentY)
            .lineTo(col.x + col.width, currentY)
            .lineWidth(0.5)
            .strokeColor('#000000')
            .stroke();
        });
        currentY += 5;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Total', 60, currentY);
        notesYearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? noteTotalCurrent : noteTotalPrevious;
          doc.text(formatWorkingNoteAmount(rawValue, isBalanceSheetNotes), col.x, currentY, { width: col.width, align: 'right' });
        });
        // Double line below total
        const notesDblLineY1 = currentY + 14;
        const notesDblLineY2 = notesDblLineY1 + 3;
        notesYearColumns.forEach((col) => {
          doc.moveTo(col.x, notesDblLineY1).lineTo(col.x + col.width, notesDblLineY1).lineWidth(0.75).strokeColor('#000000').stroke();
          doc.moveTo(col.x, notesDblLineY2).lineTo(col.x + col.width, notesDblLineY2).lineWidth(0.75).strokeColor('#000000').stroke();
        });
        currentY += 25;
        endPage = doc.bufferedPageRange().count;
      });

      if (!endPage && startPage) {
        endPage = doc.bufferedPageRange().count;
      }

      return { startPage, endPage };
    };

    // --- FIXED ASSET SCHEDULE (Property, Plant and Equipment) — first BS working note ---
    // Only render this schedule if the balance sheet has a non-zero property_plant_equipment value.
    const hasPpeValue =
      hasMeaningfulAmount((bsValues as any)?.property_plant_equipment?.currentYear) ||
      hasMeaningfulAmount((bsValues as any)?.property_plant_equipment?.previousYear);

    if (hasPpeValue) {
      // Use fixedAssetData from the dedicated UI when available
      const hasFixedAssetUI = Array.isArray(fixedAssetData) && fixedAssetData.length > 0;

      let ppeCategories: string[];
      let allPpeCols: string[];
      let ppePrev: (cat: string) => number;
      let ppeCur: (cat: string) => number;
      let ppeAdditions: (cat: string) => number;
      let ppeDisposals: (cat: string) => number;
      let accDepPrevVal: (cat: string) => number;
      let accDepCurVal: (cat: string) => number;
      let depCharge: (cat: string) => number;
      let elimOnDisposal: (cat: string) => number;
      let carryingVal: (cat: string) => number;
      let carryingValPrev: (cat: string) => number;

      if (hasFixedAssetUI) {
        // --- Use explicit fixed asset data from the dedicated schedule UI ---
        const faData: any[] = fixedAssetData;
        ppeCategories = faData.map((c: any) => c.name);
        allPpeCols = [...ppeCategories, '__total__'];
        const faSum = (field: string) => faData.reduce((s: number, c: any) => s + (Number(c[field]) || 0), 0);
        const faByName: Record<string, any> = {};
        faData.forEach((c: any) => { faByName[c.name] = c; });

        ppePrev = (cat) => cat === '__total__' ? faSum('costOpening') : (faByName[cat]?.costOpening || 0);
        ppeCur = (cat) => cat === '__total__' ? faSum('costClosing') : (faByName[cat]?.costClosing || 0);
        ppeAdditions = (cat) => cat === '__total__' ? faSum('costAdditions') : (faByName[cat]?.costAdditions || 0);
        ppeDisposals = (cat) => {
          const val = cat === '__total__' ? faSum('costDisposals') : (faByName[cat]?.costDisposals || 0);
          return val > 0 ? -val : val; // Show as negative
        };
        accDepPrevVal = (cat) => {
          const val = cat === '__total__' ? faSum('accDepOpening') : (faByName[cat]?.accDepOpening || 0);
          return -Math.abs(val); // Show as negative (credit balance)
        };
        accDepCurVal = (cat) => {
          const val = cat === '__total__' ? faSum('accDepClosing') : (faByName[cat]?.accDepClosing || 0);
          return -Math.abs(val);
        };
        depCharge = (cat) => {
          const val = cat === '__total__' ? faSum('accDepCharge') : (faByName[cat]?.accDepCharge || 0);
          return -Math.abs(val); // Show as negative
        };
        elimOnDisposal = (cat) => {
          const val = cat === '__total__' ? faSum('accDepElimOnDisposal') : (faByName[cat]?.accDepElimOnDisposal || 0);
          return Math.abs(val); // Show as positive (reversal)
        };
        carryingVal = (cat) => {
          if (cat === '__total__') return ppeCategories.reduce((s, c) => s + carryingVal(c), 0);
          const cost = faByName[cat]?.costClosing || 0;
          const dep = faByName[cat]?.accDepClosing || 0;
          return cost - Math.abs(dep);
        };
        carryingValPrev = (cat) => {
          if (cat === '__total__') return ppeCategories.reduce((s, c) => s + carryingValPrev(c), 0);
          const cost = faByName[cat]?.costOpening || 0;
          const dep = faByName[cat]?.accDepOpening || 0;
          return cost - Math.abs(dep);
        };
      } else {
        // --- Fallback: derive from working notes (legacy behavior) ---
        const ppeNotes: any[] = (bsWorkingNotes?.property_plant_equipment || []).filter((e: any) => e?.description);
        const cleanPpeDesc = (raw: string) => String(raw || '').replace(/^\[Grouped Selected TB\]\s*/, '').trim();
        const isAccumDepDesc = (desc: string) => /^accumulated\s+depreci?ation\b/i.test(desc);

        const ppeCategoryMap: Record<string, { cur: number; prev: number }> = {};
        ppeNotes.forEach((e: any) => {
          const desc = cleanPpeDesc(e.description);
          if (!desc || isAccumDepDesc(desc)) return;
          if (!ppeCategoryMap[desc]) ppeCategoryMap[desc] = { cur: 0, prev: 0 };
          ppeCategoryMap[desc].cur += Number(e.currentYearAmount) || 0;
          ppeCategoryMap[desc].prev += Number(e.previousYearAmount) || 0;
        });
        ppeCategories = Object.keys(ppeCategoryMap);
        allPpeCols = [...ppeCategories, '__total__'];

        const matchToCostCat = (strippedName: string): string => {
          const lower = strippedName.toLowerCase();
          return ppeCategories.find(c => c.toLowerCase() === lower)
            || ppeCategories.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))
            || strippedName;
        };

        const accDepMap: Record<string, { cur: number; prev: number }> = {};
        ppeNotes.forEach((e: any) => {
          const desc = cleanPpeDesc(e.description);
          if (!isAccumDepDesc(desc)) return;
          const stripped = desc.replace(/^accumulated\s+depreci?ation\s*[-–:]\s*/i, '').trim();
          const cat = matchToCostCat(stripped);
          if (!accDepMap[cat]) accDepMap[cat] = { cur: 0, prev: 0 };
          accDepMap[cat].cur += Number(e.currentYearAmount) || 0;
          accDepMap[cat].prev += Number(e.previousYearAmount) || 0;
        });

        const depExpMap: Record<string, { cur: number; prev: number }> = {};
        const depExpNotes: any[] = (pnlWorkingNotes?.depreciation_ppe || []).filter((e: any) => e?.description);
        depExpNotes.forEach((e: any) => {
          const desc = cleanPpeDesc(e.description);
          const stripped = desc.replace(/^depreciation\s*[-–:]\s*/i, '').trim();
          const cat = matchToCostCat(stripped || desc);
          if (!depExpMap[cat]) depExpMap[cat] = { cur: 0, prev: 0 };
          depExpMap[cat].cur += Number(e.currentYearAmount) || 0;
          depExpMap[cat].prev += Number(e.previousYearAmount) || 0;
        });

        ppeCur = (cat) => cat === '__total__'
          ? ppeCategories.reduce((s, c) => s + ppeCategoryMap[c].cur, 0)
          : (ppeCategoryMap[cat]?.cur || 0);
        ppePrev = (cat) => cat === '__total__'
          ? ppeCategories.reduce((s, c) => s + ppeCategoryMap[c].prev, 0)
          : (ppeCategoryMap[cat]?.prev || 0);
        ppeAdditions = (cat) => Math.max(0, ppeCur(cat) - ppePrev(cat));
        ppeDisposals = (cat) => Math.min(0, ppeCur(cat) - ppePrev(cat));

        accDepCurVal = (cat) => cat === '__total__'
          ? ppeCategories.reduce((s, c) => s + (accDepMap[c]?.cur || 0), 0)
          : (accDepMap[cat]?.cur || 0);
        accDepPrevVal = (cat) => cat === '__total__'
          ? ppeCategories.reduce((s, c) => s + (accDepMap[c]?.prev || 0), 0)
          : (accDepMap[cat]?.prev || 0);

        depCharge = (cat) => {
          if (cat === '__total__') return ppeCategories.reduce((s, c) => s - (depExpMap[c]?.cur || 0), 0);
          return -(depExpMap[cat]?.cur || 0);
        };

        const elimOnDisposalBase = (cat: string) => {
          const absOpen = Math.abs(accDepMap[cat]?.prev || 0);
          const absClose = Math.abs(accDepMap[cat]?.cur || 0);
          const charge = Math.abs(depExpMap[cat]?.cur || 0);
          return Math.max(0, absOpen + charge - absClose);
        };
        elimOnDisposal = (cat) => cat === '__total__'
          ? ppeCategories.reduce((s, c) => s + elimOnDisposalBase(c), 0)
          : elimOnDisposalBase(cat);

        carryingVal = (cat) => {
          if (cat === '__total__') return ppeCategories.reduce((s, c) => s + carryingVal(c), 0);
          return (ppeCategoryMap[cat]?.cur || 0) + (accDepMap[cat]?.cur || 0);
        };
        carryingValPrev = (cat) => {
          if (cat === '__total__') return ppeCategories.reduce((s, c) => s + carryingValPrev(c), 0);
          return (ppeCategoryMap[cat]?.prev || 0) + (accDepMap[cat]?.prev || 0);
        };
      }

      const ppeFmt = (val: number) => {
        const r = Math.round(val);
        if (r === 0) return '-';
        const f = Math.abs(r).toLocaleString();
        return r < 0 ? `(${f})` : f;
      };

      // Opening balance date = period start date
      const descriptivePpeOpeningDate = formatDescriptiveDate(startDate);

      // Use landscape orientation for the PPE schedule to accommodate many asset columns
      doc.addPage({ layout: 'landscape', size: 'A4' });
      const ppeSchedulePageNum = doc.bufferedPageRange().count;
      if (!bsNotesPageNum) bsNotesPageNum = ppeSchedulePageNum;

      // Column layout — landscape page gives much more horizontal space
      const ppePageWidth = doc.page.width; // ~842 in landscape A4
      const ppeLeftMargin = 30;
      const ppeRightMargin = 30;
      const ppeUsableWidth = ppePageWidth - ppeLeftMargin - ppeRightMargin;
      const ppeNumCols = allPpeCols.length;
      // Dynamically shrink description column when many asset categories exist
      const ppeDescColWidth = ppeNumCols >= 7 ? 180 : ppeNumCols >= 5 ? 210 : 250;
      const ppeDataWidth = ppeUsableWidth - ppeDescColWidth;
      const ppeColW = Math.max(70, Math.floor(ppeDataWidth / ppeNumCols));
      // Dynamically reduce font size when columns are tight
      const ppeFontSize = ppeColW < 80 ? 8 : ppeNumCols >= 7 ? 8.5 : 10;
      // Right-pad for numbers inside columns to avoid touching the underlines
      const ppeNumPad = 4;
      const getPpeColX = (idx: number) => ppeLeftMargin + ppeDescColWidth + idx * ppeColW;

      const ppeContentY = drawStandardPageHeader('Schedule of Notes forming Part of Financial Position', `as at ${descriptiveEndDate}`, { leftMargin: ppeLeftMargin });

      let ppeY = ppeContentY + 8;
      const ppeNoteNum = noteNumberMap.get('property_plant_equipment');
      const ppeNotePrefix = ppeNoteNum ? `${ppeNoteNum}    ` : '';
      doc.fontSize(ppeFontSize).font('Helvetica-Bold').fillColor('#000000').text(`${ppeNotePrefix}PROPERTY, PLANT AND EQUIPMENT`, ppeLeftMargin, ppeY);
      ppeY += 22;

      // Column headers — centered, multi-line
      doc.font('Helvetica-Bold').fontSize(ppeFontSize).fillColor('#000000');
      let maxHdrH = doc.heightOfString('Total', { width: ppeColW });
      ppeCategories.forEach(cat => {
        const h = doc.heightOfString(cat, { width: ppeColW });
        if (h > maxHdrH) maxHdrH = h;
      });
      allPpeCols.forEach((col, i) => {
        const label = col === '__total__' ? 'Total' : col;
        const labelH = doc.heightOfString(label, { width: ppeColW });
        // Vertically align headers to bottom
        const headerTopOffset = maxHdrH - labelH;
        doc.text(label, getPpeColX(i), ppeY + headerTopOffset, { width: ppeColW, align: 'center' });
      });
      ppeY += maxHdrH + 10;

      // Header underline across data columns only
      doc.moveTo(ppeLeftMargin + ppeDescColWidth, ppeY)
        .lineTo(ppeLeftMargin + ppeDescColWidth + ppeNumCols * ppeColW, ppeY)
        .lineWidth(0.5).strokeColor('#000000').stroke();
      ppeY += 12;

      // Bottom margin for page content (leave room for border + page number footer)
      const ppePageBottomLimit = doc.page.height - 80;

      const drawPpeValueLines = (y: number, lw = 0.5) => {
        allPpeCols.forEach((_, i) => {
          const x = getPpeColX(i);
          doc.moveTo(x + 4, y).lineTo(x + ppeColW - 4, y).lineWidth(lw).strokeColor('#000000').stroke();
        });
      };

      // Helper to add a continuation landscape page with column headers
      const addPpeContinuationPage = () => {
        doc.addPage({ layout: 'landscape', size: 'A4' });
        const ppeContinuedY = drawStandardPageHeader('Schedule of Notes forming Part of Financial Position', `as at ${descriptiveEndDate}`, { continued: true, leftMargin: ppeLeftMargin });
        ppeY = ppeContinuedY + 8;
        doc.fontSize(ppeFontSize).font('Helvetica-Bold').fillColor('#000000').text(`${ppeNotePrefix}PROPERTY, PLANT AND EQUIPMENT (Continued)`, ppeLeftMargin, ppeY);
        ppeY += 22;

        // Re-draw column headers
        doc.font('Helvetica-Bold').fontSize(ppeFontSize).fillColor('#000000');
        allPpeCols.forEach((col, i) => {
          const label = col === '__total__' ? 'Total' : col;
          const labelH = doc.heightOfString(label, { width: ppeColW });
          const headerTopOffset = maxHdrH - labelH;
          doc.text(label, getPpeColX(i), ppeY + headerTopOffset, { width: ppeColW, align: 'center' });
        });
        ppeY += maxHdrH + 10;
        doc.moveTo(ppeLeftMargin + ppeDescColWidth, ppeY)
          .lineTo(ppeLeftMargin + ppeDescColWidth + ppeNumCols * ppeColW, ppeY)
          .lineWidth(0.5).strokeColor('#000000').stroke();
        ppeY += 12;
      };

      const renderPpeRow = (
        label: string,
        bold: boolean,
        getVal: ((col: string) => number) | null,
        opts: { topLine?: boolean; bottomLine?: boolean; doubleLine?: boolean } = {}
      ) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(ppeFontSize);
        const labelH = doc.heightOfString(label, { width: ppeDescColWidth - 10 });
        const baseH = Math.max(18, labelH + 8);
        const topPad = opts.topLine ? 10 : 5;
        const rowH = topPad + baseH;

        // Check if this row would overflow the page — if so, start a new landscape page
        if (ppeY + rowH + 20 > ppePageBottomLimit) {
          addPpeContinuationPage();
        }

        const ty = ppeY + topPad;

        if (opts.topLine) drawPpeValueLines(ppeY + 5, 0.5);

        doc.fillColor(bold ? '#000000' : '#333333');
        doc.text(label, ppeLeftMargin, ty, { width: ppeDescColWidth - 10, lineBreak: false });

        if (getVal) {
          allPpeCols.forEach((col, i) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(ppeFontSize)
              .text(ppeFmt(getVal(col)), getPpeColX(i) + ppeNumPad, ty, { width: ppeColW - ppeNumPad * 2, align: 'right', lineBreak: false });
          });
        }

        ppeY += rowH;
        if (opts.bottomLine || opts.doubleLine) {
          // Bold, thick single line for section totals
          drawPpeValueLines(ppeY - 4, opts.doubleLine ? 0.75 : 1.2);
          if (opts.doubleLine) { drawPpeValueLines(ppeY + 1, 0.75); ppeY += 6; }
        }
      };

      // COST section
      renderPpeRow('Cost', true, null);
      renderPpeRow(`As at ${descriptivePpeOpeningDate}`, true, ppePrev, { bottomLine: true });
      renderPpeRow('Additions during the year', false, ppeAdditions);
      renderPpeRow('Disposals during the year', false, ppeDisposals);
      // Bold, thick single line below total cost amount
      renderPpeRow(`As at ${descriptiveEndDate}`, true, ppeCur, { topLine: true, bottomLine: true });
      ppeY += 12;
      if (ppeY > ppePageBottomLimit) addPpeContinuationPage();

      // ACCUMULATED DEPRECIATION section
      renderPpeRow('Accumulated depreciation', true, null);
      renderPpeRow(`As at ${descriptivePpeOpeningDate}`, true, accDepPrevVal, { bottomLine: true });
      renderPpeRow('Charge for the year', false, depCharge);
      renderPpeRow('Eliminated on disposal during the year', false, elimOnDisposal);
      // Bold, thick single line below accumulated depreciation total
      renderPpeRow(`As at ${descriptiveEndDate}`, true, accDepCurVal, { topLine: true, bottomLine: true });
      ppeY += 12;
      if (ppeY > ppePageBottomLimit) addPpeContinuationPage();

      // CARRYING VALUE section — current year then previous year, double underline below
      renderPpeRow(`Carrying value as at ${descriptiveEndDate}`, true, carryingVal);
      renderPpeRow(`Carrying value as at ${descriptivePpeOpeningDate}`, true, carryingValPrev, { doubleLine: true });

      bsNotesPageNum = ppeSchedulePageNum;
      bsNotesEndPageNum = doc.bufferedPageRange().count;
      // Track the last page of the Fixed Assets Schedule so we can add a signatory footer
      fixedAssetsEndPageNum = doc.bufferedPageRange().count;
    }

    // Render remaining BS working notes after the PPE schedule
    const bsNotesPages = renderNotesBlock(bsWorkingNotes, bsStructure, 'Schedule of Notes forming Part of Financial Position', false, noteNumberMap);
    if (!bsNotesPageNum) bsNotesPageNum = bsNotesPages.startPage;
    if (bsNotesPages.endPage) bsNotesEndPageNum = bsNotesPages.endPage;

    const pnlNotesPages = renderNotesBlock(
      pnlWorkingNotes,
      normalizedPnlStructure,
      'Schedule of Notes forming Part of Comprehensive Income',
      true,
      noteNumberMap
    );
    pnlNotesPageNum = pnlNotesPages.startPage;
    pnlNotesEndPageNum = pnlNotesPages.endPage;

    // Finalize Pages and Dynamic TOC
    const range = doc.bufferedPageRange();

    // Update TOC on Page 2
    doc.switchToPage(indexPageNum - 1);
    doc.fontSize(11).font('Helvetica').fillColor('#000000');

    let currentTocY = tocItemsY;
    const addTocItem = (label: string, startPageNum: number, endPageNum?: number) => {
      if (!startPageNum) return;
      const safeEnd = (Number.isFinite(endPageNum as number) && (endPageNum as number) >= startPageNum)
        ? (endPageNum as number)
        : startPageNum;
      const pageText = safeEnd > startPageNum ? `${startPageNum}-${safeEnd}` : String(startPageNum);

      // Draw label
      doc.fontSize(11).font('Helvetica').fillColor('#000000');
      doc.text(label, 50, currentTocY, { lineBreak: false });

      // Measure label width and page number width to compute dot leader span
      const labelW = doc.widthOfString(label);
      const pageNumW = doc.widthOfString(pageText);
      const dotsStart = 50 + labelW + 4;
      const dotsEnd = 540 - pageNumW - 4;
      if (dotsEnd > dotsStart) {
        const dotSpacing = 5;
        let dotX = dotsStart;
        doc.fontSize(11).fillColor('#aaaaaa');
        while (dotX + dotSpacing <= dotsEnd) {
          doc.text('.', dotX, currentTocY, { lineBreak: false });
          dotX += dotSpacing;
        }
      }

      // Draw page number right-aligned
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
      doc.text(pageText, 540 - pageNumW, currentTocY, { lineBreak: false });

      currentTocY += 22;
    };

    addTocItem("Director's Report", directorsPageNum, taxCompPageNum ? (taxCompPageNum - 1) : (bsPageNum ? (bsPageNum - 1) : directorsPageNum));
    addTocItem('Corporate Tax Computation Report', taxCompPageNum, taxCompEndPageNum);
    addTocItem('Statement of Financial Position', bsPageNum, bsEndPageNum);
    addTocItem('Statement of Comprehensive Income', pnlPageNum, pnlEndPageNum);
    addTocItem('Statement of Changes in Equity', equityPageNum, equityEndPageNum);
    addTocItem('Schedule of Notes forming Part of Financial Position', bsNotesPageNum, bsNotesEndPageNum);
    addTocItem('Schedule of Notes forming Part of Comprehensive Income', pnlNotesPageNum, pnlNotesEndPageNum);

    const signatoryFooterPages = new Set<number>(
      [bsEndPageNum, pnlEndPageNum, equityEndPageNum, bsNotesEndPageNum, pnlNotesEndPageNum, fixedAssetsEndPageNum].filter((n) => Number.isFinite(n) && n > 0)
    );

    // Add page numbers and authorized signatory footer
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      // Show signatory block only on each section's ending page listed in INDEX content.
      if (signatoryFooterPages.has(i + 1)) {
        drawAuthorizedSignatoryFooter();
      }

      // Keep page number inside the border box and away from clipping at the page edge.
      doc.fontSize(8).fillColor('#666666').text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 48, { align: 'center', lineBreak: false });
      doc.page.margins.bottom = oldBottomMargin;
    }

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

router.post("/download-final-step-pdf", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { companyName, period, sections, title } = req.body || {};

  try {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const safeCompanyName = (companyName || "CT_Final_Step_Report").replace(/\s+/g, "_");
    const filename = `${safeCompanyName}_Final_Step.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    doc.pipe(res);

    const drawBorder = () => {
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor("#000000").stroke();
    };

    const pageLeft = 40;
    const pageTop = 40;
    const tableWidth = doc.page.width - 80;
    const labelColWidth = Math.round(tableWidth * 0.55);
    const valueColWidth = tableWidth - labelColWidth;
    const pageBottomY = () => doc.page.height - 40;

    const ensureSpace = (requiredHeight: number) => {
      if (doc.y + requiredHeight <= pageBottomY()) return;
      doc.addPage();
      drawBorder();
      doc.y = pageTop;
    };

    drawBorder();
    doc.y = pageTop;

    const normalizedTitle = String(title || "Corporate Tax Return")
      .replace(/\s*-\s*final step report\s*/i, "")
      .trim() || "Corporate Tax Return";

    const topPeriodText = extractFinalStepPeriodFromSections(Array.isArray(sections) ? sections : []) || period || "-";

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#000000").text(normalizedTitle.toUpperCase(), pageLeft, doc.y, {
      width: tableWidth,
      align: "center"
    });
    doc.moveDown(0.45);
    doc.font("Helvetica-Bold").fontSize(11).text(`Company: ${companyName || "-"}`, pageLeft, doc.y, { width: tableWidth });
    doc.moveDown(0.2);
    doc.text(`Period: ${topPeriodText}`, pageLeft, doc.y, { width: tableWidth });
    doc.moveDown(0.2);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, pageLeft, doc.y, { width: tableWidth });
    doc.moveDown(0.7);

    (Array.isArray(sections) ? sections : []).forEach((section: any) => {
      const sectionTitle = String(section?.title || "Section").toUpperCase();
      const sectionRows = Array.isArray(section?.rows) ? section.rows : [];

      // Avoid starting a section if only a tiny part of it fits on the current page.
      // This prevents cases like a section header + 1 row at the page end.
      const previewRows = sectionRows.slice(0, Math.min(4, sectionRows.length));
      let previewRowsHeight = 0;
      previewRows.forEach((row: any) => {
        const isHeader = row?.type === "header";
        const labelText = String(row?.label || "").replace(/---/g, "").trim();
        const valueText = isHeader ? "" : normalizeFinalStepValue(row?.value);
        doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(8.75);
        const labelHeight = doc.heightOfString(labelText || "-", { width: (isHeader ? tableWidth : labelColWidth) - 10 });
        const valueHeight = isHeader ? 0 : doc.heightOfString(valueText || "-", { width: valueColWidth - 10 });
        previewRowsHeight += Math.max(isHeader ? 17 : 18, labelHeight + 7, valueHeight + 7);
      });
      const minSectionStartHeight = 24 + 21 + previewRowsHeight + 8;
      ensureSpace(Math.min(minSectionStartHeight, 160));

      doc.font("Helvetica-Bold").fontSize(10);
      const sectionHeaderY = doc.y;
      doc.rect(pageLeft, sectionHeaderY, tableWidth, 22).fillAndStroke("#f2f2f2", "#000000");
      doc.fillColor("#000000").text(sectionTitle, pageLeft + 7, sectionHeaderY + 5, { width: tableWidth - 14 });
      doc.y = sectionHeaderY + 22;

      // Column header
      ensureSpace(22);
      const colHeaderY = doc.y;
      doc.rect(pageLeft, colHeaderY, labelColWidth, 20).stroke("#000000");
      doc.rect(pageLeft + labelColWidth, colHeaderY, valueColWidth, 20).stroke("#000000");
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
      doc.text("Description", pageLeft + 5, colHeaderY + 5, { width: labelColWidth - 10 });
      doc.text("Value", pageLeft + labelColWidth + 5, colHeaderY + 5, { width: valueColWidth - 10 });
      doc.y = colHeaderY + 20;

      sectionRows.forEach((row: any) => {
        const isHeader = row?.type === "header";
        const labelText = String(row?.label || "").replace(/---/g, "").trim();
        const valueText = isHeader ? "" : normalizeFinalStepValue(row?.value);

        doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        const labelHeight = doc.heightOfString(labelText || "-", { width: labelColWidth - 10 });
        const valueHeight = doc.heightOfString(valueText || "-", { width: valueColWidth - 10 });
        const rowHeight = Math.max(isHeader ? 18 : 20, labelHeight + 8, valueHeight + 8);

        ensureSpace(rowHeight + 1);
        const rowY = doc.y;

        if (isHeader) {
          doc.rect(pageLeft, rowY, tableWidth, rowHeight).fillAndStroke("#fafafa", "#000000");
          doc.fillColor("#000000").text(labelText || "-", pageLeft + 5, rowY + 4.5, { width: tableWidth - 10 });
        } else {
          doc.rect(pageLeft, rowY, labelColWidth, rowHeight).stroke("#000000");
          doc.rect(pageLeft + labelColWidth, rowY, valueColWidth, rowHeight).stroke("#000000");
          doc.fillColor("#000000");
          doc.text(labelText || "-", pageLeft + 5, rowY + 4.5, { width: labelColWidth - 10 });
          doc.text(valueText || "-", pageLeft + labelColWidth + 5, rowY + 4.5, { width: valueColWidth - 10 });
        }

        doc.y = rowY + rowHeight;
      });

      doc.moveDown(0.4);
    });

    doc.end();
  } catch (error: any) {
    console.error("download-final-step-pdf error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error?.message || "Failed to generate final step PDF" });
    }
  }
});

router.post("/download-lou-pdf", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { date, to, subject, taxablePerson, taxPeriod, trn, content, signatoryName, signatoryTitle, companyName } = req.body;

  try {
    const doc = new PDFDocument({ margin: 70, size: 'A4' });

    const filename = `LOU_${(companyName || 'Company').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    doc.pipe(res);

    // Draw Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor('#000000').stroke();

    // Header - Centered and Underlined
    doc.fontSize(14).font('Helvetica-Bold').text('CLIENT DECLARATION & REPRESENTATION LETTER', { align: 'center', underline: true });
    doc.moveDown(2);

    // Date
    doc.fontSize(11).font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(date || '-');
    doc.moveDown(1);

    // To
    doc.font('Helvetica-Bold').text(`To: `, { continued: true }).font('Helvetica').text(to || 'The VAT Consultant LLC');
    doc.moveDown(1);

    // Subject
    doc.font('Helvetica-Bold').text(`Subject: `, { continued: true }).font('Helvetica').text(subject || 'Management Representation regarding Corporate Tax Computation and Filing');
    doc.moveDown(1);

    // Taxable Person
    doc.font('Helvetica-Bold').text(`Taxable Person: `, { continued: true }).font('Helvetica').text(taxablePerson || companyName || '-');
    doc.moveDown(1);

    // Tax Period
    doc.font('Helvetica-Bold').text(`Tax Period: `, { continued: true }).font('Helvetica').text(taxPeriod || '-');
    doc.moveDown(1);

    // TRN
    doc.font('Helvetica-Bold').text(`TRN (Corporate Tax): `, { continued: true }).font('Helvetica').text(trn || '[Insert Company CT TRN]');
    doc.moveDown(2);


    // Content
    doc.font('Helvetica').text(content || '', {
      align: 'justify',
      lineGap: 4
    });

    doc.moveDown(4);

    // Signature Area
    doc.text('For and on behalf of ', { continued: true }).font('Helvetica-Bold').text(companyName || '__________________________');
    doc.moveDown(2);
    doc.font('Helvetica-Bold').text('Authorized Signatory Name: ', { continued: true }).font('Helvetica').text(signatoryName || '__________________________');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Company Stamp:');

    doc.end();
  } catch (error) {
    console.error('LOU PDF Generation Error:', error);
    res.status(500).json({ message: 'Failed to generate LOU PDF' });
  }
});

export default router;
