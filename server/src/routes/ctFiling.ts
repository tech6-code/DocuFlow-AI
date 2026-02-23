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
  const { companyName, period, pnlStructure, pnlValues, bsStructure, bsValues, location, pnlWorkingNotes, bsWorkingNotes } = req.body;

  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    // Set response headers
    const filename = `${(companyName || 'Financial_Report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    doc.pipe(res);

    // Section Page Trackers
    let indexPageNum = 0;
    let pnlPageNum = 0;
    let bsPageNum = 0;
    let equityPageNum = 0;
    let bsNotesPageNum = 0;
    let pnlNotesPageNum = 0;

    const pageWidth = doc.page.width;
    const centerWidth = pageWidth - 100; // Total width minus margins (50 each side)

    // Helper for Borders
    const drawBorder = () => {
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor('#000000').stroke();
    };

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
    const descriptiveEndDate = formatDescriptiveDate(endDate);
    const descriptiveStartDate = formatDescriptiveDate(startDate);

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

    // --- PAGE 3: BALANCE SHEET (Statement of Financial Position) ---
    doc.addPage();
    bsPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text('Statement of Financial Position', 50, 50);
    doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
    doc.text(`as at ${descriptiveEndDate}`, 50, 87);
    doc.moveDown(2);

    // Table Header
    const bsTableTop = 130;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, bsTableTop);
    doc.text('Current Year', 350, bsTableTop, { width: 100, align: 'right' });
    doc.text('Previous Year', 460, bsTableTop, { width: 100, align: 'right' });

    doc.moveTo(50, bsTableTop + 15).lineTo(540, bsTableTop + 15).strokeColor('#000000').stroke();

    let currentY = bsTableTop + 25;

    bsStructure.forEach((item: any) => {
      if (currentY > 730) {
        doc.addPage();
        drawBorder();
        currentY = 50;
      }

      const values = bsValues[item.id] || { currentYear: 0, previousYear: 0 };
      const label = item.type === 'item' ? `    ${item.label}` : item.label;

      if (item.type === 'header' || item.type === 'subheader' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
        if (item.type === 'header' || item.type === 'subheader') currentY += 5;
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }

      doc.text(label, 50, currentY);

      if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
        doc.font('Helvetica');
        doc.text(Math.round(values.currentYear).toLocaleString(), 350, currentY, { width: 100, align: 'right' });
        doc.text(Math.round(values.previousYear).toLocaleString(), 460, currentY, { width: 100, align: 'right' });
      }

      if (item.type === 'total' || item.type === 'grand_total') {
        doc.moveTo(350, currentY + 12).lineTo(540, currentY + 12).strokeColor('#000000').stroke();
        if (item.type === 'grand_total') {
          doc.moveTo(350, currentY + 14).lineTo(540, currentY + 14).strokeColor('#000000').stroke();
        }
        currentY += 5;
      }

      currentY += 15;
    });

    // --- PAGE 4: PROFIT & LOSS (Statement of Comprehensive Income) ---
    doc.addPage();
    pnlPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fillColor('#000000');
    doc.fontSize(18).font('Helvetica-Bold').text('Statement of Comprehensive Income', 50, 50);
    doc.fontSize(10).font('Helvetica').text(companyName, 50, 75);
    doc.text(`for the period ended ${descriptiveEndDate}`, 50, 87);
    doc.moveDown(2);

    // Table Header
    const tableTop = 130;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Current Year', 350, tableTop, { width: 100, align: 'right' });
    doc.text('Previous Year', 460, tableTop, { width: 100, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#000000').stroke();

    currentY = tableTop + 25;

    pnlStructure.forEach((item: any) => {
      // Check for page overflow
      if (currentY > 730) {
        doc.addPage();
        drawBorder();
        currentY = 50;
      }

      const values = pnlValues[item.id] || { currentYear: 0, previousYear: 0 };
      const label = item.indent ? `    ${item.label}` : item.label;

      if (item.type === 'header') {
        currentY += 5;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (item.type === 'subsection_header') {
        currentY += 5;
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666');
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
      }

      doc.text(label, 50, currentY);

      if (item.type === 'item' || item.type === 'total') {
        doc.font('Helvetica');
        doc.text(Math.round(values.currentYear).toLocaleString(), 350, currentY, { width: 100, align: 'right' });
        doc.text(Math.round(values.previousYear).toLocaleString(), 460, currentY, { width: 100, align: 'right' });
      }

      if (item.type === 'total') {
        doc.moveTo(350, currentY + 12).lineTo(540, currentY + 12).strokeColor('#000000').stroke();
        doc.moveTo(350, currentY + 14).lineTo(540, currentY + 14).strokeColor('#000000').stroke();
        currentY += 5;
      }

      currentY += 15;
    });

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
    bsStructure.forEach((item: any) => {
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
        doc.text(Math.round(val).toLocaleString(), 150 + (idx * colWidth), equityY, { width: colWidth, align: 'right' });
      });
      doc.text(Math.round(rowTotal).toLocaleString(), 150 + (equityItems.length * colWidth), equityY, { width: colWidth, align: 'right' });
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

    // --- WORKING NOTES Helper ---
    const renderNotesBlock = (workingNotes: Record<string, any[]>, structure: any[], mainTitle: string) => {
      let firstNote = true;
      let startPage = 0;

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

        if (currentY > 700) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }

        const accountLabel = structure.find(s => s.id === accountId)?.label || accountId;

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(accountLabel.toUpperCase(), 50, currentY);
        currentY += 15;
        doc.moveTo(50, currentY).lineTo(540, currentY).lineWidth(0.5).strokeColor('#000000').stroke();
        currentY += 10;

        // Table Header
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#666666');
        doc.text('Description', 60, currentY);
        doc.text('Current Year', 350, currentY, { width: 90, align: 'right' });
        doc.text('Previous Year', 450, currentY, { width: 90, align: 'right' });
        currentY += 15;

        let noteTotalCurrent = 0;
        let noteTotalPrevious = 0;

        notes.forEach((note) => {
          if (currentY > 750) {
            doc.addPage();
            drawBorder();
            currentY = 50;
          }

          doc.fontSize(9).font('Helvetica').fillColor('#333333');
          const startNoteY = currentY;
          doc.text(note.description || '-', 60, currentY, { width: 280 });
          const noteTextHeight = doc.heightOfString(note.description || '-', { width: 280 });

          const curVal = note.currentYearAmount ?? note.amount ?? 0;
          const preVal = note.previousYearAmount ?? 0;

          doc.text(Math.round(curVal).toLocaleString(), 350, startNoteY, { width: 90, align: 'right' });
          doc.text(Math.round(preVal).toLocaleString(), 450, startNoteY, { width: 90, align: 'right' });

          noteTotalCurrent += curVal;
          noteTotalPrevious += preVal;
          currentY = startNoteY + Math.max(noteTextHeight, 12) + 4;
        });

        // Subtotal for note
        doc.moveTo(350, currentY).lineTo(540, currentY).lineWidth(0.5).strokeColor('#000000').stroke();
        currentY += 5;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('Total', 60, currentY);
        doc.text(Math.round(noteTotalCurrent).toLocaleString(), 350, currentY, { width: 90, align: 'right' });
        doc.text(Math.round(noteTotalPrevious).toLocaleString(), 450, currentY, { width: 90, align: 'right' });
        currentY += 25;
      });

      return startPage;
    };

    // Render BS and P&L notes separately
    bsNotesPageNum = renderNotesBlock(bsWorkingNotes, bsStructure, 'Schedule of Notes forming Part of Financial Position');
    pnlNotesPageNum = renderNotesBlock(pnlWorkingNotes, pnlStructure, 'Schedule of Notes forming Part of Comprehensive Income');

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

    addTocItem('Statement of Financial Position', bsPageNum);
    addTocItem('Statement of Comprehensive Income', pnlPageNum);
    addTocItem('Statement of Changes in Equity', equityPageNum);
    addTocItem('Schedule of Notes forming Part of Financial Position', bsNotesPageNum);
    addTocItem('Schedule of Notes forming Part of Comprehensive Income', pnlNotesPageNum);

    // Add Page Numbers in Footers
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor('#999999').text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 35, { align: 'center', lineBreak: false });
      doc.page.margins.bottom = oldBottomMargin;
    }

    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
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

    // Dear Management
    doc.font('Helvetica').text('Dear Management,');
    doc.moveDown(1);

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
    doc.font('Helvetica-Bold').text('Designation: ', { continued: true }).font('Helvetica').text(signatoryTitle || '__________________________');
    doc.moveDown(1);
    doc.font('Helvetica-Bold').text('Company Stamp:');

    doc.end();
  } catch (error) {
    console.error('LOU PDF Generation Error:', error);
    res.status(500).json({ message: 'Failed to generate LOU PDF' });
  }
});

export default router;
