import { Router } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const mapToDb = (deal: any): any => {
  const mapped: any = {};
  if (deal.cifNumber !== undefined) mapped.cif = deal.cifNumber;
  if (deal.date !== undefined) mapped.deal_date = deal.date || null;
  if (deal.name !== undefined) mapped.name = deal.name;
  if (deal.companyName !== undefined) mapped.company_name = deal.companyName;
  if (deal.brand !== undefined) mapped.brand = deal.brand || null;
  if (deal.contactNo !== undefined) mapped.contact_number = deal.contactNo;
  if (deal.email !== undefined) mapped.email = deal.email;
  if (deal.leadSource !== undefined) mapped.lead_source = deal.leadSource || null;
  if (deal.services !== undefined) mapped.service = deal.services || null;
  if (deal.serviceClosed !== undefined) mapped.service_closed = deal.serviceClosed === "Yes";
  if (deal.serviceAmount !== undefined) mapped.service_amount = deal.serviceAmount || 0;
  if (deal.closingDate !== undefined) mapped.closing_date = deal.closingDate || null;
  if (deal.paymentStatus !== undefined) mapped.payment_status = deal.paymentStatus;
  if (deal.custom_data !== undefined) mapped.custom_data = deal.custom_data;
  return mapped;
};

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
  serviceClosed: dbDeal.service_closed ? "Yes" : "No",
  serviceAmount: dbDeal.service_amount || 0,
  closingDate: dbDeal.closing_date || "",
  paymentStatus: dbDeal.payment_status || "Pending",
  custom_data: dbDeal.custom_data
});

const mapFollowUpToDb = (followUp: any, userId: string): any => ({
  deal_id: followUp.dealId,
  user_id: userId,
  follow_up: followUp.nextFollowUp,
  start_time: followUp.startTime,
  send_remainder: followUp.sendReminder,
  remind_before_value: followUp.remindBefore,
  remind_before_unit: followUp.remindUnit,
  remarks: followUp.remark,
  status: followUp.status,
  created_by: userId
});

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

const mapNoteToDb = (note: any, userId: string): any => ({
  deal_id: note.dealId,
  user_id: userId,
  note_title: note.title,
  note_details: note.detail
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

router.get("/", requireAuth, requirePermission("sales:view"), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("*")
    .order("deal_date", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapFromDb));
});

router.post("/", requireAuth, requirePermission("sales:create"), async (req, res) => {
  const deal = req.body || {};
  const dealData = mapToDb(deal);
  if (deal.userId) {
    dealData.user_id = deal.userId;
  }

  const { data, error } = await supabaseAdmin
    .from("deals")
    .insert([dealData])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(mapFromDb(data));
});

router.put("/:id", requireAuth, requirePermission("sales:edit"), async (req, res) => {
  const { id } = req.params;
  const deal = req.body || {};

  const { data, error } = await supabaseAdmin
    .from("deals")
    .update(mapToDb(deal))
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapFromDb(data));
});

router.delete("/:id", requireAuth, requirePermission("sales:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("deals").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.get("/:id/followups", requireAuth, requirePermission("sales:view"), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("deals_follow_up")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapFollowUpFromDb));
});

router.post("/:id/followups", requireAuth, requirePermission("sales:edit"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const followUp = req.body || {};
  followUp.dealId = id;

  const dbData = mapFollowUpToDb(followUp, req.auth?.user.id || "");
  const { data, error } = await supabaseAdmin
    .from("deals_follow_up")
    .insert([dbData])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(mapFollowUpFromDb(data));
});

router.put("/:id/followups/:followupId", requireAuth, requirePermission("sales:edit"), async (req: AuthedRequest, res) => {
  const { followupId } = req.params;
  const followUp = req.body || {};

  const dbData = mapFollowUpToDb(followUp, req.auth?.user.id || "");
  const { data, error } = await supabaseAdmin
    .from("deals_follow_up")
    .update(dbData)
    .eq("id", followupId)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapFollowUpFromDb(data));
});

router.delete("/:id/followups/:followupId", requireAuth, requirePermission("sales:delete"), async (req, res) => {
  const { followupId } = req.params;
  const { error } = await supabaseAdmin.from("deals_follow_up").delete().eq("id", followupId);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.get("/:id/notes", requireAuth, requirePermission("sales:view"), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("deals_notes")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapNoteFromDb));
});

