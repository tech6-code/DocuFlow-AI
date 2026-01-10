
import { supabase } from './supabase';
import type { Customer, DocumentUploadPayload, CustomerDocument } from '../types';

// Helper to map database columns (snake_case) to application types (camelCase)
const mapFromDb = (row: any): Customer => ({
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

    // Business
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

    // Tax
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

    // Meta
    ownerId: row.owner_id,
    portalAccess: row.portal_access,
    contactPersons: row.contact_persons || []
});

// Helper to map application types (camelCase) to database columns (snake_case)
const mapToDb = (customer: Omit<Customer, 'id' | 'documents'>) => ({
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

    // Business
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

    // Tax
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

    // Meta
    owner_id: customer.ownerId,
    portal_access: customer.portalAccess,
    contact_persons: customer.contactPersons
});

export const customerService = {
    async getCustomers(): Promise<Customer[]> {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            // Handle case where table doesn't exist yet
            if (error.code === '42P01') return [];
            throw new Error(error.message);
        }

        return (data || []).map(mapFromDb);
    },

    async uploadDocument(customerId: string, doc: DocumentUploadPayload): Promise<void> {
        const { documentType, file } = doc;

        // 1. Get Current User ID for uploader_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // 2. Upload file to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${customerId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('customer-docs')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            throw new Error(uploadError.message);
        }

        // 3. Insert record into customer_legal_docs table
        const { error: dbError } = await supabase
            .from('customer_legal_docs')
            .insert([{
                customer_id: customerId,
                uploader_id: user.id,
                document_type: documentType,
                file_path: filePath,
                file_name: file.name,
                file_size: file.size,
                content_type: file.type
            }]);

        if (dbError) {
            console.error("DB insert error:", dbError);
            throw new Error(dbError.message);
        }
    },

    async createCustomer(customer: Omit<Customer, 'id' | 'documents'>, documents?: DocumentUploadPayload[]): Promise<Customer | null> {
        // 1. Generate CIF Number (Numeric 4-5 digits)
        let cifNumber = '1001';
        try {
            const { data: lastCustomer, error: fetchError } = await supabase
                .from('customers')
                .select('cif')
                .not('cif', 'is', null)
                .order('cif', { ascending: false })
                .limit(1);

            if (fetchError) {
                console.error("Error fetching last CIF, falling back to default:", fetchError);
            } else if (lastCustomer && lastCustomer.length > 0 && lastCustomer[0].cif) {
                const lastCif = parseInt(lastCustomer[0].cif);
                if (!isNaN(lastCif)) {
                    cifNumber = (lastCif + 1).toString();
                } else {
                    // Fallback for non-numeric legacy CIFs
                    cifNumber = '1001';
                }
            }
        } catch (err) {
            console.error("Unexpected error in CIF generation:", err);
        }

        const dbPayload = {
            ...mapToDb(customer),
            cif: cifNumber
        };

        // 2. Create Customer
        const { data, error } = await supabase
            .from('customers')
            .insert([dbPayload])
            .select()
            .single();

        if (error) {
            console.error('Error creating customer:', error);
            throw new Error(error.message);
        }

        const newCustomer = mapFromDb(data);

        // 2. Upload Documents if any
        if (documents && documents.length > 0) {
            // Upload in parallel
            await Promise.allSettled(documents.map(doc => this.uploadDocument(newCustomer.id, doc)));
        }

        return newCustomer;
    },

    async updateCustomer(customer: Customer, newDocuments?: DocumentUploadPayload[]): Promise<Customer | null> {
        const { id, documents, ...rest } = customer; // exclude docs from update payload
        const dbPayload = mapToDb(rest);

        const { data, error } = await supabase
            .from('customers')
            .update(dbPayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating customer:', error);
            throw new Error(error.message);
        }

        // Upload new documents if any
        if (newDocuments && newDocuments.length > 0) {
            await Promise.allSettled(newDocuments.map(doc => this.uploadDocument(id, doc)));
        }

        return mapFromDb(data);
    },

    async deleteCustomer(id: string): Promise<boolean> {
        // Note: Delete cascade is set on the DB side for customer_legal_docs,
        // but we should ideally clean up storage buckets too.
        // For simplicity in this implementation, we just delete the row.

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting customer:', error);
            throw new Error(error.message);
        }
        return true;
    },

    async getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
        const { data, error } = await supabase
            .from('customer_legal_docs')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) return [];

        return data.map((d: any) => ({
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
    }
};
