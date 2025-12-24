
import React, { useState, useCallback, createContext, useContext, useEffect, useMemo } from 'react';
import { MainHeader } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { FileUpload } from './components/FileUpload';
import { InvoiceUpload } from './components/InvoiceUpload';
import { BankStatementUpload, EmiratesIdUpload, PassportUpload, VisaUpload, TradeLicenseUpload } from './components/DocumentUploads';
import { TransactionTable } from './components/TransactionTable';
import { InvoiceResults } from './components/InvoiceResults';
import { GenericResults } from './components/GenericResults';
import { RolesPermissions } from './components/RolesPermissions';
import { UserManagement } from './components/UserManagement';
import { DepartmentManagement } from './components/DepartmentManagement';
import { CustomerManagement } from './components/CustomerManagement';
import { BankStatementAnalysis } from './components/BankStatementAnalysis';
import { ProjectPage } from './components/ProjectPage';
import { SettingsPage } from './components/SettingsPage';
import { AuditLogsPage } from './components/AuditLogsPage';
import { IntegrationsPage } from './components/IntegrationsPage';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { LoadingIndicator } from './components/LoadingIndicator';
import { AuthPage } from './components/AuthPage';
import { HomePage } from './components/HomePage';
import { userService } from './services/userService';
import { departmentService } from './services/departmentService';
import { roleService } from './services/roleService';
import { customerService } from './services/customerService';
import { 
    extractTransactionsFromImage, 
    extractInvoicesData, 
    extractEmiratesIdData, 
    extractPassportData, 
    extractVisaData, 
    extractTradeLicenseData, 
    extractProjectDocuments,
    analyzeTransactions,
    generateAuditReport as generateAuditReportService,
    deduplicateTransactions,
    filterTransactionsByDate
} from './services/geminiService';
import type { Page, User, Role, Department, Customer, DocumentHistoryItem, Transaction, Invoice, BankStatementSummary, ExtractedDataObject, AnalysisResult, TrialBalanceEntry, FinancialStatements, Company, Permission, DocumentUploadPayload } from './types';
import { Part } from "@google/genai";

// Helper to convert file to base64 for Gemini
const fileToPart = (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            resolve({ inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } });
        };
        reader.onerror = reject;
    });
};

// Helper to convert PDF or Image file to an array of Parts (one per page for PDF)
const convertFileToParts = async (file: File): Promise<Part[]> => {
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const parts: Part[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // Better quality for OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                parts.push({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
            }
        }
        return parts;
    } else {
        return [await fileToPart(file)];
    }
};

// Centralized helper to generate UI preview URLs from files (for images and PDFs)
export const generatePreviewUrls = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
        if (file.type === 'application/pdf') {
            try {
                const arrayBuffer = await file.arrayBuffer();
                // @ts-ignore
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    if (context) {
                        await page.render({ canvasContext: context, viewport }).promise;
                        urls.push(canvas.toDataURL('image/jpeg', 0.8)); // Ensure JPEG for consistency and size
                    }
                }
            } catch (e) {
                console.error(`Error generating PDF preview for ${file.name}:`, e);
                urls.push('error-pdf'); 
            }
        } else if (file.type.startsWith('image/')) {
            urls.push(URL.createObjectURL(file));
        } else {
            urls.push('error-unsupported'); 
        }
    }
    return urls;
};

interface PermissionsContextType {
    hasPermission: (permissionId: string) => boolean;
    currentUser: User | null;
}

const PermissionsContext = createContext<PermissionsContextType>({ hasPermission: () => false, currentUser: null });

export const usePermissions = () => useContext(PermissionsContext);