router.post("/:id/notes", requireAuth, requirePermission("sales:edit"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const note = req.body || {};
  note.dealId = id;

  const dbData = mapNoteToDb(note, req.auth?.user.id || "");
  const { data, error } = await supabaseAdmin
    .from("deals_notes")
    .insert([dbData])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(mapNoteFromDb(data));
});

router.put("/:id/notes/:noteId", requireAuth, requirePermission("sales:edit"), async (req: AuthedRequest, res) => {
  const { noteId } = req.params;
  const note = req.body || {};

  const dbData = mapNoteToDb(note, req.auth?.user.id || "");
  const { data, error } = await supabaseAdmin
    .from("deals_notes")
    .update(dbData)
    .eq("id", noteId)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(mapNoteFromDb(data));
});

router.delete("/:id/notes/:noteId", requireAuth, requirePermission("sales:delete"), async (req, res) => {
  const { noteId } = req.params;
  const { error } = await supabaseAdmin.from("deals_notes").delete().eq("id", noteId);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.get("/:id/documents", requireAuth, requirePermission("sales:view"), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("deals_documents")
    .select("*")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapDocumentFromDb));
});

router.post("/:id/documents", requireAuth, requirePermission("sales:edit"), upload.single("document"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ message: "No file provided" });

  const filePath = `${id}/${Date.now()}_${file.originalname}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("deal-documents")
    .upload(filePath, file.buffer, { contentType: file.mimetype });

  if (uploadError) return res.status(500).json({ message: uploadError.message });

  const dbData = {
    deal_id: id,
    uploader_id: req.auth?.user.id || "",
    document_type: file.mimetype,
    file_path: filePath,
    file_name: file.originalname,
    file_size: file.size,
    content_type: file.mimetype,
    created_at: new Date().toISOString()
  };

  const { data, error: dbError } = await supabaseAdmin
    .from("deals_documents")
    .insert([dbData])
    .select()
    .single();

  if (dbError) return res.status(500).json({ message: dbError.message });
  return res.status(201).json(mapDocumentFromDb(data));
});

router.delete("/:id/documents/:docId", requireAuth, requirePermission("sales:delete"), async (req, res) => {
  const { docId } = req.params;
  const { filePath } = req.query as { filePath?: string };

  if (filePath) {
    await supabaseAdmin.storage.from("deal-documents").remove([filePath]);
  }

  const { error } = await supabaseAdmin.from("deals_documents").delete().eq("id", docId);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.get("/:id/history", requireAuth, requirePermission("sales:view"), async (req, res) => {
  const { id } = req.params;

  const { data: followUps } = await supabaseAdmin.from("deals_follow_up").select("*").eq("deal_id", id);
  const { data: notes } = await supabaseAdmin.from("deals_notes").select("*").eq("deal_id", id);
  const { data: docs } = await supabaseAdmin.from("deals_documents").select("*").eq("deal_id", id);

  const userNameCache: Record<string, string> = {};
  const resolveUserName = async (userId: string) => {
    if (!userId) return "Unknown User";
    if (userNameCache[userId]) return userNameCache[userId];
    const { data } = await supabaseAdmin.from("users").select("name").eq("id", userId).single();
    const name = data?.name || "Unknown User";
    userNameCache[userId] = name;
    return name;
  };

  const history: any[] = [];

  if (followUps) {
    for (const f of followUps) {
      const userName = await resolveUserName(f.created_by || f.user_id);
      history.push({
        id: f.id,
        type: "FollowUp",
        action: "created",
        date: f.created_at,
        userId: f.created_by || f.user_id,
        userName,
        details: f.remarks,
        metadata: { status: f.status }
      });
    }
  }

  if (notes) {
    for (const n of notes) {
      const userName = await resolveUserName(n.user_id);
      history.push({
        id: n.id,
        type: "Note",
        action: "created",
        date: n.created_at,
        userId: n.user_id,
        userName,
        details: n.note_details,
        metadata: { title: n.note_title }
      });
    }
  }

  if (docs) {
    for (const d of docs) {
      const userName = await resolveUserName(d.uploader_id);
      history.push({
        id: d.id,
        type: "Document",
        action: "uploaded",
        date: d.created_at,
        userId: d.uploader_id,
        userName,
        details: d.file_name,
        metadata: { size: d.file_size, type: d.content_type }
      });
    }
  }

  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return res.json(history);
});

export default router;
