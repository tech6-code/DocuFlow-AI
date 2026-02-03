import { Router } from "express";
import multer from "multer";
import { query } from "../lib/db";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";
import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/customers');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

async function generateCifNumber() {
  const rows: any = await query('SELECT cif FROM customers WHERE cif IS NOT NULL ORDER BY cif DESC LIMIT 1');
  let cifNumber = "1001";

  if (rows.length > 0 && rows[0].cif) {
    const lastCif = parseInt(rows[0].cif, 10);
    if (!Number.isNaN(lastCif)) {
      cifNumber = String(lastCif + 1);
    }
  }
  return cifNumber;
}

async function uploadCustomerDocs(customerId: string, files: Express.Multer.File[], docTypes: string[], uploaderId: string) {
  if (!files || files.length === 0) return;

  // Ensure customer folder
  const custDir = path.join(UPLOADS_DIR, customerId);
  if (!fs.existsSync(custDir)) fs.mkdirSync(custDir, { recursive: true });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExt = file.originalname.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = path.join(custDir, fileName);
    const relativePath = `${customerId}/${fileName}`;

    fs.writeFileSync(filePath, file.buffer);

    const docId = randomUUID();
    await query(
      `INSERT INTO customer_legal_docs (
             id, customer_id, uploader_id, document_type, file_path, 
             file_name, file_size, content_type
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId, customerId, uploaderId, docTypes[i] || file.mimetype, relativePath,
        file.originalname, file.size, file.mimetype
      ]
    );
  }
}

router.get("/", requireAuth, requirePermission(["customer-management:view", "sales:view"]), async (_req, res) => {
  try {
    const data: any = await query('SELECT * FROM customers ORDER BY created_at DESC');
    return res.json(data.map(mapFromDb));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/", requireAuth, requirePermission("customer-management:create"), upload.array("documents"), async (req: AuthedRequest, res) => {
  try {
    const customer = req.body?.customer ? JSON.parse(req.body.customer) : req.body;
    const files = (req.files || []) as Express.Multer.File[];
    const docTypes = req.body?.documentTypes ? JSON.parse(req.body.documentTypes) : [];

    const cifNumber = await generateCifNumber();
    const id = randomUUID();

    const sql = `
        INSERT INTO customers (
            id, cif, type, salutation, first_name, last_name, company_name, email,
            work_phone, mobile, currency, language, billing_address, shipping_address,
            remarks, entity_type, entity_sub_type, incorporation_date, trade_license_authority,
            trade_license_number, trade_license_issue_date, trade_license_expiry_date,
            business_activity, is_freezone, freezone_name, shareholders, authorised_signatories,
            share_capital, tax_treatment, trn, vat_registered_date, first_vat_filing_period,
            vat_filing_due_date, vat_reporting_period, corporate_tax_treatment, corporate_tax_trn,
            corporate_tax_registered_date, corporate_tax_period, first_corporate_tax_period_start,
            first_corporate_tax_period_end, corporate_tax_filing_due_date, business_registration_number,
            place_of_supply, opening_balance, payment_terms, owner_id, portal_access,
            contact_persons, custom_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const params = [
      id, cifNumber, customer.type, customer.salutation, customer.firstName, customer.lastName,
      customer.companyName, customer.email, customer.workPhone, customer.mobile, customer.currency,
      customer.language, customer.billingAddress, customer.shippingAddress, customer.remarks,
      customer.entityType, customer.entitySubType, customer.incorporationDate || null,
      customer.tradeLicenseAuthority, customer.tradeLicenseNumber, customer.tradeLicenseIssueDate || null,
      customer.tradeLicenseExpiryDate || null, customer.businessActivity, customer.isFreezone,
      customer.freezoneName, JSON.stringify(customer.shareholders || []), JSON.stringify(customer.authorisedSignatories),
      customer.shareCapital, customer.taxTreatment, customer.trn, customer.vatRegisteredDate || null,
      customer.firstVatFilingPeriod || null, customer.vatFilingDueDate || null, customer.vatReportingPeriod,
      customer.corporateTaxTreatment, customer.corporateTaxTrn, customer.corporateTaxRegisteredDate || null,
      customer.corporateTaxPeriod, customer.firstCorporateTaxPeriodStart || null, customer.firstCorporateTaxPeriodEnd || null,
      customer.corporateTaxFilingDueDate || null, customer.businessRegistrationNumber, customer.placeOfSupply,
      customer.openingBalance || 0, customer.paymentTerms, customer.ownerId, customer.portalAccess,
      JSON.stringify(customer.contactPersons || []), JSON.stringify(customer.custom_data || {})
    ];

    await query(sql, params);

    await uploadCustomerDocs(id, files, docTypes, req.auth?.user.id || "");

    const [newCust]: any = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return res.status(201).json(mapFromDb(newCust));

  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("customer-management:edit"), upload.array("documents"), async (req: AuthedRequest, res) => {
  const { id } = req.params;
  try {
    const customer = req.body?.customer ? JSON.parse(req.body.customer) : req.body;
    const files = (req.files || []) as Express.Multer.File[];
    const docTypes = req.body?.documentTypes ? JSON.parse(req.body.documentTypes) : [];

    // Update query - simplified (update all fields or dynamic?)
    // Customers table is huge. Dynamic is safer to avoid overwriting with nulls if partial update.
    // But typically PUT sends whole object.
    // I'll implement a massive UPDATE set ... = ?
    // For brevity in this assistant response I will assume full update for critical fields or use a dynamic builder like in users.ts

    // ... (Implementation detail: constructing UPDATE query)
    // I'll skip the massive UPDATE construction here and focus on files and return.
    // Ideally I should implement it.

    const fields = [
      'type', 'salutation', 'first_name', 'last_name', 'company_name', 'email', 'work_phone', 'mobile',
      'currency', 'language', 'billing_address', 'shipping_address', 'remarks', 'entity_type',
      'entity_sub_type', 'incorporation_date', 'trade_license_authority', 'trade_license_number',
      'trade_license_issue_date', 'trade_license_expiry_date', 'business_activity', 'is_freezone',
      'freezone_name', 'shareholders', 'authorised_signatories', 'share_capital', 'tax_treatment',
      'trn', 'vat_registered_date', 'first_vat_filing_period', 'vat_filing_due_date', 'vat_reporting_period',
      'corporate_tax_treatment', 'corporate_tax_trn', 'corporate_tax_registered_date', 'corporate_tax_period',
      'first_corporate_tax_period_start', 'first_corporate_tax_period_end', 'corporate_tax_filing_due_date',
      'business_registration_number', 'place_of_supply', 'opening_balance', 'payment_terms', 'owner_id',
      'portal_access', 'contact_persons', 'custom_data'
    ];

    const updates = [];
    const params = [];

    // Map frontend camelCase to db snake_case
    const map: any = {
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
      incorporation_date: customer.incorporationDate || null,
      trade_license_authority: customer.tradeLicenseAuthority,
      trade_license_number: customer.tradeLicenseNumber,
      trade_license_issue_date: customer.tradeLicenseIssueDate || null,
      trade_license_expiry_date: customer.tradeLicenseExpiryDate || null,
      business_activity: customer.businessActivity,
      is_freezone: customer.isFreezone,
      freezone_name: customer.freezoneName,
      shareholders: JSON.stringify(customer.shareholders || []),
      authorised_signatories: JSON.stringify(customer.authorisedSignatories),
      share_capital: customer.shareCapital,
      tax_treatment: customer.taxTreatment,
      trn: customer.trn,
      vat_registered_date: customer.vatRegisteredDate || null,
      first_vat_filing_period: customer.firstVatFilingPeriod || null,
      vat_filing_due_date: customer.vatFilingDueDate || null,
      vat_reporting_period: customer.vatReportingPeriod,
      corporate_tax_treatment: customer.corporateTaxTreatment,
      corporate_tax_trn: customer.corporateTaxTrn,
      corporate_tax_registered_date: customer.corporateTaxRegisteredDate || null,
      corporate_tax_period: customer.corporateTaxPeriod,
      first_corporate_tax_period_start: customer.firstCorporateTaxPeriodStart || null,
      first_corporate_tax_period_end: customer.firstCorporateTaxPeriodEnd || null,
      corporate_tax_filing_due_date: customer.corporateTaxFilingDueDate || null,
      business_registration_number: customer.businessRegistrationNumber,
      place_of_supply: customer.placeOfSupply,
      opening_balance: customer.openingBalance,
      payment_terms: customer.paymentTerms,
      owner_id: customer.ownerId,
      portal_access: customer.portalAccess,
      contact_persons: JSON.stringify(customer.contactPersons || []),
      custom_data: JSON.stringify(customer.custom_data || {})
    };

    for (const f of fields) {
      if (map[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(map[f]);
      }
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await uploadCustomerDocs(id, files, docTypes, req.auth?.user.id || "");

    const [updated]: any = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return res.json(mapFromDb(updated));

  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("customer-management:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM customers WHERE id = ?', [id]);
    // TODO: Delete files from disk?
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/:id/documents", requireAuth, requirePermission("customer-management:view"), async (req, res) => {
  const { id } = req.params;
  try {
    const docs: any = await query('SELECT * FROM customer_legal_docs WHERE customer_id = ? ORDER BY created_at DESC', [id]);
    return res.json(docs.map((d: any) => ({
      id: d.id,
      customerId: d.customer_id,
      uploaderId: d.uploader_id,
      documentType: d.document_type,
      filePath: d.file_path, // Note: This is now a local path or key. Frontend might need /api/files/... to view it.
      fileName: d.file_name,
      fileSize: d.file_size,
      contentType: d.content_type,
      createdAt: d.created_at
    })));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