export const App: React.FC = () => {
    // State-based navigation instead of Router
    const [activePage, setActivePage] = useState<Page>('dashboard');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showLanding, setShowLanding] = useState(true);
    
    // Data Management
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    
    const [documentHistory, setDocumentHistory] = useState<DocumentHistoryItem[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<Invoice[]>([]);

    // Processing State
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [vatInvoiceFiles, setVatInvoiceFiles] = useState<File[]>([]);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [pdfPassword, setPdfPassword] = useState('');
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    // Results State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<BankStatementSummary | null>(null);
    const [fileSummaries, setFileSummaries] = useState<Record<string, BankStatementSummary>>({});
    const [currency, setCurrency] = useState<string>('AED');
    const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedDataObject[]>([]);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [trialBalance, setTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [auditReport, setAuditReport] = useState<FinancialStatements | null>(null);
    const [isGeneratingTrialBalance, setIsGeneratingTrialBalance] = useState(false);
    const [isGeneratingAuditReport, setIsGeneratingAuditReport] = useState(false);
    const [reportsError, setReportsError] = useState<string | null>(null);

    // Project Specific
    const [ctFilingType, setCtFilingType] = useState<number | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null);
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');
    const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    const projectPages: Page[] = ['projectFinancialOverview', 'projectVatFiling', 'projectCtFiling', 'projectRegistration', 'projectAuditReport'];

    // Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            try {
                const [dbDepts, dbUsers, dbRoles, dbPerms] = await Promise.all([
                    departmentService.getDepartments(),
                    userService.getUsers(),
                    roleService.getRoles(),
                    roleService.getPermissions()
                ]);
                if (dbDepts) setDepartments(dbDepts);
                if (dbUsers) setUsers(dbUsers);
                if (dbRoles) setRoles(dbRoles);
                if (dbPerms) setPermissionsList(dbPerms);
                const dbCustomers = await customerService.getCustomers();
                if (dbCustomers) setCustomers(dbCustomers);
            } catch (e) {
                console.error("Failed to load initial data", e);
            }
        };
        if (currentUser) loadData();
    }, [currentUser]);

    const handleAddUser = async (u: Omit<User, 'id'>) => {
        try {
            const newUser = await userService.createUser(u);
            if (newUser) setUsers(prev => [...prev, newUser]);
        } catch (e: any) {
            alert(e.message || "Failed to add user.");
        }
    };

    const handleUpdateUser = async (u: User) => {
        const updatedUser = await userService.updateUser(u);
        if (updatedUser) setUsers(prev => prev.map(user => user.id === u.id ? updatedUser : user));
    };

    const handleDeleteUser = async (id: string) => {
        const success = await userService.deleteUser(id);
        if (success) setUsers(prev => prev.filter(u => u.id !== id));
    };

    const handleAddDepartment = async (name: string) => {
        try {
            const newDept = await departmentService.createDepartment(name);
            if (newDept) setDepartments(prev => [...prev, newDept]);
        } catch (e: any) {
            alert("Failed to add department: " + e.message);
        }
    };

    const handleUpdateDepartment = async (d: Department) => {
        try {
            const updated = await departmentService.updateDepartment(d);
            if (updated) setDepartments(prev => prev.map(dept => dept.id === d.id ? updated : d));
        } catch (e: any) {
            alert("Failed to update department: " + e.message);
        }
    };

    const handleDeleteDepartment = async (id: string) => {
        const success = await departmentService.deleteDepartment(id);
        if (success) setDepartments(prev => prev.filter(d => d.id !== id));
        else alert("Failed to delete department. Ensure no users are assigned to it.");
    };

    const handleAddRole = async (name: string, desc: string) => {
        try {
            const newRole = await roleService.createRole(name, desc);
            if (newRole) setRoles(prev => [...prev, newRole]);
        } catch (e: any) {
            alert("Failed to create role: " + e.message);
        }
    };

    const handleUpdateRoleDetails = async (id: string, name: string, desc: string) => {
        try {
            await roleService.updateRoleDetails(id, name, desc);
            setRoles(prev => prev.map(r => r.id === id ? { ...r, name, description: desc } : r));
        } catch (e: any) {
            alert("Failed to update role: " + e.message);
        }
    };

    const handleUpdateRolePermissions = async (id: string, perms: string[]) => {
        try {
            await roleService.updateRolePermissions(id, perms);
            setRoles(prev => prev.map(r => r.id === id ? { ...r, permissions: perms } : r));
        } catch (e: any) {
            alert("Failed to update permissions: " + e.message);
        }
    };

    const handleDeleteRole = async (id: string) => {
        try {
            await roleService.deleteRole(id);
            setRoles(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleAddCustomer = async (c: Omit<Customer, 'id'>, documents?: DocumentUploadPayload[]) => {
        try {
            const customerData = { ...c, ownerId: c.ownerId || currentUser?.id };
            const newCustomer = await customerService.createCustomer(customerData, documents);
            if (newCustomer) setCustomers(prev => [newCustomer, ...prev]);
        } catch (e: any) {
            alert("Failed to create customer: " + e.message);
        }
    };

    const handleUpdateCustomer = async (c: Customer, documents?: DocumentUploadPayload[]) => {
        try {
            const updated = await customerService.updateCustomer(c, documents);
            if (updated) setCustomers(prev => prev.map(cust => cust.id === c.id ? updated : cust));
        } catch (e: any) {
            alert("Failed to update customer: " + e.message);
        }
    };

    const handleDeleteCustomer = async (id: string) => {
        try {
            const success = await customerService.deleteCustomer(id);
            if (success) setCustomers(prev => prev.filter(c => c.id !== id));
        } catch (e: any) {
            alert("Failed to delete customer: " + e.message);
        }
    };

    const projectCompanies = useMemo(() => {
        const parsePeriodString = (str: string | undefined) => {
            if (!str) return { start: '', end: '' };
            const parts = str.split(/(?:\s+to\s+|\s+-\s+)/i);
            if (parts.length === 2) return { start: parts[0].trim(), end: parts[1].trim() };
            return { start: '', end: '' };
        };
        return customers.map(c => {
            const { start, end } = parsePeriodString(c.firstVatFilingPeriod);
            const name = c.type === 'business' ? c.companyName : `${c.firstName} ${c.lastName}`;
            return {
                id: c.id, name, address: c.billingAddress, trn: c.trn, incorporationDate: c.incorporationDate || '', businessType: c.entityType || '', financialYear: new Date().getFullYear().toString(), reportingPeriod: c.vatReportingPeriod || '', periodStart: start, periodEnd: end, dueDate: c.vatFilingDueDate,
                ctPeriodStart: c.firstCorporateTaxPeriodStart, ctPeriodEnd: c.firstCorporateTaxPeriodEnd, ctDueDate: c.corporateTaxFilingDueDate
            } as Company;
        });
    }, [customers]);

    const resetState = (keepCompany = false) => {
        setAppState('initial'); setError(null); setTransactions([]); setSalesInvoices([]); setPurchaseInvoices([]); setExtractedData([]); setSummary(null); setFileSummaries({}); setAnalysis(null); setTrialBalance(null); setAuditReport(null); setPreviewUrls([]); setSelectedFiles([]); setVatInvoiceFiles([]); setVatStatementFiles([]); setCtFilingType(null);
        if (!keepCompany) { setSelectedCompany(null); setCompanyName(''); setCompanyTrn(''); }
        setSelectedPeriod(null);
    };

    const handlePageNavigation = (page: Page) => { setActivePage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleSidebarProjectClick = (page: Page) => { resetState(false); handlePageNavigation(page); };

    const getPageTitle = (page: Page) => {
        switch(page) {
            case 'dashboard': return 'Dashboard';
            case 'rolesAndPermissions': return 'Roles & Permissions';
            case 'userManagement': return 'User Management';
            case 'departments': return 'Departments';
            case 'customers': return 'Customers';
            case 'bankStatements': return 'Bank Statements';
            case 'invoicesAndBills': return 'Invoices & Bills';
            case 'emiratesId': return 'Emirates ID';
            case 'passport': return 'Passport';
            case 'visa': return 'Visa';
            case 'tradeLicense': return 'Trade License';
            case 'bankStatementAnalysis': return 'Statement Analysis';
            case 'projectFinancialOverview': return 'Bookkeeping';
            case 'projectVatFiling': return 'VAT Filing';
            case 'projectCtFiling': return 'Corporate Tax Filing';
            case 'projectRegistration': return 'Registration';
            case 'projectAuditReport': return 'Audit Report';
            case 'settings': return 'Settings';
            case 'auditLogs': return 'Audit Logs';
            case 'integrations': return 'Integrations';
            default: return 'DocuFlow';
        }
    };

    const handleAnalyzeCurrentTransactions = async () => {
        if (transactions.length === 0) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeTransactions(transactions);
            setAnalysis(result.analysis);
            setTransactions(result.categorizedTransactions);
        } catch (err: any) {
            setAnalysisError(err.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalyzeHistoryItem = async (historyItemId: string, transactionsToAnalyze: Transaction[]) => {
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeTransactions(transactionsToAnalyze);
            setDocumentHistory(prev => prev.map(item => item.id === historyItemId ? { ...item, analysis: result.analysis, transactions: result.categorizedTransactions } : item));
        } catch (err: any) {
            setAnalysisError(err.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleUpdateHistoryItem = (updatedItem: DocumentHistoryItem) => {
        setDocumentHistory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    };

    const handleDeleteHistoryItem = (id: string) => {
        setDocumentHistory(prev => prev.filter(item => item.id !== id));
    };

    const handleFileSelect = async (files: File[] | File | null) => {
        if (!files) { setSelectedFiles([]); setPreviewUrls([]); return; }
        const fileArray = Array.isArray(files) ? files : [files];
        setSelectedFiles(fileArray);
        
        const urls = await generatePreviewUrls(fileArray);
        setPreviewUrls(urls);
    };

    const processFiles = useCallback(async (files: File[], page: Page) => {
        if (files.length === 0 && page !== 'projectVatFiling' && page !== 'projectFinancialOverview' && page !== 'projectCtFiling') return;
        setAppState('loading');
        setProgress(10);
        setProgressMessage('Preparing documents...');

        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSalesInvoices: Invoice[] = [];
            let localPurchaseInvoices: Invoice[] = [];
            let localExtractedData: ExtractedDataObject[] = [];
            let localFileSummaries: Record<string, BankStatementSummary> = {};

            let type = '';
            let title = 'Processed Document';

            if (!projectPages.includes(page)) {
                let allParts: Part[] = [];
                for (const file of files) {
                    const parts = await convertFileToParts(file);
                    allParts = [...allParts, ...parts];
                }
                setProgress(30);
                setProgressMessage('Analyzing documents with Gemini AI...');

                if (page === 'bankStatements') {
                    const result = await extractTransactionsFromImage(allParts);
                    localTransactions = result.transactions;
                    localSummary = result.summary;
                    localCurrency = result.currency;
                    type = 'Bank Statements';
                    title = `Statement - ${result.summary.accountNumber || 'Unknown'}`;
                } else if (page === 'invoicesAndBills') {
                    const result = await extractInvoicesData(allParts, knowledgeBase, companyName, companyTrn);
                    localSalesInvoices = result.invoices.filter(i => i.invoiceType === 'sales');
                    localPurchaseInvoices = result.invoices.filter(i => i.invoiceType === 'purchase');
                    type = 'Invoices & Bills';
                    title = `Invoices Batch (${result.invoices.length})`;
                } else if (['emiratesId', 'passport', 'visa', 'tradeLicense'].includes(page)) {
                    let res;
                    if (page === 'emiratesId') { res = await extractEmiratesIdData(allParts); type = 'Emirates ID'; }
                    else if (page === 'passport') { res = await extractPassportData(allParts); type = 'Passport'; }
                    else if (page === 'visa') { res = await extractVisaData(allParts); type = 'Visa'; }
                    else { res = await extractTradeLicenseData(allParts); type = 'Trade License'; }
                    localExtractedData = res?.documents ? res.documents.map((d: any) => ({ documentType: type, documentTitle: d.name || d.companyName || 'Document', data: d })) : [];
                }
            } else {
                const isCtType1 = (page === 'projectCtFiling' && ctFilingType === 1);
                const isSplitProcessing = (page === 'projectVatFiling' || page === 'projectFinancialOverview' || (page === 'projectCtFiling' && ctFilingType === 2));
                
                if (isSplitProcessing || isCtType1) {
                    if (vatStatementFiles.length > 0) {
                        setProgressMessage('Processing Bank Statements...');
                        let allRawTransactions: Transaction[] = [];
                        let firstSummary: BankStatementSummary | null = null;
                        let processedCurrency = 'AED';
                        let processedCount = 0;

                        for (const file of vatStatementFiles) {
                            setProgressMessage(`Processing ${file.name} (${processedCount + 1}/${vatStatementFiles.length})...`);
                            const parts = await convertFileToParts(file);
                            const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                            
                            const taggedTransactions = result.transactions.map(t => ({ ...t, sourceFile: file.name }));
                            allRawTransactions = [...allRawTransactions, ...taggedTransactions];
                            if (!firstSummary) { firstSummary = result.summary; processedCurrency = result.currency; }
                            localFileSummaries[file.name] = result.summary;
                            processedCount++;
                        }
                        
                        const filteredByPeriod = filterTransactionsByDate(allRawTransactions, selectedPeriod?.start, selectedPeriod?.end);
                        localTransactions = deduplicateTransactions(filteredByPeriod);
                        
                        localSummary = firstSummary;
                        localCurrency = processedCurrency;
                        
                        setProgress(60);
                    }
                    if (isSplitProcessing && vatStatementFiles.length > 0 && vatInvoiceFiles.length > 0) {
                         await new Promise(resolve => setTimeout(resolve, 8000));
                    }
                    if (isSplitProcessing && vatInvoiceFiles.length > 0) {
                        setProgressMessage('Processing Invoices...');
                        let invParts: Part[] = [];
                        for (const file of vatInvoiceFiles) {
                            const parts = await convertFileToParts(file);
                            invParts = [...invParts, ...parts];
                        }
                        const invResult = await extractInvoicesData(invParts, knowledgeBase, companyName, companyTrn);
                        localSalesInvoices = invResult.invoices.filter(i => i.invoiceType === 'sales');
                        localPurchaseInvoices = invResult.invoices.filter(i => i.invoiceType === 'purchase');
                        if (vatStatementFiles.length === 0) localCurrency = invResult.invoices[0]?.currency || 'AED';
                        setProgress(90);
                    }
                    type = isCtType1 ? 'Corporate Tax Filing' : (page === 'projectVatFiling' ? 'VAT Filing Project' : 'Project Workspace');
                    title = isCtType1 ? `CT Filing - ${companyName || 'Unknown'}` : `Project - ${companyName || 'New Project'}`;
                } else { // Generic project document upload
                    let allParts: Part[] = [];
                    for (const file of files) {
                        const parts = await convertFileToParts(file);
                        allParts = [...allParts, ...parts];
                    }
                    const res = await extractProjectDocuments(allParts, companyName, companyTrn);
                    localTransactions = selectedPeriod ? filterTransactionsByDate(res.transactions, selectedPeriod.start, selectedPeriod.end) : res.transactions;
                    localSalesInvoices = res.salesInvoices;
                    localPurchaseInvoices = res.purchaseInvoices;
                    localSummary = res.summary;
                    localCurrency = res.currency || 'AED';
                    localExtractedData = [
                        ...res.emiratesIds.map(d => ({ documentType: 'Emirates ID', documentTitle: d.name, data: d })),
                        ...res.tradeLicenses.map(d => ({ documentType: 'Trade License', documentTitle: d.companyName, data: d }))
                    ];
                    type = 'Project Document Analysis';
                    title = `Project - ${companyName || 'New Project'}`;
                }
            }

            setTransactions(localTransactions);
            setSummary(localSummary);
            setCurrency(localCurrency);
            setSalesInvoices(localSalesInvoices);
            setPurchaseInvoices(localPurchaseInvoices);
            setExtractedData(localExtractedData);
            setFileSummaries(localFileSummaries);

            setProgress(100);
            setAppState('success');
            
            const historyItem: DocumentHistoryItem = {
                id: Date.now().toString(),
                type: type || 'Unknown',
                title: title,
                processedAt: new Date().toISOString(),
                pageCount: files.length + vatInvoiceFiles.length + vatStatementFiles.length,
                processedBy: currentUser?.name || 'User',
                transactions: (page === 'bankStatements' || (page === 'projectCtFiling' && ctFilingType === 1)) ? localTransactions : undefined,
                summary: (page === 'bankStatements' || (page === 'projectCtFiling' && ctFilingType === 1)) ? localSummary || undefined : undefined,
                currency: (page === 'bankStatements' || (page === 'projectCtFiling' && ctFilingType === 1)) ? localCurrency || undefined : undefined,
                salesInvoices: (page === 'invoicesAndBills' || page === 'projectVatFiling') ? localSalesInvoices : undefined,
                purchaseInvoices: (page === 'invoicesAndBills' || page === 'projectVatFiling') ? localPurchaseInvoices : undefined,
                extractedData: localExtractedData
            };
            setDocumentHistory(prev => [historyItem, ...prev]);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to process documents.');
            setAppState('error');
        }
    }, [knowledgeBase, companyName, companyTrn, currentUser, projectPages, vatInvoiceFiles, vatStatementFiles, ctFilingType, selectedPeriod]);

    const onPasswordChange = (password: string) => setPdfPassword(password);

    const handleConfirmProcess = useCallback(() => {
        setIsConfirmModalOpen(false);
        let filesToProcess: File[] = [];
        if (activePage === 'bankStatements') filesToProcess = selectedFiles;
        else if (projectPages.includes(activePage)) {
             if (activePage === 'projectVatFiling' || activePage === 'projectFinancialOverview' || (activePage === 'projectCtFiling' && ctFilingType === 2)) filesToProcess = [...vatInvoiceFiles, ...vatStatementFiles];
             else if (activePage === 'projectCtFiling' && ctFilingType === 1) filesToProcess = [...vatStatementFiles];
             else if (activePage === 'projectCtFiling' && (ctFilingType === 3 || ctFilingType === 4)) filesToProcess = [...vatInvoiceFiles];
             else filesToProcess = selectedFiles;
        } else filesToProcess = selectedFiles;
        processFiles(filesToProcess, activePage).catch(err => { setError((err as Error).message || "An unknown error occurred."); setAppState('error'); });
    }, [processFiles, activePage, selectedFiles, vatInvoiceFiles, vatStatementFiles, ctFilingType, projectPages]);

    const handleImportClick = () => setIsConfirmModalOpen(true);

    const handleGenerateTrialBalance = useCallback((txs: Transaction[]) => {
        setIsGeneratingTrialBalance(true);
        setTimeout(() => {
            const balances: Record<string, { debit: number, credit: number }> = {};
            let bankDebit = 0; let bankCredit = 0;
            txs.forEach(t => {
                const parts = (t.category || 'Uncategorized').split('|');
                const accountName = parts[parts.length - 1].trim();
                if (!balances[accountName]) balances[accountName] = { debit: 0, credit: 0 };
                if (t.debit > 0) { balances[accountName].debit += t.debit; bankCredit += t.debit; }
                if (t.credit > 0) { balances[accountName].credit += t.credit; bankDebit += t.credit; }
            });
            const tbEntries: TrialBalanceEntry[] = Object.entries(balances).map(([account, { debit, credit }]) => ({ account, debit, credit }));
            tbEntries.push({ account: 'Bank Account', debit: bankDebit, credit: bankCredit });
            setTrialBalance(tbEntries);
            setIsGeneratingTrialBalance(false);
        }, 1000);
    }, []);

    const handleGenerateAuditReport = useCallback(async (tb: TrialBalanceEntry[], company: string) => {
        setIsGeneratingAuditReport(true);
        try {
            const { report } = await generateAuditReportService(tb, company);
            setAuditReport(report);
        } catch (err: any) {
            setReportsError("Failed to generate audit report. Please try again.");
        } finally {
            setIsGeneratingAuditReport(false);
        }
    }, []);

    if (!currentUser) {
        if (showLanding) return <HomePage onGetStarted={() => setShowLanding(false)} />;
        return <AuthPage onLogin={setCurrentUser} />;
    }

    const commonFileUploadProps = {
        onFileSelect: (f: File | null) => handleFileSelect(f),
        selectedFile: selectedFiles[0],
        previewUrls: previewUrls,
        pdfPassword: pdfPassword,
        onPasswordChange: onPasswordChange,
        onProcess: handleImportClick
    };

    const renderContent = () => {
        switch (activePage) {
            case 'dashboard':
                return <Dashboard documentHistory={documentHistory} setActivePage={handlePageNavigation} users={users} currentUser={currentUser} />;
            case 'rolesAndPermissions':
                return <RolesPermissions roles={roles} allPermissions={permissionsList} onUpdateRolePermissions={handleUpdateRolePermissions} onUpdateRoleDetails={handleUpdateRoleDetails} onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} />;
            case 'userManagement':
                return <UserManagement users={users} roles={roles} departments={departments} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
            case 'departments':
                return <DepartmentManagement departments={departments} users={users} onAddDepartment={handleAddDepartment} onUpdateDepartment={handleUpdateDepartment} onDeleteDepartment={handleDeleteDepartment} />;
            case 'customers':
                // Fix: Corrected scope variables 'c', 'start', 'end' to 'cust' and properly parsed period string in onSelectCustomerProject callback.
                return <CustomerManagement customers={customers} users={users} onAddCustomer={handleAddCustomer} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} onSelectCustomerProject={(cust, page) => { 
                    const parsePeriodString = (str: string | undefined) => {
                        if (!str) return { start: '', end: '' };
                        const parts = str.split(/(?:\s+to\s+|\s+-\s+)/i);
                        if (parts.length === 2) return { start: parts[0].trim(), end: parts[1].trim() };
                        return { start: '', end: '' };
                    };
                    const { start, end } = parsePeriodString(cust.firstVatFilingPeriod);
                    setSelectedCompany({...cust, name: cust.type === 'business' ? cust.companyName : `${cust.firstName} ${cust.lastName}`, address: cust.billingAddress, trn: cust.trn, incorporationDate: cust.incorporationDate || '', businessType: cust.entityType || '', financialYear: new Date().getFullYear().toString(), reportingPeriod: cust.vatReportingPeriod || '', periodStart: start, periodEnd: end, dueDate: cust.vatFilingDueDate,
                ctPeriodStart: cust.firstCorporateTaxPeriodStart, ctPeriodEnd: cust.firstCorporateTaxPeriodEnd, ctDueDate: cust.corporateTaxFilingDueDate } as any); handlePageNavigation(page); }} />;
            case 'bankStatements':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <TransactionTable transactions={transactions} onReset={() => resetState(false)} previewUrls={previewUrls} summary={summary} currency={currency} analysis={analysis} isAnalyzing={isAnalyzing} analysisError={analysisError} onAnalyze={handleAnalyzeCurrentTransactions} /> : <BankStatementUpload {...commonFileUploadProps} />);
            case 'invoicesAndBills':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <InvoiceResults invoices={[...salesInvoices, ...purchaseInvoices]} onReset={() => resetState(false)} previewUrls={previewUrls} knowledgeBase={knowledgeBase} onAddToKnowledgeBase={(inv) => setKnowledgeBase(prev => [...prev, inv])} onUpdateInvoice={() => {}} /> : <InvoiceUpload onFilesSelect={handleFileSelect} selectedFiles={selectedFiles} showCompanyFields={true} pageConfig={{ title: 'Invoices & Bills', subtitle: 'Upload invoices for analysis', uploadButtonText: 'Add Invoices' }} knowledgeBase={knowledgeBase} pdfPassword={pdfPassword} onPasswordChange={onPasswordChange} companyName={companyName} onCompanyNameChange={setCompanyName} companyTrn={companyTrn} onCompanyTrnChange={setCompanyTrn} onProcess={handleImportClick} />);
            case 'emiratesId':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <GenericResults data={extractedData} onReset={() => resetState(false)} previewUrls={previewUrls} title="Emirates ID" /> : <EmiratesIdUpload {...commonFileUploadProps} />);
            case 'passport':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <GenericResults data={extractedData} onReset={() => resetState(false)} previewUrls={previewUrls} title="Passport" /> : <PassportUpload {...commonFileUploadProps} />);
            case 'visa':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <GenericResults data={extractedData} onReset={() => resetState(false)} previewUrls={previewUrls} title="Visa" /> : <VisaUpload {...commonFileUploadProps} />);
            case 'tradeLicense':
                return appState === 'loading' ? <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div> : (appState === 'success' ? <GenericResults data={extractedData} onReset={() => resetState(false)} previewUrls={previewUrls} title="Trade License" /> : <TradeLicenseUpload {...commonFileUploadProps} />);
            case 'bankStatementAnalysis':
                return <BankStatementAnalysis documentHistory={documentHistory} onUpdateHistoryItem={handleUpdateHistoryItem} onDeleteHistoryItem={handleDeleteHistoryItem} onAnalyzeTransactions={handleAnalyzeHistoryItem} isAnalyzing={isAnalyzing} analysisError={analysisError} />;
            case 'projectFinancialOverview': case 'projectVatFiling': case 'projectCtFiling': case 'projectRegistration': case 'projectAuditReport':
                return <ProjectPage 
                    key={`${activePage}-${selectedCompany?.id || 'no-comp'}-${appState}-${selectedPeriod ? selectedPeriod.start + selectedPeriod.end : 'no-period'}`}
                    appState={appState} handleReset={() => resetState(true)} transactions={transactions} salesInvoices={salesInvoices} purchaseInvoices={purchaseInvoices} summary={summary} currency={currency} previewUrls={previewUrls} knowledgeBase={knowledgeBase} onAddToKnowledgeBase={(inv) => setKnowledgeBase(prev => [...prev, inv])} onRemoveFromKnowledgeBase={() => {}} error={error} progress={progress} progressMessage={progressMessage} onFilesSelect={handleFileSelect} selectedFiles={selectedFiles} pdfPassword={pdfPassword} onPasswordChange={onPasswordChange} companyName={companyName} onCompanyNameChange={setCompanyName} companyTrn={companyTrn} onCompanyTrnChange={setCompanyTrn} pageConfig={{ title: getPageTitle(activePage), subtitle: 'Manage your filing' }} extractedData={extractedData} vatInvoiceFiles={vatInvoiceFiles} onVatInvoiceFilesSelect={setVatInvoiceFiles} vatStatementFiles={vatStatementFiles} onVatStatementFilesSelect={setVatStatementFiles} ctFilingType={ctFilingType} onCtFilingTypeSelect={(type) => { setCtFilingType(type); if (type === 3) setAppState('success'); }} onUpdateTransactionCategory={() => {}} onSuggestCategory={() => {}} isSuggestingCategory={isSuggestingCategory} suggestionError={suggestionError} onGenerateTrialBalance={handleGenerateTrialBalance} onGenerateAuditReport={handleGenerateAuditReport} onUpdateProjectTransactions={setTransactions} trialBalance={trialBalance} auditReport={auditReport} isGeneratingTrialBalance={isGeneratingTrialBalance} isGeneratingAuditReport={isGeneratingAuditReport} reportsError={reportsError} companies={projectCompanies} selectedCompany={selectedCompany} onPeriodSelect={(start, end) => { setSelectedPeriod({ start: start.trim(), end: end.trim() }); }} onAddCompany={async (newComp) => {
                    const newCust: Omit<Customer, 'id'> = { 
                        type: 'business', 
                        salutation: '', 
                        firstName: '', 
                        lastName: '', 
                        companyName: newComp.name, 
                        billingAddress: newComp.address, 
                        trn: newComp.trn, 
                        incorporationDate: newComp.incorporationDate, 
                        email: '', 
                        workPhone: '', 
                        mobile: '', 
                        currency: 'AED', 
                        language: 'English', 
                        shippingAddress: '', 
                        remarks: '', 
                        taxTreatment: 'VAT Registered', 
                        portalAccess: false, 
                        entityType: newComp.businessType, 
                        vatReportingPeriod: newComp.reportingPeriod as any, 
                        vatFilingDueDate: newComp.dueDate, 
                        firstVatFilingPeriod: newComp.periodStart && newComp.periodEnd ? `${newComp.periodStart} - ${newComp.periodEnd}` : undefined,
                        corporateTaxTreatment: 'Not Registered', 
                        corporateTaxTrn: '', 
                        corporateTaxRegisteredDate: '', 
                        corporateTaxPeriod: '', 
                        firstCorporateTaxPeriodStart: newComp.ctPeriodStart,
                        firstCorporateTaxPeriodEnd: newComp.ctPeriodEnd,
                        corporateTaxFilingDueDate: newComp.ctDueDate,
                        businessRegistrationNumber: '', 
                        placeOfSupply: 'Dubai', 
                        openingBalance: 0, 
                        paymentTerms: 'Net 30', 
                        ownerId: currentUser?.id,
                        contactPersons: [], 
                        documents: [], 
                    };
                    try {
                        const created = await customerService.createCustomer(newCust);
                        if (created) { setCustomers(prev => [...prev, created]); setSelectedCompany({ ...created, name: created.companyName, address: created.billingAddress, trn: created.trn } as any); setCompanyName(created.companyName); setCompanyTrn(created.trn); }
                    } catch (e: any) { alert("Failed to add company: " + e.message); }
                }} onSelectCompany={(comp) => { setSelectedCompany(comp); if (comp) { setCompanyName(comp.name); setCompanyTrn(comp.trn); } }} onUpdateSalesInvoice={() => {}} onUpdatePurchaseInvoice={() => {}} fileSummaries={fileSummaries} onProcess={handleImportClick} />;
            case 'settings': return <SettingsPage />;
            case 'auditLogs': return <AuditLogsPage />;
            case 'integrations': return <IntegrationsPage />;
            default: return <Dashboard documentHistory={documentHistory} setActivePage={handlePageNavigation} users={users} currentUser={currentUser} />;
        }
    };

    return (
        <PermissionsContext.Provider value={{ hasPermission: (permissionId) => { if (!currentUser) return false; const role = roles.find(r => r.id === currentUser.roleId); return role ? role.permissions.includes(permissionId) : false; }, currentUser }}>
            <div className="flex h-screen bg-black text-white font-sans">
                <Sidebar onProjectClick={handleSidebarProjectClick} isCollapsed={isSidebarCollapsed} roles={roles} activePage={activePage} onNavigate={handlePageNavigation} />
                <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
                    <MainHeader title={getPageTitle(activePage)} subtitle="AI Document Processing" currentUser={currentUser} departments={departments} onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} onLogout={() => { setCurrentUser(null); setShowLanding(true); setActivePage('dashboard'); }} />
                    <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">{renderContent()}</main>
                </div>
                <ConfirmationDialog isOpen={isConfirmModalOpen} onConfirm={handleConfirmProcess} onCancel={() => setIsConfirmModalOpen(false)} title="Start Processing?">Are you sure you want to process the selected files?</ConfirmationDialog>
            </div>
        </PermissionsContext.Provider>
    );
};
