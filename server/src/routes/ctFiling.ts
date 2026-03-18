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

  const otherIdx = deduped.findIndex((r) => r?.id === "other_income");
  const profitIdx = deduped.findIndex((r) => r?.id === "profit_loss_year");

  if (otherIdx >= 0 && profitIdx >= 0) {
    const [otherRow] = deduped.splice(otherIdx, 1);
    const updatedOperatingIdx = deduped.findIndex((r) => r?.id === "operating_profit");
    const updatedProfitIdx = deduped.findIndex((r) => r?.id === "profit_loss_year");
    const insertAt = updatedOperatingIdx >= 0 ? updatedOperatingIdx + 1 : updatedProfitIdx;
    deduped.splice(insertAt, 0, otherRow);
  }

  return deduped;
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
    sbrClaimed
  } = req.body;

  try {
    const normalizedPnlStructure = normalizePnlPdfStructure(pnlStructure || []);

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
    const taxPdfFontSize = 10;

    // Enforce a consistent font family + size across the full financial statements PDF.
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
    const originalFontSize = doc.fontSize.bind(doc);
    (doc as any).fontSize = ((_: number) => originalFontSize(10)) as any;

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

    const pageWidth = doc.page.width;
    const centerWidth = pageWidth - 100; // Total width minus margins (50 each side)

    // Helper for Borders
    const drawBorder = () => {
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor('#000000').stroke();
    };

    const drawAuthorizedSignatoryFooter = () => {
      // Keep footer comfortably above bottom so spacing tweaks never spill text to a new page.
      const footerLineY = doc.page.height - 120;
      const footerLabelY = footerLineY + 16;
      const normalizedSignatoryName = String(authorizedSignatoryName || "").trim();
      const nameY = footerLabelY + 18;
      const footerCompanyY = normalizedSignatoryName ? nameY + 18 : footerLabelY + 20;

      doc.moveTo(50, footerLineY).lineTo(doc.page.width - 50, footerLineY).lineWidth(1).strokeColor('#000000').stroke();
      doc.fillColor('#000000').font('Helvetica').fontSize(11).text('Authorized Signatory', 55, footerLabelY, {
        lineBreak: false
      });
      if (normalizedSignatoryName) {
        doc.fillColor('#000000').font('Helvetica').fontSize(11).text(normalizedSignatoryName, 55, nameY, {
          width: doc.page.width - 110,
          lineBreak: false
        });
      }
      doc.fillColor('#000000').font('Helvetica').fontSize(11).text((companyName || '-').toUpperCase(), 55, footerCompanyY, {
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

    // Improved period display
    let periodText = 'FOR THE PERIOD';
    if (period) {
      const { startDate, endDate } = getStartAndEndDates(period);
      if (endDate) {
        periodText = `FOR THE YEAR ENDED ${formatCoverEndDate(endDate)}`;
      } else if (startDate) {
        periodText = `FOR THE YEAR ENDED ${formatCoverEndDate(startDate)}`;
      } else {
        periodText = period.toUpperCase();
      }
    }
    const coverCompany = (companyName || 'COMPANY NAME').toUpperCase();
    const coverLocation = resolvedLocation.toUpperCase();
    const coverTitle = 'FINANCIAL STATEMENTS';
    const coverPeriod = periodText;

    // Center all cover content as one grouped block (horizontally + vertically).
    doc.fontSize(22).font('Helvetica-Bold');
    const companyH = doc.heightOfString(coverCompany, { width: centerWidth, align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold');
    const locationH = doc.heightOfString(coverLocation, { width: centerWidth, align: 'center' });
    doc.fontSize(24).font('Helvetica-Bold');
    const titleH = doc.heightOfString(coverTitle, { width: centerWidth, align: 'center' });
    doc.fontSize(14).font('Helvetica-Bold');
    const periodH = doc.heightOfString(coverPeriod, { width: centerWidth, align: 'center' });

    const companyToLocationGap = 8;
    const blockGap = 90;
    const titleToPeriodGap = 16;
    const totalCoverBlockH =
      companyH + companyToLocationGap + locationH + blockGap + titleH + titleToPeriodGap + periodH;
    let coverY = (doc.page.height - totalCoverBlockH) / 2;

    doc.fontSize(22).font('Helvetica-Bold').text(coverCompany, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += companyH + companyToLocationGap;
    doc.fontSize(16).font('Helvetica-Bold').text(coverLocation, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += locationH + blockGap;
    doc.fontSize(24).font('Helvetica-Bold').text(coverTitle, 50, coverY, { width: centerWidth, align: 'center' });
    coverY += titleH + titleToPeriodGap;
    doc.fontSize(14).font('Helvetica-Bold').text(coverPeriod, 50, coverY, { width: centerWidth, align: 'center' });

    // --- PAGE 2: INDEX PAGE ---
    doc.addPage();
    indexPageNum = doc.bufferedPageRange().count;
    drawBorder();

    doc.fillColor('#000000');
    doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 50);
    doc.fontSize(12).font('Helvetica-Bold').text(resolvedLocation.toUpperCase(), 50, doc.y + 2);
    doc.fontSize(12).font('Helvetica-Bold').text('Financial Statements', 50, doc.y + 2);

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

    const rawGrossProfitMarginPct = revenueForDirectorReport !== 0 ? (grossProfitForDirectorReport / revenueForDirectorReport) * 100 : 0;
    const rawNetProfitMarginPct = revenueForDirectorReport !== 0 ? (netProfitForDirectorReport / revenueForDirectorReport) * 100 : 0;
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
    const shouldHideStatutoryReserve =
      !hasMeaningfulAmount(bsValues?.statutory_reserve?.currentYear) &&
      !hasMeaningfulAmount(bsValues?.statutory_reserve?.previousYear);
    const bsDisplayStructure = (bsStructure || []).filter((item: any) =>
      !(item?.id === "statutory_reserve" && shouldHideStatutoryReserve)
    );

    doc.fontSize(12).font('Helvetica-Bold').text(`as at ${descriptiveEndDate}`, 50, doc.y + 2);

    doc.moveDown(4);
    doc.fontSize(20).font('Helvetica-Bold').text('INDEX', 50, doc.y, { width: centerWidth, align: 'center' });
    doc.moveDown(3);

    const tocY = doc.y;
    doc.fontSize(12).font('Helvetica-Bold').text('Contents', 50, tocY);
    doc.text('Pages', 450, tocY, { width: 90, align: 'right' });
    doc.moveTo(50, tocY + 15).lineTo(doc.page.width - 50, tocY + 15).lineWidth(1).strokeColor('#000000').stroke();

    const tocItemsY = tocY + 40;

    // NO TOC CONTENT HERE - Rendered once at the end to avoid overlap

    // --- PAGE 3: DIRECTOR'S REPORT ---
    doc.addPage();
    directorsPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fillColor('#000000');

    // Match the same top-section style used by other statement pages.
    doc.fontSize(18).font('Helvetica-Bold').text("Director's Report", 50, 50);
    doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
    doc.text(`as at ${descriptiveEndDate}`, 50, 87);

    let directorsY = 102;
    doc.fontSize(10).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, directorsY);
    directorsY += 34;
    doc.fontSize(10).font('Helvetica').text(`The Directors present their financial statements For the period from ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`, 50, directorsY, {
      width: 490
    });

    const metricsStartY = directorsY + 62;
    const rightValueX = 350;
    const rightValueWidth = 150;
    const metricGap = 42;
    const dateHeaderY = metricsStartY - 34;
    const underlineY = dateHeaderY + 22;

    // Right-side date header with underline (as in template image).
    doc.fontSize(10).font('Helvetica-Bold').text(asAtDateForDirectorReport, rightValueX, dateHeaderY, { width: rightValueWidth, align: 'right' });
    doc.moveTo(rightValueX, underlineY).lineTo(rightValueX + rightValueWidth, underlineY).lineWidth(1).strokeColor('#000000').stroke();

    // Keep revenue sentence and first value on the same line.
    doc.fontSize(10).font('Helvetica').text('The company achieved combined revenue of', 50, metricsStartY);
    doc.fontSize(10).font('Helvetica-Bold').text(formatPdfAmount(revenueForDirectorReport), rightValueX, metricsStartY, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Gross Profit/(Loss) for the year', 50, metricsStartY + metricGap);
    doc.fontSize(10).font('Helvetica-Bold').text(formatPdfAmount(grossProfitForDirectorReport), rightValueX, metricsStartY + metricGap, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Net Profit/(Loss) for the year', 50, metricsStartY + metricGap * 2);
    doc.fontSize(10).font('Helvetica-Bold').text(formatPdfAmount(netProfitForDirectorReport), rightValueX, metricsStartY + metricGap * 2, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Gross profit Margin', 50, metricsStartY + metricGap * 3);
    doc.fontSize(10).font('Helvetica-Bold').text(formatPercent(grossProfitMarginPct), rightValueX, metricsStartY + metricGap * 3, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Net profit Margin', 50, metricsStartY + metricGap * 4);
    doc.fontSize(10).font('Helvetica-Bold').text(formatPercent(netProfitMarginPct), rightValueX, metricsStartY + metricGap * 4, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('By order of the Board of Directors', 50, doc.page.height - 260);
    doc.fontSize(10).font('Helvetica').text('Managing Director', 50, doc.page.height - 165);
    doc.fontSize(10).font('Helvetica').text((companyName || 'COMPANY NAME').toUpperCase(), 50, doc.page.height - 135);
    doc.fontSize(10).font('Helvetica').text(resolvedLocation.toUpperCase(), 50, doc.page.height - 105);

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
        doc.fontSize(taxPdfFontSize).font(taxPdfFont).text(resolvedLocation.toUpperCase(), 50, doc.page.height - 78);
      };

      doc.addPage();
      taxCompPageNum = doc.bufferedPageRange().count;
      drawBorder();
      doc.fillColor('#000000');
      doc.fontSize(taxPdfFontSize).font(taxPdfFontBold).text('Corporate Tax Computation Report', 50, 50);
      doc.fontSize(taxPdfFontSize).font(taxPdfFont).text(companyName || 'COMPANY NAME', 50, 75);
      doc.text(`as at ${descriptiveEndDate}`, 50, 87);
      doc.fontSize(taxPdfFontSize).font(taxPdfFontBold).text('(In United Arab Emirates Dirhams)', 50, 106);
      doc.fontSize(taxPdfFontSize).font(taxPdfFontBold).text(
        `Corporate Tax Computation Report for the period ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`,
        50,
        126,
        { width: 500 }
      );

      const headerY = tableTopY;
      doc.rect(tableX, headerY, descWidth, headerHeight).lineWidth(1).strokeColor('#000000').stroke();
      doc.rect(tableX + descWidth, headerY, amountWidth, headerHeight).lineWidth(1).strokeColor('#000000').stroke();
      doc.fontSize(tableHeaderFont).font(taxPdfFontBold).fillColor('#000000');
      const headerTextY = headerY + Math.max(3, Math.floor((headerHeight - 10) / 2));
      doc.text('Description', tableX + cellPaddingX, headerTextY, { width: descWidth - (cellPaddingX * 2), align: 'left', lineBreak: false });
      doc.text('Total Amount (AED)', tableX + descWidth + cellPaddingX, headerTextY, { width: amountWidth - (cellPaddingX * 2), align: 'left', lineBreak: false });

      let rowY = headerY + headerHeight;
      tableEntries.forEach((entry) => {
        const rowHeight = entry.kind === 'section' ? sectionRowHeight : itemRowHeight;
        if (rowY + rowHeight > tableBottomY) return;

        doc.rect(tableX, rowY, descWidth, rowHeight).lineWidth(1).strokeColor('#000000').stroke();
        doc.rect(tableX + descWidth, rowY, amountWidth, rowHeight).lineWidth(1).strokeColor('#000000').stroke();

        if (entry.kind === 'section') {
          doc.fontSize(sectionFont).font(taxPdfFontBold).fillColor('#000000');
          const textY = rowY + Math.max(1, Math.floor((rowHeight - 10) / 2));
          doc.text(entry.text, tableX + cellPaddingX, textY, {
            width: descWidth - (cellPaddingX * 2),
            align: 'left',
            lineBreak: false
          });
          doc.text('-', tableX + descWidth + cellPaddingX, textY, {
            width: amountWidth - (cellPaddingX * 2),
            align: 'left',
            lineBreak: false
          });
        } else {
          doc.fontSize(itemFont).font(entry.isKey ? taxPdfFontBold : taxPdfFont).fillColor('#000000');
          const textY = rowY + Math.max(1, Math.floor((rowHeight - 10) / 2));
          doc.text(entry.text, tableX + cellPaddingX, textY, {
            width: descWidth - (cellPaddingX * 2),
            align: 'left',
            lineBreak: false
          });
          const amountDisplay = entry.isNil ? '- NIL -' : formatPdfAmount(entry.value);
          doc.text(amountDisplay, tableX + descWidth + cellPaddingX, textY, {
            width: amountWidth - (cellPaddingX * 2),
            align: 'left',
            lineBreak: false
          });
        }

        rowY += rowHeight;
      });

      drawTaxFooter();
      taxCompEndPageNum = taxCompPageNum;
    }

    // --- PAGE 4: BALANCE SHEET (Statement of Financial Position) ---
    const drawBsPageHeader = (continued = false) => {
      drawBorder();
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(
        `Statement of Financial Position${continued ? ' (continued)' : ''}`,
        50,
        50
      );
      doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
      doc.text(`as at ${descriptiveEndDate}`, 50, 87);
      doc.fontSize(10).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, 106);

      const bsTableTop = 150;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, bsTableTop);
      yearColumns.forEach((col) => {
        doc.text(col.label, col.x, bsTableTop, { width: col.width, align: 'right' });
      });
      doc.moveTo(50, bsTableTop + 15).lineTo(yearColumnsRightEdge, bsTableTop + 15).strokeColor('#000000').stroke();
      return bsTableTop + 25;
    };

    const measureBsRowReq = (item: any) => {
      const topPad = (item.type === 'header' || item.type === 'subheader') ? 5 : ((item.type === 'total' || item.type === 'grand_total') ? 2 : 0);
      const sanitizedLabel = String(item.label || '').replace(/:\s*$/, '');
      const label = item.type === 'item' ? `    ${sanitizedLabel}` : sanitizedLabel;

      if (item.type === 'header' || item.type === 'subheader' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10);
      } else {
        doc.font('Helvetica').fontSize(10);
      }

      const labelHeight = doc.heightOfString(String(label || ''), { width: 280 });
      const base = (item.type === 'total' || item.type === 'grand_total') ? 24 : 15;
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
      const label = item.type === 'item' ? `    ${sanitizedLabel}` : sanitizedLabel;
      const rowTopPad = (item.type === 'header' || item.type === 'subheader') ? 5 : ((item.type === 'total' || item.type === 'grand_total') ? 2 : 0);
      const labelWidth = 280;

      if (item.type === 'header' || item.type === 'subheader' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }
      const labelHeight = doc.heightOfString(String(label || ''), { width: labelWidth });
      const baseRowAdvance = (item.type === 'total' || item.type === 'grand_total') ? 24 : 15;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 2);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          const formattedValue = formatPnlPdfAmount(rawValue, item.id);
          doc.font((item.type === 'total' || item.type === 'grand_total') ? 'Helvetica-Bold' : 'Helvetica');
          doc.text(formattedValue, col.x, currentY, { width: col.width, align: 'right' });
        });
      }

      if (item.type === 'total' || item.type === 'grand_total') {
        // Add top line at totals as per statement style.
        drawYearAmountLine(currentY - 5, 0.75);
        // Draw underline BELOW totals only (no upper overlapping line).
        drawYearAmountLine(currentY + 18, 0.9);

        if (item.type === 'grand_total') {
          drawYearAmountLine(currentY + 21, 0.9);
        }
      }

      currentY += rowAdvance;
    }
    bsEndPageNum = doc.bufferedPageRange().count;

    // --- PAGE 4: PROFIT & LOSS (Statement of Comprehensive Income) ---
    const drawPnlPageHeader = (continued = false) => {
      drawBorder();
      doc.fillColor('#000000');
      doc.fontSize(18).font('Helvetica-Bold').text(
        `Statement of Comprehensive Income${continued ? ' (continued)' : ''}`,
        50,
        50
      );
      doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
      doc.text(`for the period ended ${descriptiveEndDate}`, 50, 87);
      doc.fontSize(10).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, 106);

      const tableTop = 150;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      yearColumns.forEach((col) => {
        doc.text(col.label, col.x, tableTop, { width: col.width, align: 'right' });
      });
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
      const label = item.indent ? `    ${sanitizedLabel}` : sanitizedLabel;
      const rowTopPad = (item.type === 'header' || item.type === 'subsection_header') ? 5 : (item.type === 'total' ? 2 : 0);
      const labelWidth = 280;

      if (item.type === 'header') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (item.type === 'subsection_header') {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }
      const labelHeight = doc.heightOfString(String(label || ''), { width: labelWidth });
      const baseRowAdvance = item.type === 'total' ? 24 : 15;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 2);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      if (item.type === 'item' || item.type === 'total') {
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          const formattedValue = formatPnlPdfAmount(rawValue, item.id);
          const isProfitAfterTax = item.id === 'profit_after_tax';
          doc.font((item.type === 'total' || isProfitAfterTax) ? 'Helvetica-Bold' : 'Helvetica');
          doc.text(formattedValue, col.x, currentY, { width: col.width, align: 'right' });
        });
      }

      if (item.type === 'total') {
        // Add top line at totals as per statement style.
        drawYearAmountLine(currentY - 5, 0.75);
        // Draw clean underline BELOW totals only.
        drawYearAmountLine(currentY + 18, 0.9);
      }
      if (item.id === 'profit_after_tax') {
        // Line above and below Profit after Tax.
        drawYearAmountLine(currentY - 3, 0.75);
        drawYearAmountLine(currentY + 18, 0.9);
      }

      currentY += rowAdvance;
    }
    pnlEndPageNum = doc.bufferedPageRange().count;

    // --- PAGE 5: STATEMENT OF CHANGES IN EQUITY ---
    doc.addPage();
    equityPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fillColor('#000000');
    doc.fontSize(18).font('Helvetica-Bold').text('Statement of Changes in Equity', 50, 50);
    doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
    doc.text(`for the period ended ${descriptiveEndDate}`, 50, 87);
    doc.fontSize(10).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, 106);
    doc.moveDown(1);

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

    const equityTableTop = 150;
    const tableLeft = 50;
    const tableRight = doc.page.width - 50;
    const tableWidth = tableRight - tableLeft;
    const descColWidth = 190;
    const valueColCount = Math.max(1, equityItems.length + 1); // + Total column
    const valueColWidth = (tableWidth - descColWidth) / valueColCount;
    const valuesStartX = tableLeft + descColWidth;

    // Table Header
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
    const headerHeight = Math.max(
      ...headerCells.map((cell) =>
        doc.heightOfString(cell.text, { width: cell.width, align: cell.align, lineBreak: true })
      ),
      12
    ) + 4;

    headerCells.forEach((cell) => {
      doc.text(cell.text, cell.x, equityTableTop, { width: cell.width, align: cell.align, lineBreak: true });
    });

    doc.moveTo(tableLeft, equityTableTop + headerHeight + 4).lineTo(tableRight, equityTableTop + headerHeight + 4).strokeColor('#000000').stroke();

    let equityY = equityTableTop + headerHeight + 12;

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
        rowTotal += val;
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

    // 1. Balance at start
    const startYearDate = new Date(endDate);
    startYearDate.setMonth(0, 1); // January 1st
    const descriptiveStartYearDate = formatDescriptiveDate(startYearDate.toISOString().split('T')[0]);

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
    // Accounting style: one line above final values and double line below final values.
    drawEquityValueAreaLine(finalEquityRow.valueTextY - 3, 0.9);
    drawEquityValueAreaLine(finalEquityRow.valueTextY + 13, 0.9);
    equityEndPageNum = doc.bufferedPageRange().count;

    // --- WORKING NOTES Helper ---
    const renderNotesBlock = (
      workingNotes: Record<string, any[]>,
      structure: any[],
      mainTitle: string,
      formatPnlExpenses = false
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

      Object.keys(workingNotes || {}).forEach((accountId) => {
        const notes = workingNotes[accountId];
        if (!notes || notes.length === 0) return;

        if (firstNote) {
          doc.addPage();
          startPage = doc.bufferedPageRange().count;
          drawBorder();
          doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(mainTitle, 50, 50);
          doc.fontSize(10).font('Helvetica').text(companyName, 50, doc.y + 10);
          doc.text(`as at ${descriptiveEndDate}`, 50, doc.y + 2);
          doc.fontSize(10).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, doc.y + 8);
          doc.moveDown(1);
          currentY = doc.y;
          firstNote = false;
        }

        const accountLabel = String(structure.find(s => s.id === accountId)?.label || accountId).replace(/:\s*$/, '');
        const rowHeights = notes.map(measureNoteRowHeight);
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
          const heading = continued ? `${accountLabel.toUpperCase()} (CONTINUED)` : accountLabel.toUpperCase();
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
        const firstRowHeight = measureNoteRowHeight(notes[0]);
        const minSectionStartReq = 15 + 10 + 15 + firstRowHeight + 30;
        if (currentY + minSectionStartReq > contentBottomWithFooterY) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }

        drawAccountSectionHeader(false);

        let noteTotalCurrent = 0;
        let noteTotalPrevious = 0;

        notes.forEach((note) => {
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

          const curVal = note.currentYearAmount ?? note.amount ?? 0;
          const preVal = note.previousYearAmount ?? 0;

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
        currentY += 25;
        endPage = doc.bufferedPageRange().count;
      });

      if (!endPage && startPage) {
        endPage = doc.bufferedPageRange().count;
      }

      return { startPage, endPage };
    };

    // Render BS and P&L notes separately
    const bsNotesPages = renderNotesBlock(bsWorkingNotes, bsStructure, 'Schedule of Notes forming Part of Financial Position');
    bsNotesPageNum = bsNotesPages.startPage;
    bsNotesEndPageNum = bsNotesPages.endPage;

    const pnlNotesPages = renderNotesBlock(
      pnlWorkingNotes,
      normalizedPnlStructure,
      'Schedule of Notes forming Part of Comprehensive Income',
      true
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
      doc.text(label, 50, currentTocY);
      doc.text(pageText, 450, currentTocY, { width: 90, align: 'right' });
      currentTocY += 25;
    };

    addTocItem("Director's Report", directorsPageNum, taxCompPageNum ? (taxCompPageNum - 1) : (bsPageNum ? (bsPageNum - 1) : directorsPageNum));
    addTocItem('Corporate Tax Computation Report', taxCompPageNum, taxCompEndPageNum);
    addTocItem('Statement of Financial Position', bsPageNum, bsEndPageNum);
    addTocItem('Statement of Comprehensive Income', pnlPageNum, pnlEndPageNum);
    addTocItem('Statement of Changes in Equity', equityPageNum, equityEndPageNum);
    addTocItem('Schedule of Notes forming Part of Financial Position', bsNotesPageNum, bsNotesEndPageNum);
    addTocItem('Schedule of Notes forming Part of Comprehensive Income', pnlNotesPageNum, pnlNotesEndPageNum);

    const signatoryFooterPages = new Set<number>(
      [bsEndPageNum, pnlEndPageNum, equityEndPageNum, bsNotesEndPageNum, pnlNotesEndPageNum].filter((n) => Number.isFinite(n) && n > 0)
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
