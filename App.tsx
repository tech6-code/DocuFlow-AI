import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Layout } from './components/Layout';
import { HomePage } from './components/HomePage';
import { AuthPage } from './components/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { RolesPermissionsPage } from './pages/RolesPermissionsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { DepartmentManagementPage } from './pages/DepartmentManagementPage';
import { CustomerManagementPage } from './pages/CustomerManagementPage';
import { BankStatementsPage } from './pages/BankStatementsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { GenericDocumentPage } from './pages/GenericDocumentPage';
import { BankStatementAnalysisPage } from './pages/BankStatementAnalysisPage';
import { ProjectPageWrapper } from './pages/ProjectPageWrapper';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { EmiratesIdUpload } from './components/EmiratesIdUpload';
import { PassportUpload } from './components/PassportUpload';
import { VisaUpload } from './components/VisaUpload';
import { TradeLicenseUpload } from './components/TradeLicenseUpload';

// Helper component to handle Auth/Home vs App logic
const AppContent: React.FC = () => {
    const { currentUser, login } = useAuth();
    const [showLanding, setShowLanding] = useState(true);

    if (!currentUser) {
        if (showLanding) return <HomePage onGetStarted={() => setShowLanding(false)} />;
        return <AuthPage onLogin={login} />;
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/roles-permissions" element={<RolesPermissionsPage />} />
                    <Route path="/users" element={<UserManagementPage />} />
                    <Route path="/departments" element={<DepartmentManagementPage />} />
                    <Route path="/customers" element={<CustomerManagementPage />} />

                    <Route path="/bank-statements" element={<BankStatementsPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />

                    <Route path="/emirates-id" element={<GenericDocumentPage documentType="Emirates ID" title="Emirates ID" UploadComponent={EmiratesIdUpload} />} />
                    <Route path="/passport" element={<GenericDocumentPage documentType="Passport" title="Passport" UploadComponent={PassportUpload} />} />
                    <Route path="/visa" element={<GenericDocumentPage documentType="Visa" title="Visa" UploadComponent={VisaUpload} />} />
                    <Route path="/trade-license" element={<GenericDocumentPage documentType="Trade License" title="Trade License" UploadComponent={TradeLicenseUpload} />} />

                    <Route path="/analysis" element={<BankStatementAnalysisPage />} />

                    <Route path="/projects/bookkeeping" element={<ProjectPageWrapper pageType="projectFinancialOverview" />} />
                    <Route path="/projects/vat-filing" element={<ProjectPageWrapper pageType="projectVatFiling" />} />
                    <Route path="/projects/ct-filing" element={<ProjectPageWrapper pageType="projectCtFiling" />} />
                    <Route path="/projects/registration" element={<ProjectPageWrapper pageType="projectRegistration" />} />
                    <Route path="/projects/audit-report" element={<ProjectPageWrapper pageType="projectAuditReport" />} />

                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
};

export const App: React.FC = () => {
    return (
        <AuthProvider>
            <DataProvider>
                <AppContent />
            </DataProvider>
        </AuthProvider>
    );
};
