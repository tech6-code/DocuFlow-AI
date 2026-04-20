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
        label: "No Activity / Dormant",
        description: "Company with no corporate bank account or business activity.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Regarding Bank Statements and Business Activities",
                content: `This letter addresses the Corporate Tax return filing for ${name} for the period ${period}.\n\nWe hereby confirm that the company, ${name} does not possess bank statements for the aforementioned period due to the absence of a corporate bank account.\n\nFor the period under review, the company had no business activities or transactions. This includes the absence of any sale, purchase or operational activity. Revenue for the period is AED ${REVENUE_PLACEHOLDER}.\n\nWe certify that all submitted data is accurate and complete to the best of our knowledge. We remain available should you require further documentation.`
            };
        }
    },
    {
        id: "type2",
        label: "VAT Returns Based",
        description: "Filing based on previously filed VAT returns.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Regarding Corporate Tax Filing Based on VAT Returns",
                content: `This letter addresses the Corporate Tax return filing for ${name} for the period ${period}.\n\nWe confirm that the filing is based on our filed VAT Returns. Accordingly, all turnover and purchase figures are derived from these returns.\n\nThe revenue for this period is AED ${REVENUE_PLACEHOLDER}.\n\nWe certify that all submitted data is accurate and complete to the best of our knowledge. We remain available should you require further documentation.`
            };
        }
    },
    {
        id: "type3",
        label: "Bank Statements Based",
        description: "Filing based on provided bank statement transactions.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Regarding Corporate Tax Filing Based on Bank Statements",
                content: `This letter addresses the Corporate Tax return filing for ${name} for the period ${period}.\n\nWe confirm that this filing is based on the provided bank statements, which serve as the basis for our purchases and turnover.\n\nThe total revenue for this period is AED ${REVENUE_PLACEHOLDER}.\n\nWe certify that all submitted data is accurate and complete to the best of our knowledge. We remain available should you require further documentation.`
            };
        }
    },
    {
        id: "type4",
        label: "Audit Report Based",
        description: "Filing based strictly on the audit report.",
        heading: STANDARD_HEADING,
        build: (company, periodOverride) => {
            const name = getTaxablePerson(company) || "(Company Name)";
            const period = getPeriodInline(company, periodOverride);
            return {
                ...baseTemplate(company, periodOverride),
                heading: STANDARD_HEADING,
                subject: "Regarding Corporate Tax Filing Based on Audit Report",
                content: `This letter addresses the Corporate Tax return filing for ${name} for the period ${period}.\n\nWe confirm that this filing is based strictly on the provided Audit Report.\n\nThe declared revenue for this corporate tax period is AED ${REVENUE_PLACEHOLDER}.\n\nWe certify that all submitted data is accurate and complete to the best of our knowledge. We remain available should you require further documentation.`
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
