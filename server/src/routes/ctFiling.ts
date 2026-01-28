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

router.get("/types", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("ct_types").select("*");
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

router.get("/filing-periods", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
  const { customerId, ctTypeId } = req.query as { customerId?: string; ctTypeId?: string };
  if (!customerId || !ctTypeId) {
    return res.status(400).json({ message: "customerId and ctTypeId are required" });
  }

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
  const { companyName, period, pnlStructure, pnlValues, bsStructure, bsValues } = req.body;

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

    // Helper for Borders
    const drawBorder = () => {
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(1).strokeColor('#000000').stroke();
    };

    // --- PAGE 1: COVER PAGE ---
    drawBorder();
    doc.fillColor('#000000');
    doc.fontSize(26).font('Helvetica-Bold').text(companyName || 'COMPANY NAME', 50, 250, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(18).font('Helvetica').text('Financial Statements & Corporate Tax Return', { align: 'center' });
    doc.moveDown(2);

    // Improved period display
    const cleanPeriod = period ? period.replace('For the period:', '').trim() : '';
    doc.fontSize(14).font('Helvetica-Bold').text('REPORTING PERIOD', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(cleanPeriod, { align: 'center' });

    // --- PAGE 2: INDEX PAGE ---
    doc.addPage();
    indexPageNum = doc.bufferedPageRange().count;
    drawBorder();

    doc.fillColor('#000000');
    doc.fontSize(24).font('Helvetica-Bold').text('Table of Contents', 70, 100);
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica');
    doc.text('Cover Page', 100, 200);
    doc.text('1', 480, 200, { align: 'right' });

    doc.text('Table of Contents', 100, 230);
    doc.text('2', 480, 230, { align: 'right' });

    doc.text('Statement of Profit or Loss', 100, 260);
    doc.text('3', 480, 260, { align: 'right' });

    doc.text('Statement of Financial Position', 100, 290);
    doc.text('4', 480, 290, { align: 'right' });

    doc.moveTo(100, 320).lineTo(480, 320).lineWidth(0.5).strokeColor('#cccccc').stroke();

    // --- PAGE 3: PROFIT & LOSS ---
    doc.addPage();
    pnlPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fillColor('#000000');
    doc.fontSize(20).font('Helvetica-Bold').text('Statement of Profit or Loss', 50, 50);
    doc.fontSize(12).font('Helvetica').text(companyName, 50, 75);
    doc.text(cleanPeriod, 50, 90);
    doc.moveDown(2);

    // Table Header
    const tableTop = 130;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, tableTop);
    doc.text('Current Year (AED)', 350, tableTop, { width: 100, align: 'right' });
    doc.text('Previous Year (AED)', 460, tableTop, { width: 100, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#cccccc').stroke();

    let currentY = tableTop + 25;

    pnlStructure.forEach((item: any) => {
      // Check for page overflow
      if (currentY > 730) {
        doc.addPage();
        drawBorder();
        currentY = 50;
      }

      const values = pnlValues[item.id] || { currentYear: 0, previousYear: 0 };
      const label = item.indent ? `    ${item.label}` : item.label;

      if (item.type === 'header' || item.type === 'total') {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
      } else if (item.type === 'subsection_header') {
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
        currentY += 10;
      }

      currentY += 15;
    });

    // --- PAGE 4: BALANCE SHEET ---
    doc.addPage();
    bsPageNum = doc.bufferedPageRange().count;
    drawBorder();
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000').text('Statement of Financial Position', 50, 50);
    doc.fontSize(12).font('Helvetica').text(companyName, 50, 75);
    doc.text(cleanPeriod, 50, 90);
    doc.moveDown(2);

    // Table Header
    const bsTableTop = 130;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, bsTableTop);
    doc.text('Current Year (AED)', 350, bsTableTop, { width: 100, align: 'right' });
    doc.text('Previous Year (AED)', 460, bsTableTop, { width: 100, align: 'right' });

    doc.moveTo(50, bsTableTop + 15).lineTo(540, bsTableTop + 15).strokeColor('#cccccc').stroke();

    currentY = bsTableTop + 25;

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
        if (item.type === 'header') currentY += 10;
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

    // Finalize Pages and Dynamic TOC
    const range = doc.bufferedPageRange();

    // Update TOC on Page 2
    doc.switchToPage(indexPageNum - 1);
    doc.fontSize(14).font('Helvetica');
    doc.text('Cover Page', 100, 200);
    doc.text('1', 480, 200, { align: 'right' });
    doc.text('Table of Contents', 100, 230);
    doc.text(String(indexPageNum), 480, 230, { align: 'right' });
    doc.text('Statement of Profit or Loss', 100, 260);
    doc.text(String(pnlPageNum), 480, 260, { align: 'right' });
    doc.text('Statement of Financial Position', 100, 290);
    doc.text(String(bsPageNum), 480, 290, { align: 'right' });
    doc.moveTo(100, 320).lineTo(480, 320).lineWidth(0.5).strokeColor('#cccccc').stroke();

    // Add Page Numbers in Footers
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // IMPORTANT: Set bottom margin high temporarily to avoid footer triggering overflow
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
