import type { Company } from "../types";

export interface LouFormData {
    date: string;
    to: string;
    subject: string;
    taxablePerson: string;
    taxPeriod: string;
    trn: string;
    heading: string;
    revenue: string;
    content: string;
    signatoryName: string;
    designation: string;
}

export interface LouPeriodOverride {
    from?: string;
    to?: string;
}

export interface LouTemplateDefinition {
    id: "type1" | "type2" | "type3" | "type4" | "custom";
    label: string;
    description: string;
    heading: string;
    build: (company: Company, period?: LouPeriodOverride) => LouFormData;
}

const getTodayInputDate = () => new Date().toISOString().split("T")[0];

const resolvePeriod = (company: Company, override?: LouPeriodOverride) => ({
    from: (override?.from && override.from.trim()) || company.ctPeriodStart || "",
    to: (override?.to && override.to.trim()) || company.ctPeriodEnd || ""
});

const getTaxPeriodLabel = (company: Company, override?: LouPeriodOverride) => {
    const { from, to } = resolvePeriod(company, override);
    return `FOR THE PERIOD FROM ${from || "-"} TO ${to || "-"}`;
};

const getPeriodInline = (company: Company, override?: LouPeriodOverride) => {
    const { from, to } = resolvePeriod(company, override);
    return `${from || "(Dates)"} to ${to || "(Dates)"}`;
};

const getTaxablePerson = (company: Company) => company.name || "";

const getTrn = (company: Company) => company.corporateTaxTrn || company.trn || "";

const STANDARD_HEADING = "Management Representation Regarding Corporate Tax Computation & Filing";

const baseTemplate = (company: Company, period?: LouPeriodOverride) => ({
    date: getTodayInputDate(),
    to: "The VAT Consultant LLC",
    subject: "Regarding Corporate Tax Computation and Filing",
    taxablePerson: getTaxablePerson(company),
    taxPeriod: getTaxPeriodLabel(company, period),
    trn: getTrn(company),
    revenue: "",
    signatoryName: "",
    designation: ""
});

const REVENUE_PLACEHOLDER = "{{REVENUE}}";

export const LOU_TEMPLATES: LouTemplateDefinition[] = [
    {
        id: "type1",
        label: "Legal Expenses Case",
        description: "No bank account or business activity; only legal expenses incurred.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Undertaking Regarding Bank Statements, Business Activity and Legal expenses",
                content: `I am writing to formally address the matter of bank statements and business activities of **${name}** in relation to CORPORATE TAX Filing for the Period **${period}**.\n\nWe hereby confirm that **${name}** does not possess any bank statements for the period under review. This situation may arise due to the absence of a bank account for our company.\nThe revenue for the CT period is AED **${REVENUE_PLACEHOLDER}**.\n\nOur Company had no business activities or transactions during the aforementioned period. This includes the absence of my sales, purchases, or operational activities. We have incurred only Legal expenses for the aforementioned period.\n\nWe confirm that all financial data and supporting materials submitted for the purpose of this report are, to the best of my knowledge, accurate and complete.\n\nWe understand the importance of these documents in the CORPORATE TAX Filing Process and are committed to assisting you way possible. Should you require any further details or supporting documentation, please do not hesitate to contact us.\n\nThank you for your understanding.`
            };
        }
    },
    {
        id: "type2",
        label: "VAT Registered Case",
        description: "Filing based on VAT Returns filed by the company.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Undertaking Regarding Corporate Tax Filing Based on VAT RETURNS.",
                content: `I am writing to formally address the matter of Corporate Tax Return filing of **${name}** for the period **${period}**.\n\nWe hereby confirm that for **${name}** the Corporate Tax return filing is based on the VAT Returns filed by us. The purchases and turnover are considered based on the VAT Returns.\nThe revenue for the CT Period **${period}** is AED **${REVENUE_PLACEHOLDER}**.\n\nI confirm that all financial data and supporting materials submitted for the purpose of this return are, to the best of my knowledge, accurate, complete, and free from material misstatement\nI accept full responsibility for the content and accuracy of this data.\n\nWe understand the importance of these documents in the CORPORATE TAX Filing Process and are committed to assisting you way possible. Should you require any further details or supporting documentation, please do not hesitate to contact us.\n\nThank you for your understanding.`
            };
        }
    },
    {
        id: "type3",
        label: "Non-VAT Registered Case",
        description: "Filing based on bank statements provided by the company.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Undertaking Regarding Corporate Tax Filing Based on Bank statements.",
                content: `I am writing to formally address the matter of Corporate Tax Return filing of **${name}** for the period **${period}**.\n\nWe hereby confirm that for **${name}** the Corporate Tax return filing is based on the Bank statements provided by us. The purchases and turnover are considered based on the bank statements and our requirements.\nThe revenue for the CT Period **${period}** is AED **${REVENUE_PLACEHOLDER}**.\n\nI confirm that all financial data and supporting materials submitted for the purpose of this return are, to the best of my knowledge, accurate, complete, and free from material misstatement\nI accept full responsibility for the content and accuracy of this data.\n\nWe understand the importance of these documents in the CORPORATE TAX Filing Process and are committed to assisting you way possible. Should you require any further details or supporting documentation, please do not hesitate to contact us.\n\nThank you for your understanding.`
            };
        }
    },
    {
        id: "type4",
        label: "Audit Report Case",
        description: "Filing based on the Audit Report provided by the company.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Undertaking Regarding Corporate Tax Filing Based on Audit Report.",
                content: `I am writing to formally address the matter of Corporate Tax Return filing of **${name}** for the period **${period}**.\n\nWe hereby confirm that for **${name}** the Corporate Tax return filing is based on the Audit Report provided by us.\nThe revenue for the CT Period **${period}** is AED **${REVENUE_PLACEHOLDER}**.\n\nI confirm that all financial data and supporting materials submitted for the purpose of this return are, to the best of my knowledge, accurate, complete, and free from material misstatement.\n\nI accept full responsibility for the content and accuracy of the data.\n\nWe understand the importance of these documents in the CORPORATE TAX Filing Process and are committed to assisting you way possible. Should you require any further details or supporting documentation, please do not hesitate to contact us.\n\nThank you for your understanding.`
            };
        }
    },
    {
        id: "custom",
        label: "Custom",
        description: "Blank declaration body with customer details prefilled.",
        heading: "CLIENT DECLARATION & REPRESENTATION LETTER",
        build: (company, periodOverride) => ({
            ...baseTemplate(company, periodOverride),
            heading: "CLIENT DECLARATION & REPRESENTATION LETTER",
            content: ""
        })
    }
];

export const getLouTemplateById = (
    templateId: string | undefined,
    company: Company,
    periodOverride?: LouPeriodOverride
) => {
    const template = LOU_TEMPLATES.find((item) => item.id === templateId) || LOU_TEMPLATES[0];
    return {
        template,
        formData: template.build(company, periodOverride)
    };
};
