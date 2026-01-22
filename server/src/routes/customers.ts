import { Router } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const mapFromDb = (row: any) => ({
  id: row.id,
  cifNumber: row.cif,
  type: row.type,
  salutation: row.salutation,
  firstName: row.first_name,
  lastName: row.last_name,
  companyName: row.company_name,
  email: row.email,
  workPhone: row.work_phone,
  mobile: row.mobile,
  currency: row.currency,
  language: row.language,
  billingAddress: row.billing_address,
  shippingAddress: row.shipping_address,
  remarks: row.remarks,
  entityType: row.entity_type,
  entitySubType: row.entity_sub_type,
  incorporationDate: row.incorporation_date,
  tradeLicenseAuthority: row.trade_license_authority,
  tradeLicenseNumber: row.trade_license_number,
  tradeLicenseIssueDate: row.trade_license_issue_date,
  tradeLicenseExpiryDate: row.trade_license_expiry_date,
  businessActivity: row.business_activity,
  isFreezone: row.is_freezone,
  freezoneName: row.freezone_name,
  shareholders: row.shareholders || [],
  authorisedSignatories: row.authorised_signatories,
  shareCapital: row.share_capital,
  taxTreatment: row.tax_treatment,
  trn: row.trn,
  vatRegisteredDate: row.vat_registered_date,
  firstVatFilingPeriod: row.first_vat_filing_period,
  vatFilingDueDate: row.vat_filing_due_date,
  vatReportingPeriod: row.vat_reporting_period,
  corporateTaxTreatment: row.corporate_tax_treatment,
  corporateTaxTrn: row.corporate_tax_trn,
  corporateTaxRegisteredDate: row.corporate_tax_registered_date,
  corporateTaxPeriod: row.corporate_tax_period,
  firstCorporateTaxPeriodStart: row.first_corporate_tax_period_start,
  firstCorporateTaxPeriodEnd: row.first_corporate_tax_period_end,
  corporateTaxFilingDueDate: row.corporate_tax_filing_due_date,
  businessRegistrationNumber: row.business_registration_number,
  placeOfSupply: row.place_of_supply,
  openingBalance: row.opening_balance,
  paymentTerms: row.payment_terms,
  ownerId: row.owner_id,
  portalAccess: row.portal_access,
  contactPersons: row.contact_persons || [],
  custom_data: row.custom_data
});

const mapToDb = (customer: any) => ({
  cif: customer.cifNumber,
  type: customer.type,
  salutation: customer.salutation,
  first_name: customer.firstName,
  last_name: customer.lastName,
  company_name: customer.companyName,
  email: customer.email,
  work_phone: customer.workPhone,
  mobile: customer.mobile,
  currency: customer.currency,
  language: customer.language,
  billing_address: customer.billingAddress,
  shipping_address: customer.shippingAddress,
  remarks: customer.remarks,
  entity_type: customer.entityType,
  entity_sub_type: customer.entitySubType,
  incorporation_date: customer.incorporationDate,
  trade_license_authority: customer.tradeLicenseAuthority,
  trade_license_number: customer.tradeLicenseNumber,
  trade_license_issue_date: customer.tradeLicenseIssueDate,
  trade_license_expiry_date: customer.tradeLicenseExpiryDate,
  business_activity: customer.businessActivity,
  is_freezone: customer.isFreezone,
  freezone_name: customer.freezoneName,
  shareholders: customer.shareholders,
  authorised_signatories: customer.authorisedSignatories,
  share_capital: customer.shareCapital,
  tax_treatment: customer.taxTreatment,
  trn: customer.trn,
  vat_registered_date: customer.vatRegisteredDate,
  first_vat_filing_period: customer.firstVatFilingPeriod,
  vat_filing_due_date: customer.vatFilingDueDate,
  vat_reporting_period: customer.vatReportingPeriod,
  corporate_tax_treatment: customer.corporateTaxTreatment,
  corporate_tax_trn: customer.corporateTaxTrn,
  corporate_tax_registered_date: customer.corporateTaxRegisteredDate,
  corporate_tax_period: customer.corporateTaxPeriod,
  first_corporate_tax_period_start: customer.firstCorporateTaxPeriodStart,
  first_corporate_tax_period_end: customer.firstCorporateTaxPeriodEnd,
  corporate_tax_filing_due_date: customer.corporateTaxFilingDueDate,
  business_registration_number: customer.businessRegistrationNumber,
  place_of_supply: customer.placeOfSupply,
  opening_balance: customer.openingBalance,
  payment_terms: customer.paymentTerms,
  owner_id: customer.ownerId,
  portal_access: customer.portalAccess,
  contact_persons: customer.contactPersons,
  custom_data: customer.custom_data
});

