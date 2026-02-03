import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";

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
  filingData: row.filing_data,
  createdAt: row.created_at
});

router.get("/types", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (_req, res) => {
  try {
    const data = await query('SELECT * FROM ct_types');
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/filing-periods", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { customerId, ctTypeId } = req.query as { customerId?: string; ctTypeId?: string };
  if (!customerId || !ctTypeId) {
    return res.status(400).json({ message: "customerId and ctTypeId are required" });
  }

  try {
    const data: any = await query('SELECT * FROM ct_filing_period WHERE customer_id = ? AND ct_type_id = ? ORDER BY period_from DESC', [customerId, ctTypeId]);
    return res.json(data.map(mapFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/filing-periods", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const period = req.body || {};
  const id = randomUUID();
  try {
    await query(
      'INSERT INTO ct_filing_period (id, user_id, customer_id, ct_type_id, period_from, period_to, due_date, status, filing_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, period.userId, period.customerId, period.ctTypeId, period.periodFrom, period.periodTo, period.dueDate, period.status, period.filingData ? JSON.stringify(period.filingData) : null]
    );
    const [newRow]: any = await query('SELECT * FROM ct_filing_period WHERE id = ?', [id]);
    return res.status(201).json(mapFromDb(newRow));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  try {
    const rows: any = await query('SELECT * FROM ct_filing_period WHERE id = ?', [id]);
    return res.json(rows[0] ? mapFromDb(rows[0]) : null);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const setClauses = [];
  const params = [];

  if (updates.periodFrom) { setClauses.push('period_from = ?'); params.push(updates.periodFrom); }
  if (updates.periodTo) { setClauses.push('period_to = ?'); params.push(updates.periodTo); }
  if (updates.dueDate) { setClauses.push('due_date = ?'); params.push(updates.dueDate); }
  if (updates.status) { setClauses.push('status = ?'); params.push(updates.status); }
  if (updates.filingData !== undefined) { setClauses.push('filing_data = ?'); params.push(updates.filingData ? JSON.stringify(updates.filingData) : null); }

  if (setClauses.length > 0) {
    params.push(id);
    try {
      await query(`UPDATE ct_filing_period SET ${setClauses.join(', ')} WHERE id = ?`, params);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  }


  try {
    const [updated]: any = await query('SELECT * FROM ct_filing_period WHERE id = ?', [id]);
    return res.json(mapFromDb(updated));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/filing-periods/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM ct_filing_period WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
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
      const dates = period.replace('For the period:', '').trim().split('to');
      if (dates.length === 2) {
        periodText = `FOR THE PERIOD FROM ${dates[0].trim()} TO ${dates[1].trim()}`;
      } else {
        periodText = period.toUpperCase();
      }
    }
    doc.fontSize(18).font('Helvetica-Bold').text(periodText, 50, doc.y + 20, { width: centerWidth, align: 'center' });

    // --- PAGE 2: INDEX PAGE ---
    doc.addPage();
    indexPageNum = doc.bufferedPageRange().count;
    drawBorder();

    doc.fillColor('#000000');
    doc.fontSize(12).font('Helvetica-Bold').text((companyName || 'COMPANY NAME').toUpperCase(), 50, 50);
    doc.fontSize(12).font('Helvetica-Bold').text((location || 'DUBAI, UAE').toUpperCase(), 50, doc.y + 2);
    doc.fontSize(12).font('Helvetica-Bold').text('Financial Statements', 50, doc.y + 2);

    const cleanPeriod = period ? period.replace('For the period:', '').trim() : '';
    const dates = cleanPeriod.split('to');
    const endDate = dates.length === 2 ? dates[1].trim() : cleanPeriod;
    doc.fontSize(12).font('Helvetica-Bold').text(`as at ${endDate}`, 50, doc.y + 2);

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
    doc.text(`as at ${endDate}`, 50, 87);
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
    doc.text(`for the period ended ${endDate}`, 50, 87);
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
          doc.text(`as at ${endDate}`, 50, doc.y + 2);
          doc.moveDown(2);
          currentY = doc.y;
          firstNote = false;
        }

        if (currentY > 700) {
          doc.addPage();
          drawBorder();
          currentY = 50;
        }

        const accountLabel = structure.find((s: any) => s.id === accountId)?.label || accountId;

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

export default router;
