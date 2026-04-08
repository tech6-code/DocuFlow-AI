import type { Company } from "../types";

export interface LouFormData {
    date: string;
    to: string;
    subject: string;
    taxablePerson: string;
    taxPeriod: string;
    trn: string;
    content: string;
    signatoryName: string;
    designation: string;
}

export interface LouTemplateDefinition {
    id: "type1" | "type2" | "type3" | "type4";
    label: string;
    description: string;
    build: (company: Company) => LouFormData;
}

const getTodayInputDate = () => new Date().toISOString().split("T")[0];

const getTaxPeriodLabel = (company: Company) => {
    const periodFrom = company.ctPeriodStart || "-";
    const periodTo = company.ctPeriodEnd || "-";
    return `FOR THE PERIOD FROM ${periodFrom} TO ${periodTo}`;
};

const getTaxablePerson = (company: Company) => company.name || "";

const getTrn = (company: Company) => company.corporateTaxTrn || company.trn || "";

const baseTemplate = (company: Company) => ({
    date: getTodayInputDate(),
    to: "The VAT Consultant LLC",
    subject: "Management Representation regarding Corporate Tax Computation and Filing",
    taxablePerson: getTaxablePerson(company),
    taxPeriod: getTaxPeriodLabel(company),
    trn: getTrn(company),
    signatoryName: "",
    designation: ""
});

export const LOU_TEMPLATES: LouTemplateDefinition[] = [
    {
        id: "type1",
        label: "Type 1",
        description: "Bank statements and previously filed VAT returns only.",
        build: (company) => ({
            ...baseTemplate(company),
            content: `We, the Management of ${getTaxablePerson(company) || "[Company Name]"}, confirm that the data provided for this Corporate Tax filing consists solely of bank statements and previously filed VAT returns. We declare these records to be the only financial basis for the tax period and acknowledge that no invoices or formal ledgers were provided for verification. We understand that The VAT Consultant LLC has relied entirely on these limited records without independent audit. We accept full responsibility for any discrepancies or omissions and remain solely liable for providing supporting evidence or justifications should the Federal Tax Authority (FTA) initiate an audit or inquiry.`
        })
    },
    {
        id: "type2",
        label: "Type 2",
        description: "Bank statements, invoices, and VAT records.",
        build: (company) => ({
            ...baseTemplate(company),
            content: `We, the Management of ${getTaxablePerson(company) || "[Company Name]"}, confirm that the bank statements, sales/purchase invoices, and VAT records provided for this Corporate Tax filing are true, complete, and accurate. We acknowledge that these documents serve as the primary evidence for all reported transactions. We understand that The VAT Consultant LLC has relied on this data to prepare the computation without conducting an audit of the underlying transactions. We accept full responsibility for any discrepancies or omissions and remain solely liable for providing supporting evidence or justifications should the Federal Tax Authority (FTA) initiate an audit or inquiry.`
        })
    },
    {
        id: "type3",
        label: "Type 3",
        description: "Management accounts or unaudited financial statements.",
        build: (company) => ({
            ...baseTemplate(company),
            content: `We, the Management of ${getTaxablePerson(company) || "[Company Name]"}, confirm that the Financial Statements (Trial Balance/Statement of Profit or Loss and Balance Sheet) provided for this Corporate Tax filing have been prepared by us in accordance with applicable accounting standards. We declare that these statements are true and complete, despite not being externally audited. We acknowledge that The VAT Consultant LLC has prepared the tax return based on these management accounts without independent verification. We accept full responsibility for the accuracy of these figures and for providing any supporting evidence requested by the FTA.`
        })
    },
    {
        id: "type4",
        label: "Type 4",
        description: "Audited financial statements based filing.",
        build: (company) => ({
            ...baseTemplate(company),
            content: `We, the Management of ${getTaxablePerson(company) || "[Company Name]"}, confirm that the Corporate Tax filing is based on the Audited Financial Statements for the period ending ${company.ctPeriodEnd || "[Date]"}, as prepared by our independent auditors. We declare that all adjustments and disclosures are consistent with the audited report. We acknowledge that The VAT Consultant LLC has used these audited figures as the starting point for the tax computation. While these records have been externally verified, we maintain ultimate responsibility for the tax return's compliance and for providing the original audit report and schedules to the FTA upon request.`
        })
    }
];

export const getLouTemplateById = (templateId: string | undefined, company: Company) => {
    const template = LOU_TEMPLATES.find((item) => item.id === templateId) || LOU_TEMPLATES[0];
    return {
        template,
        formData: template.build(company)
    };
};