async function generateCifNumber() {
  let cifNumber = "1001";
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("cif")
    .not("cif", "is", null)
    .order("cif", { ascending: false })
    .limit(1);

  if (!error && data && data.length > 0 && data[0].cif) {
    const lastCif = parseInt(data[0].cif, 10);
    if (!Number.isNaN(lastCif)) {
      cifNumber = String(lastCif + 1);
    }
  }

  return cifNumber;
}

async function uploadCustomerDocs(customerId: string, files: Express.Multer.File[], docTypes: string[], uploaderId: string) {
  if (!files || files.length === 0) return;

  const uploads = files.map(async (file, idx) => {
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `${customerId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("customer-docs")
      .upload(filePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw new Error(uploadError.message);

    const { error: dbError } = await supabaseAdmin
      .from("customer_legal_docs")
      .insert([{ 
        customer_id: customerId,
        uploader_id: uploaderId,
        document_type: docTypes[idx] || file.mimetype,
        file_path: filePath,
        file_name: file.originalname,
        file_size: file.size,
        content_type: file.mimetype
      }]);

    if (dbError) throw new Error(dbError.message);
  });

  await Promise.allSettled(uploads);
}

router.get("/", requireAuth, requirePermission("customer-management:view"), async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ message: error.message });
  return res.json((data || []).map(mapFromDb));
});

router.post("/", requireAuth, requirePermission("customer-management:create"), upload.array("documents"), async (req: AuthedRequest, res) => {
  const customer = req.body?.customer ? JSON.parse(req.body.customer) : req.body;
  const files = (req.files || []) as Express.Multer.File[];
  const docTypes = req.body?.documentTypes ? JSON.parse(req.body.documentTypes) : [];

  const cifNumber = await generateCifNumber();
  const dbPayload = { ...mapToDb(customer), cif: cifNumber };

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert([dbPayload])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  await uploadCustomerDocs(data.id, files, docTypes, req.auth?.user.id || "");

  return res.status(201).json(mapFromDb(data));
});

router.put("/:id", requireAuth, requirePermission("customer-management:edit"), upload.array("documents"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const customer = req.body?.customer ? JSON.parse(req.body.customer) : req.body;
  const files = (req.files || []) as Express.Multer.File[];
  const docTypes = req.body?.documentTypes ? JSON.parse(req.body.documentTypes) : [];

  const dbPayload = mapToDb(customer);

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(dbPayload)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  await uploadCustomerDocs(id, files, docTypes, req.auth?.user.id || "");

  return res.json(mapFromDb(data));
});

router.delete("/:id", requireAuth, requirePermission("customer-management:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("customers").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

router.get("/:id/documents", requireAuth, requirePermission("customer-management:view"), async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from("customer_legal_docs")
    .select("*")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  if (error) return res.json([]);

  const mapped = (data || []).map((d: any) => ({
    id: d.id,
    customerId: d.customer_id,
    uploaderId: d.uploader_id,
    documentType: d.document_type,
    filePath: d.file_path,
    fileName: d.file_name,
    fileSize: d.file_size,
    contentType: d.content_type,
    createdAt: d.created_at
  }));

  return res.json(mapped);
});

export default router;
