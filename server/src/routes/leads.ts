import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

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
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapFromDb));
});

router.post("/", requireAuth, requirePermission("sales-leads:create"), async (req, res) => {
  const lead = req.body || {};
  const cycle = parseInt(lead.closingCycle || "", 10);
  const closingCycle = Number.isNaN(cycle) ? null : cycle;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert([{
      user_id: lead.userId,
      date: lead.date,
      company_name: lead.companyName,
      brand_id: lead.brand,
      mobile_number: lead.mobileNumber,
      email: lead.email,
      lead_source: lead.leadSource,
      status: lead.status,
      service_required_id: lead.serviceRequired,
      lead_qualification_id: lead.leadQualification,
      lead_owner_id: lead.leadOwner,
      remarks: lead.remarks,
      last_contact: lead.lastContact,
      closing_cycle: closingCycle,
      expected_closing: lead.closingDate,
      is_active: true,
      custom_data: lead.custom_data
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(mapFromDb(data));
});

router.put("/:id", requireAuth, requirePermission("sales-leads:edit"), async (req, res) => {
  const { id } = req.params;
  const lead = req.body || {};
  const cycle = parseInt(lead.closingCycle || "", 10);
  const closingCycle = Number.isNaN(cycle) ? null : cycle;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .update({
      date: lead.date,
      company_name: lead.companyName,
      brand_id: lead.brand,
      mobile_number: lead.mobileNumber,
      email: lead.email,
      lead_source: lead.leadSource,
      status: lead.status,
      service_required_id: lead.serviceRequired,
      lead_qualification_id: lead.leadQualification,
      lead_owner_id: lead.leadOwner,
      remarks: lead.remarks,
      last_contact: lead.lastContact,
      closing_cycle: closingCycle,
      expected_closing: lead.closingDate,
      custom_data: lead.custom_data
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapFromDb(data));
});

router.delete("/:id", requireAuth, requirePermission("sales-leads:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

export default router;
