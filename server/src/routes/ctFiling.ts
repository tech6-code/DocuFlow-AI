import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";
import PDFDocument from "pdfkit";

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
  const formatted = Math.abs(rounded).toLocaleString();
  if (rounded < 0) return `(${formatted})`;
  return formatted;
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
  const { companyName, period, pnlStructure, pnlValues, bsStructure, bsValues, location, pnlWorkingNotes, bsWorkingNotes, authorizedSignatoryName } = req.body;

  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    // Set response headers
    const filename = `${(companyName || 'Financial_Report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    doc.pipe(res);

    // Section Page Trackers
    let indexPageNum = 0;
    let directorsPageNum = 0;
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

    // Centering all details as per Image 1
    doc.fontSize(22).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 150, { width: centerWidth, align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold').text((location || 'DUBAI, UAE').toUpperCase(), 50, doc.y + 5, { width: centerWidth, align: 'center' });

    doc.fontSize(24).font('Helvetica-Bold').text('FINANCIAL STATEMENTS', 50, 400, { width: centerWidth, align: 'center' });

    // Improved period display
    let periodText = 'FOR THE PERIOD';
    if (period) {
      const { startDate, endDate } = getStartAndEndDates(period);
      if (startDate && endDate) {
        periodText = `FOR THE PERIOD FROM ${formatDescriptiveDate(startDate).toUpperCase()} TO ${formatDescriptiveDate(endDate).toUpperCase()}`;
      } else {
        periodText = period.toUpperCase();
      }
    }
    doc.fontSize(14).font('Helvetica-Bold').text(periodText, 50, doc.y + 20, { width: centerWidth, align: 'center' });

    // --- PAGE 2: INDEX PAGE ---
    doc.addPage();
    indexPageNum = doc.bufferedPageRange().count;
    drawBorder();

    doc.fillColor('#000000');
    doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 50);
    doc.fontSize(12).font('Helvetica-Bold').text((location || 'DUBAI, UAE').toUpperCase(), 50, doc.y + 2);
    doc.fontSize(12).font('Helvetica-Bold').text('Financial Statements', 50, doc.y + 2);

    const { startDate, endDate } = getStartAndEndDates(period || '');
    const { currentYearLabel, previousYearLabel } = getYearLabelsFromPeriod(period || "");
    const descriptiveEndDate = formatDescriptiveDate(endDate);
    const descriptiveStartDate = formatDescriptiveDate(startDate);
    const periodStartForDirectorReport = formatDateDdMmYyyy(startDate);
    const periodEndForDirectorReport = formatDateDdMmYyyy(endDate || startDate);
    const asAtDateForDirectorReport = formatMonthDayYear(endDate || startDate);
    const valueByNormalizedLabel: Record<string, number> = {};
    (pnlStructure || []).forEach((item: any) => {
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

    const grossProfitMarginPct = revenueForDirectorReport !== 0 ? (grossProfitForDirectorReport / revenueForDirectorReport) * 100 : 0;
    const netProfitMarginPct = revenueForDirectorReport !== 0 ? (netProfitForDirectorReport / revenueForDirectorReport) * 100 : 0;
    const formatPercent = (value: number) => {
      if (!Number.isFinite(value)) return "0%";
      const abs = Math.abs(value);
      if (abs >= 1) return `${Math.round(value)}%`;
      return `${value.toFixed(2).replace(/\.?0+$/, "")}%`;
    };
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

    const notesYearColumns = [
      showCurrentYearColumn ? { key: "current", label: currentYearLabel, x: 350, width: 90 } : null,
      showPreviousYearColumn ? { key: "previous", label: previousYearLabel, x: 450, width: 90 } : null
    ].filter(Boolean) as { key: "current" | "previous"; label: string; x: number; width: number }[];
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
    doc.moveTo(50, tocY + 15).lineTo(540, tocY + 15).lineWidth(1).strokeColor('#000000').stroke();

    const tocItemsY = tocY + 40;

    // NO TOC CONTENT HERE - Rendered once at the end to avoid overlap

    // --- PAGE 3: DIRECTOR'S REPORT ---
    doc.addPage();
    directorsPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fillColor('#000000');

    doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 70);
    doc.fontSize(12).font('Helvetica-Bold').text((location || 'DUBAI, UAE').toUpperCase(), 50, 100);

    doc.fontSize(12).font('Helvetica').text((location || 'DUBAI, UAE').toUpperCase(), 390, 70, { width: 150, align: 'right' });
    doc.fontSize(12).font('Helvetica').text(`as at ${asAtDateForDirectorReport}`, 360, 100, { width: 180, align: 'right' });

    let directorsY = 160;
    doc.fontSize(12).font('Helvetica-Bold').text(`Director's Report For the period from ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`, 50, directorsY);
    directorsY += 30;
    doc.fontSize(12).font('Helvetica-Bold').text('(In United Arab Emirates Dirhams)', 50, directorsY);
    directorsY += 30;
    doc.fontSize(10).font('Helvetica').text(`The Directors present their financial statements For the period from ${periodStartForDirectorReport} to ${periodEndForDirectorReport}`, 50, directorsY, {
      width: 490
    });

    const metricsStartY = directorsY + 88;
    const rightValueX = 350;
    const rightValueWidth = 190;
    const metricGap = 42;
    const dateHeaderY = metricsStartY - 46;
    const underlineY = dateHeaderY + 24;

    // Right-side date header with underline (as in template image).
    doc.fontSize(12).font('Helvetica-Bold').text(asAtDateForDirectorReport, rightValueX, dateHeaderY, { width: rightValueWidth, align: 'right' });
    doc.moveTo(rightValueX, underlineY).lineTo(rightValueX + rightValueWidth, underlineY).lineWidth(1).strokeColor('#000000').stroke();

    // Keep revenue sentence and first value on the same line.
    doc.fontSize(10).font('Helvetica').text('The company achieved combined revenue of', 50, metricsStartY);
    doc.fontSize(12).font('Helvetica-Bold').text(formatPdfAmount(revenueForDirectorReport), rightValueX, metricsStartY, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Gross profit / (Loss)', 50, metricsStartY + metricGap);
    doc.fontSize(12).font('Helvetica-Bold').text(formatPdfAmount(grossProfitForDirectorReport), rightValueX, metricsStartY + metricGap, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('The net profit / (Loss) for the year', 50, metricsStartY + metricGap * 2);
    doc.fontSize(12).font('Helvetica-Bold').text(formatPdfAmount(netProfitForDirectorReport), rightValueX, metricsStartY + metricGap * 2, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Gross profit Margin', 50, metricsStartY + metricGap * 3);
    doc.fontSize(12).font('Helvetica-Bold').text(formatPercent(grossProfitMarginPct), rightValueX, metricsStartY + metricGap * 3, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('Net profit Margin', 50, metricsStartY + metricGap * 4);
    doc.fontSize(12).font('Helvetica-Bold').text(formatPercent(netProfitMarginPct), rightValueX, metricsStartY + metricGap * 4, { width: rightValueWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').text('By order of the Board of Directors', 50, doc.page.height - 260);
    doc.fontSize(10).font('Helvetica').text('Managing Director', 50, doc.page.height - 165);
    doc.fontSize(10).font('Helvetica').text((companyName || 'COMPANY NAME').toUpperCase(), 50, doc.page.height - 135);
    doc.fontSize(10).font('Helvetica').text((location || 'DUBAI, UAE').toUpperCase(), 50, doc.page.height - 105);

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

      const bsTableTop = 130;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, bsTableTop);
      yearColumns.forEach((col) => {
        doc.text(col.label, col.x, bsTableTop, { width: col.width, align: 'right' });
      });
      doc.moveTo(50, bsTableTop + 15).lineTo(540, bsTableTop + 15).strokeColor('#000000').stroke();
      return bsTableTop + 25;
    };

    const measureBsRowReq = (item: any) => {
      const topPad = (item.type === 'header' || item.type === 'subheader') ? 5 : 0;
      const label = item.type === 'item' ? `    ${item.label}` : item.label;

      if (item.type === 'header' || item.type === 'subheader' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10);
      } else {
        doc.font('Helvetica').fontSize(10);
      }

      const labelHeight = doc.heightOfString(String(label || ''), { width: 280 });
      const base = (item.type === 'total' || item.type === 'grand_total') ? 20 : 15;
      const body = Math.max(base, labelHeight + 2);
      const totalExtra = (item.type === 'total' || item.type === 'grand_total') ? 2 : 0;
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
      const label = item.type === 'item' ? `    ${item.label}` : item.label;
      const rowTopPad = (item.type === 'header' || item.type === 'subheader') ? 5 : 0;
      const labelWidth = 280;

      if (item.type === 'header' || item.type === 'subheader' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }
      const labelHeight = doc.heightOfString(String(label || ''), { width: labelWidth });
      const baseRowAdvance = (item.type === 'total' || item.type === 'grand_total') ? 20 : 15;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 2);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica');
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          doc.text(formatPdfAmount(rawValue), col.x, currentY, { width: col.width, align: 'right' });
        });
      }

      // Draw underline ABOVE total or grand_total (on the previous line's value)
      if (item.type === 'total' || item.type === 'grand_total') {
        yearColumns.forEach((col) => {
          doc
            .moveTo(col.x + 25, currentY - 2)
            .lineTo(col.x + 100, currentY - 2)
            .lineWidth(0.5)
            .strokeColor('#000000')
            .stroke();
        });
      }

      if (item.type === 'total' || item.type === 'grand_total') {
        // Split bottom lines
        yearColumns.forEach((col) => {
          doc
            .moveTo(col.x + 25, currentY + 12)
            .lineTo(col.x + 100, currentY + 12)
            .lineWidth(1)
            .strokeColor('#000000')
            .stroke();
        });

        if (item.type === 'grand_total') {
          yearColumns.forEach((col) => {
            doc
              .moveTo(col.x + 25, currentY + 14)
              .lineTo(col.x + 100, currentY + 14)
              .lineWidth(1)
              .strokeColor('#000000')
              .stroke();
          });
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

      const tableTop = 130;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      yearColumns.forEach((col) => {
        doc.text(col.label, col.x, tableTop, { width: col.width, align: 'right' });
      });
      doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#000000').stroke();
      return tableTop + 25;
    };

    const measurePnlRowReq = (item: any) => {
      const topPad = (item.type === 'header' || item.type === 'subsection_header') ? 5 : 0;
      const label = item.indent ? `    ${item.label}` : item.label;

      if (item.type === 'header' || item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10);
      } else if (item.type === 'subsection_header') {
        doc.font('Helvetica-Oblique').fontSize(9);
      } else {
        doc.font('Helvetica').fontSize(10);
      }

      const labelHeight = doc.heightOfString(String(label || ''), { width: 280 });
      const base = item.type === 'total' ? 20 : 15;
      const body = Math.max(base, labelHeight + 2);
      const totalExtra = item.type === 'total' ? 2 : 0;
      return topPad + body + totalExtra;
    };

    doc.addPage();
    pnlPageNum = doc.bufferedPageRange().count;
    currentY = drawPnlPageHeader(false);

    for (let idx = 0; idx < pnlStructure.length; idx++) {
      const item: any = pnlStructure[idx];
      const currentRowReq = measurePnlRowReq(item);
      const remainingReq = pnlStructure
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
      const label = item.indent ? `    ${item.label}` : item.label;
      const rowTopPad = (item.type === 'header' || item.type === 'subsection_header') ? 5 : 0;
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
      const baseRowAdvance = item.type === 'total' ? 20 : 15;
      const rowAdvance = Math.max(baseRowAdvance, labelHeight + 2);

      currentY += rowTopPad;

      doc.text(label, 50, currentY, { width: labelWidth });

      if (item.type === 'item' || item.type === 'total') {
        doc.font('Helvetica');
        yearColumns.forEach((col) => {
          const rawValue = col.key === "current" ? values.currentYear : values.previousYear;
          doc.text(formatPdfAmount(rawValue), col.x, currentY, { width: col.width, align: 'right' });
        });
      }

      // Draw underline ABOVE total (on the previous line's value)
      if (item.type === 'total') {
        yearColumns.forEach((col) => {
          doc
            .moveTo(col.x + 25, currentY - 2)
            .lineTo(col.x + 100, currentY - 2)
            .lineWidth(0.5)
            .strokeColor('#000000')
            .stroke();
        });

        // Split double underline BELOW total
        yearColumns.forEach((col) => {
          doc
            .moveTo(col.x + 25, currentY + 12)
            .lineTo(col.x + 100, currentY + 12)
            .lineWidth(1)
            .strokeColor('#000000')
            .stroke();
          doc
            .moveTo(col.x + 25, currentY + 15)
            .lineTo(col.x + 100, currentY + 15)
            .lineWidth(1)
            .strokeColor('#000000')
            .stroke();
        });
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
    doc.moveDown(2);

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

    const equityTableTop = 130;
    const colWidth = 400 / (equityItems.length + 1); // Width for items + Total column

    // Table Header
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Description', 50, equityTableTop, { width: 100 });
    equityItems.forEach((item, idx) => {
      doc.text(item.label, 150 + (idx * colWidth), equityTableTop, { width: colWidth, align: 'right' });
    });
    doc.text('Total', 150 + (equityItems.length * colWidth), equityTableTop, { width: colWidth, align: 'right' });

    doc.moveTo(50, equityTableTop + 20).lineTo(550, equityTableTop + 20).strokeColor('#000000').stroke();

    let equityY = equityTableTop + 30;

    const renderEquityRow = (label: string, getVal: (item: any) => number, isBold = false) => {
      if (isBold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fontSize(8);
      doc.text(label, 50, equityY, { width: 100 });
      let rowTotal = 0;
      equityItems.forEach((item, idx) => {
        const val = getVal(item);
        rowTotal += val;
        doc.text(formatPdfAmount(val), 150 + (idx * colWidth), equityY, { width: colWidth, align: 'right' });
      });
      doc.text(formatPdfAmount(rowTotal), 150 + (equityItems.length * colWidth), equityY, { width: colWidth, align: 'right' });
      equityY += 20;
    };

    const profit = pnlValues['profit_loss_year']?.currentYear || 0;

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
    doc.moveTo(150, equityY - 5).lineTo(550, equityY - 5).strokeColor('#000000').stroke();
    renderEquityRow('Balance as at ' + descriptiveEndDate, (item) => bsValues[item.id]?.currentYear || 0, true);
    doc.moveTo(150, equityY - 5).lineTo(550, equityY - 5).strokeColor('#000000').stroke();
    doc.moveTo(150, equityY - 3).lineTo(550, equityY - 3).strokeColor('#000000').stroke();
    equityEndPageNum = doc.bufferedPageRange().count;

    // --- WORKING NOTES Helper ---
    const renderNotesBlock = (workingNotes: Record<string, any[]>, structure: any[], mainTitle: string) => {
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
          doc.moveDown(2);
          currentY = doc.y;
          firstNote = false;
        }

        const accountLabel = structure.find(s => s.id === accountId)?.label || accountId;
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
          doc.moveTo(50, currentY).lineTo(540, currentY).lineWidth(0.5).strokeColor('#000000').stroke();
          currentY += 10;

          doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666');
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
            doc.text(formatPdfAmount(rawValue), col.x, startNoteY, { width: col.width, align: 'right' });
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
          doc.text(formatPdfAmount(rawValue), col.x, currentY, { width: col.width, align: 'right' });
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

    const pnlNotesPages = renderNotesBlock(pnlWorkingNotes, pnlStructure, 'Schedule of Notes forming Part of Comprehensive Income');
    pnlNotesPageNum = pnlNotesPages.startPage;
    pnlNotesEndPageNum = pnlNotesPages.endPage;

    // Finalize Pages and Dynamic TOC
    const range = doc.bufferedPageRange();

    // Update TOC on Page 2
    doc.switchToPage(indexPageNum - 1);
    doc.fontSize(11).font('Helvetica').fillColor('#000000');

    let currentTocY = tocItemsY;
    const addTocItem = (label: string, pageNum: number) => {
      if (!pageNum) return;
      doc.text(label, 50, currentTocY);
      doc.text(String(pageNum), 450, currentTocY, { width: 90, align: 'right' });
      currentTocY += 25;
    };

    addTocItem("Director's Report", directorsPageNum);
    addTocItem('Statement of Financial Position', bsPageNum);
    addTocItem('Statement of Comprehensive Income', pnlPageNum);
    addTocItem('Statement of Changes in Equity', equityPageNum);
    addTocItem('Schedule of Notes forming Part of Financial Position', bsNotesPageNum);
    addTocItem('Schedule of Notes forming Part of Comprehensive Income', pnlNotesPageNum);

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
