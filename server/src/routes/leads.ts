import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { randomUUID } from "crypto";

const router = Router();

const mapFromDb = (item: any) => ({
  id: item.id,
  date: item.date,
  companyName: item.company_name,
  brand: item.brand_id,
  mobileNumber: item.mobile_number,
  email: item.email,
  leadSource: item.lead_source,
  status: item.status,
  serviceRequired: item.service_required_id,
  leadQualification: item.lead_qualification_id,
  leadOwner: item.lead_owner_id,
  remarks: item.remarks,
  lastContact: item.last_contact,
  closingCycle: item.closing_cycle?.toString(),
  closingDate: item.expected_closing,
  createdAt: item.created_at,
  custom_data: item.custom_data
});

router.get("/", requireAuth, requirePermission("sales-leads:view"), async (_req, res) => {
  try {
    const data: any = await query('SELECT * FROM leads WHERE is_active = TRUE ORDER BY created_at DESC');
    return res.json(data.map(mapFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/", requireAuth, requirePermission("sales-leads:create"), async (req, res) => {
  const lead = req.body || {};
  const cycle = parseInt(lead.closingCycle || "", 10);
  const closingCycle = Number.isNaN(cycle) ? null : cycle;
  const id = randomUUID();

  try {
    const sql = `
        INSERT INTO leads (
          id, user_id, date, company_name, brand_id, mobile_number, email, 
          lead_source, status, service_required_id, lead_qualification_id, 
          lead_owner_id, remarks, last_contact, closing_cycle, expected_closing, 
          is_active, custom_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
    // Assuming req.auth.user.id or lead.userId? Original code used lead.userId
    const params = [
      id, lead.userId, lead.date || null, lead.companyName, lead.brand, lead.mobileNumber, lead.email,
      lead.leadSource, lead.status, lead.serviceRequired, lead.leadQualification,
      lead.leadOwner, lead.remarks, lead.lastContact || null, closingCycle, lead.closingDate || null,
      true, JSON.stringify(lead.custom_data || {})
    ];

    await query(sql, params);
    const [newLead]: any = await query('SELECT * FROM leads WHERE id = ?', [id]);
    return res.status(201).json(mapFromDb(newLead));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("sales-leads:edit"), async (req, res) => {
  const { id } = req.params;
  const lead = req.body || {};
  const cycle = parseInt(lead.closingCycle || "", 10);
  const closingCycle = Number.isNaN(cycle) ? null : cycle;

  try {
    const sql = `
        UPDATE leads SET 
          date = ?, company_name = ?, brand_id = ?, mobile_number = ?, email = ?, 
          lead_source = ?, status = ?, service_required_id = ?, lead_qualification_id = ?, 
          lead_owner_id = ?, remarks = ?, last_contact = ?, closing_cycle = ?, 
          expected_closing = ?, custom_data = ?
        WHERE id = ?
      `;
    const params = [
      lead.date || null, lead.companyName, lead.brand, lead.mobileNumber, lead.email,
      lead.leadSource, lead.status, lead.serviceRequired, lead.leadQualification,
      lead.leadOwner, lead.remarks, lead.lastContact || null, closingCycle,
      lead.closingDate || null, JSON.stringify(lead.custom_data || {}),
      id
    ];

    await query(sql, params);
    const [updated]: any = await query('SELECT * FROM leads WHERE id = ?', [id]);
    return res.json(mapFromDb(updated));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("sales-leads:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM leads WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
