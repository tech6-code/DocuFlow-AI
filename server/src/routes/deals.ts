import { Router } from "express";
import multer from "multer";
import { query } from "../lib/db";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";
import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/deals');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Map functions tailored for MySQL result structures (snake_case -> camelCase)
const mapFromDb = (dbDeal: any) => ({
  id: dbDeal.id,
  cifNumber: dbDeal.cif || "",
  date: dbDeal.deal_date || "",
  name: dbDeal.name || "",
  companyName: dbDeal.company_name || "",
  brand: dbDeal.brand || "",
  contactNo: dbDeal.contact_number || "",
  email: dbDeal.email || "",
  leadSource: dbDeal.lead_source || "",
  services: dbDeal.service || "",
  serviceClosed: dbDeal.service_closed ? "Yes" : "No", // boolean to string
  serviceAmount: dbDeal.service_amount || 0,
  closingDate: dbDeal.closing_date || "",
  paymentStatus: dbDeal.payment_status || "Pending",
  custom_data: dbDeal.custom_data
});

// Follow Up Mapper
const mapFollowUpFromDb = (dbFollowUp: any) => ({
  id: dbFollowUp.id,
  dealId: dbFollowUp.deal_id,
  created: dbFollowUp.created_at,
  nextFollowUp: dbFollowUp.follow_up,
  startTime: dbFollowUp.start_time,
  sendReminder: dbFollowUp.send_remainder,
  remindBefore: dbFollowUp.remind_before_value,
  remindUnit: dbFollowUp.remind_before_unit,
  remark: dbFollowUp.remarks,
  status: dbFollowUp.status
});

const mapNoteFromDb = (dbNote: any) => ({
  id: dbNote.id,
  dealId: dbNote.deal_id,
  title: dbNote.note_title,
  detail: dbNote.note_details,
  created: dbNote.created_at
});

const mapDocumentFromDb = (dbDoc: any) => ({
  id: dbDoc.id,
  dealId: dbDoc.deal_id,
  uploaderId: dbDoc.uploader_id,
  documentType: dbDoc.document_type,
  filePath: dbDoc.file_path,
  fileName: dbDoc.file_name,
  fileSize: dbDoc.file_size,
  contentType: dbDoc.content_type,
  createdAt: dbDoc.created_at
});

router.get("/", requireAuth, requirePermission("sales-deals:view"), async (_req, res) => {
  try {
    const data: any = await query('SELECT * FROM deals ORDER BY deal_date DESC');
    return res.json(data.map(mapFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/", requireAuth, requirePermission("sales-deals:create"), async (req, res) => {
  const deal = req.body || {};
  const id = randomUUID();

  try {
    const sql = `
          INSERT INTO deals (
              id, user_id, cif, deal_date, name, company_name, brand, contact_number, email,
              lead_source, service, service_closed, service_amount, closing_date, payment_status, custom_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    const params = [
      id, deal.userId || null, deal.cifNumber, deal.date || null, deal.name, deal.companyName,
      deal.brand, deal.contactNo, deal.email, deal.leadSource, deal.services,
      deal.serviceClosed === "Yes", deal.serviceAmount || 0, deal.closingDate || null,
      deal.paymentStatus, JSON.stringify(deal.custom_data || {})
    ];
    await query(sql, params);
    const [newDeal]: any = await query('SELECT * FROM deals WHERE id = ?', [id]);
    return res.status(201).json(mapFromDb(newDeal));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("sales-deals:edit"), async (req, res) => {
  const { id } = req.params;
  const deal = req.body || {};

  try {
    const updates = [];
    const params = [];

    const map = {
      cif: deal.cifNumber,
      deal_date: deal.date || null,
      name: deal.name,
      company_name: deal.companyName,
      brand: deal.brand,
      contact_number: deal.contactNo,
      email: deal.email,
      lead_source: deal.leadSource,
      service: deal.services,
      service_closed: deal.serviceClosed === "Yes",
      service_amount: deal.serviceAmount || 0,
      closing_date: deal.closingDate || null,
      payment_status: deal.paymentStatus,
      custom_data: JSON.stringify(deal.custom_data || {})
    };

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined && key !== 'custom_data') { // custom_data always sent?
        updates.push(`${key} = ?`);
        params.push(val);
      } else if (key === 'custom_data' && deal.custom_data) {
        updates.push(`${key} = ?`);
        params.push(val);
      }
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updated]: any = await query('SELECT * FROM deals WHERE id = ?', [id]);
    return res.json(mapFromDb(updated));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("sales-deals:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM deals WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// Follow Ups
router.get("/:id/followups", requireAuth, requirePermission("sales-deals:view"), async (req, res) => {
  const { id } = req.params;
  try {
    const rows: any = await query('SELECT * FROM deals_follow_up WHERE deal_id = ? ORDER BY created_at DESC', [id]);
    return res.json(rows.map(mapFollowUpFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/:id/followups", requireAuth, requirePermission("sales-deals:edit"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const followUp = req.body || {};
  const fId = randomUUID();
  const userId = req.auth?.user.id;

  try {
    await query(
      `INSERT INTO deals_follow_up (id, deal_id, user_id, follow_up, start_time, send_remainder, remind_before_value, remind_before_unit, remarks, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fId, id, userId, followUp.nextFollowUp, followUp.startTime, followUp.sendReminder, followUp.remindBefore, followUp.remindUnit, followUp.remark, followUp.status, userId]
    );
    const [newRow]: any = await query('SELECT * FROM deals_follow_up WHERE id = ?', [fId]);
    return res.status(201).json(mapFollowUpFromDb(newRow));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id/followups/:followupId", requireAuth, requirePermission("sales-deals:edit"), async (req: AuthedRequest, res) => {
  const { followupId } = req.params;
  const followUp = req.body || {};

  try {
    // simplified update
    const updates = [];
    const params = [];
    if (followUp.nextFollowUp !== undefined) { updates.push('follow_up = ?'); params.push(followUp.nextFollowUp); }
    if (followUp.status !== undefined) { updates.push('status = ?'); params.push(followUp.status); }
    // ... add others if needed

    if (updates.length > 0) {
      params.push(followupId);
      await query(`UPDATE deals_follow_up SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [updated]: any = await query('SELECT * FROM deals_follow_up WHERE id = ?', [followupId]);
    return res.json(mapFollowUpFromDb(updated));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});


router.delete("/:id/followups/:followupId", requireAuth, requirePermission("sales-deals:delete"), async (req, res) => {
  const { followupId } = req.params;
  try {
    await query('DELETE FROM deals_follow_up WHERE id = ?', [followupId]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// Notes (similar pattern)
router.get("/:id/notes", requireAuth, requirePermission("sales-deals:view"), async (req, res) => {
  const { id } = req.params;
  try {
    const rows: any = await query('SELECT * FROM deals_notes WHERE deal_id = ? ORDER BY created_at DESC', [id]);
    return res.json(rows.map(mapNoteFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/:id/notes", requireAuth, requirePermission("sales-deals:edit"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const note = req.body || {};
  const nId = randomUUID();
  const userId = req.auth?.user.id;

  try {
    await query(
      'INSERT INTO deals_notes (id, deal_id, user_id, note_title, note_details) VALUES (?, ?, ?, ?, ?)',
      [nId, id, userId, note.title, note.detail]
    );
    const [newRow]: any = await query('SELECT * FROM deals_notes WHERE id = ?', [nId]);
    return res.status(201).json(mapNoteFromDb(newRow));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// Documents aka uploads
router.post("/:id/documents", requireAuth, requirePermission("sales-deals:edit"), upload.single("document"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ message: "No file provided" });

  try {
    const dealDir = path.join(UPLOADS_DIR, id);
    if (!fs.existsSync(dealDir)) fs.mkdirSync(dealDir, { recursive: true });

    const fileName = `${Date.now()}_${file.originalname}`;
    const filePath = path.join(dealDir, fileName);
    const relativePath = `${id}/${fileName}`;

    fs.writeFileSync(filePath, file.buffer);

    const docId = randomUUID();
    await query(
      `INSERT INTO deals_documents (id, deal_id, uploader_id, document_type, file_path, file_name, file_size, content_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, id, req.auth?.user.id || "", file.mimetype, relativePath, file.originalname, file.size, file.mimetype]
    );

    const [newDoc]: any = await query('SELECT * FROM deals_documents WHERE id = ?', [docId]);
    return res.status(201).json(mapDocumentFromDb(newDoc));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/:id/documents", requireAuth, requirePermission("sales-deals:view"), async (req, res) => {
  const { id } = req.params;
  try {
    const rows: any = await query('SELECT * FROM deals_documents WHERE deal_id = ? ORDER BY created_at DESC', [id]);
    return res.json(rows.map(mapDocumentFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id/documents/:docId", requireAuth, requirePermission("sales-deals:delete"), async (req, res) => {
  const { docId } = req.params;
  try {
    await query('DELETE FROM deals_documents WHERE id = ?', [docId]);
    // Should delete file
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

// History endpoint (complex join or multi-query)
router.get("/:id/history", requireAuth, requirePermission("sales-deals:view"), async (req, res) => {
  const { id } = req.params;

  // Fetch all 3 sources
  try {
    const followUps: any = await query('SELECT * FROM deals_follow_up WHERE deal_id = ?', [id]);
    const notes: any = await query('SELECT * FROM deals_notes WHERE deal_id = ?', [id]);
    const docs: any = await query('SELECT * FROM deals_documents WHERE deal_id = ?', [id]);

    const userIds = new Set<string>();
    [...followUps, ...notes, ...docs].forEach(i => {
      if (i.user_id) userIds.add(i.user_id);
      if (i.created_by) userIds.add(i.created_by);
      if (i.uploader_id) userIds.add(i.uploader_id);
    });

    // Resolve user names
    const userNameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const uIds = Array.from(userIds);
      const users: any = await query(`SELECT id, name FROM users WHERE id IN (${uIds.map(() => '?').join(',')})`, uIds);
      users.forEach((u: any) => userNameMap[u.id] = u.name);
    }

    const resolveName = (uid: string) => userNameMap[uid] || "Unknown User";

    const history = [];
    // Combine them ... (Same logic as valid code)
    for (const f of followUps) {
      history.push({
        id: f.id, type: "FollowUp", action: "created", date: f.created_at,
        userId: f.created_by || f.user_id, userName: resolveName(f.created_by || f.user_id),
        details: f.remarks, metadata: { status: f.status }
      });
    }
    for (const n of notes) {
      history.push({
        id: n.id, type: "Note", action: "created", date: n.created_at,
        userId: n.user_id, userName: resolveName(n.user_id),
        details: n.note_details, metadata: { title: n.note_title }
      });
    }
    for (const d of docs) {
      history.push({
        id: d.id, type: "Document", action: "uploaded", date: d.created_at,
        userId: d.uploader_id, userName: resolveName(d.uploader_id),
        details: d.file_name, metadata: { size: d.file_size, type: d.content_type }
      });
    }

    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return res.json(history);

  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
