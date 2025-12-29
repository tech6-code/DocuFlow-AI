import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
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
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { EmiratesIdUpload } from './components/EmiratesIdUpload';
import { PassportUpload } from './components/PassportUpload';
import { VisaUpload } from './components/VisaUpload';
import { TradeLicenseUpload } from './components/TradeLicenseUpload';
import { BookkeepingPage } from './pages/BookkeepingPage';
import { VatFilingPage } from './pages/VatFilingPage';
import { CtFilingPage } from './pages/CtFilingPage';
import { Type1FilingPeriod } from './components/Type1FilingPeriod';
import { Type2FilingPeriod } from './components/Type2FilingPeriod';
import { Type3FilingPeriod } from './components/Type3FilingPeriod';
import { Type4FilingPeriod } from './components/Type4FilingPeriod';
import { RegistrationPage } from './pages/RegistrationPage';
import { AuditReportPage } from './pages/AuditReportPage';

// Auth Guard
const RequireAuth = () => {
    const { currentUser } = useAuth();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

// Layout Wrapper to ensure Layout is only used for protected routes
// If you want Layout to be part of RequireAuth, you can nest it there.
// Or have RequireAuth return <Layout><Outlet /></Layout>

const AppRoutes: React.FC = () => {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="signup" />} />

            {/* Protected Routes */}
            <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />

                    {/* Admin/Management */}
                    <Route path="/roles-permissions" element={<RolesPermissionsPage />} />
                    <Route path="/users" element={<UserManagementPage />} />
                    <Route path="/departments" element={<DepartmentManagementPage />} />
                    <Route path="/customers" element={<CustomerManagementPage />} />

                    {/* Documents */}
                    <Route path="/bank-statements" element={<BankStatementsPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />

                    {/* Uploads */}
                    <Route path="/emirates-id" element={<GenericDocumentPage documentType="Emirates ID" title="Emirates ID" UploadComponent={EmiratesIdUpload} />} />
                    <Route path="/passport" element={<GenericDocumentPage documentType="Passport" title="Passport" UploadComponent={PassportUpload} />} />
                    <Route path="/visa" element={<GenericDocumentPage documentType="Visa" title="Visa" UploadComponent={VisaUpload} />} />
                    <Route path="/trade-license" element={<GenericDocumentPage documentType="Trade License" title="Trade License" UploadComponent={TradeLicenseUpload} />} />

                    {/* Analysis */}
                    <Route path="/analysis" element={<BankStatementAnalysisPage />} />

                    {/* Projects */}
                    <Route path="/projects/bookkeeping" element={<BookkeepingPage />} />
                    <Route path="/projects/vat-filing" element={<VatFilingPage />} />
                    <Route path="/projects/ct-filing" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId/type1/filing-period" element={<Type1FilingPeriod />} />
                    <Route path="/projects/ct-filing/:customerId/type1/upload" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId/type2/filing-period" element={<Type2FilingPeriod />} />
                    <Route path="/projects/ct-filing/:customerId/type2/upload" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId/type3/filing-period" element={<Type3FilingPeriod />} />
                    <Route path="/projects/ct-filing/:customerId/type3/upload" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId/type4/filing-period" element={<Type4FilingPeriod />} />
                    <Route path="/projects/ct-filing/:customerId/type4/upload" element={<CtFilingPage />} />
                    <Route path="/projects/registration" element={<RegistrationPage />} />
                    <Route path="/projects/audit-report" element={<AuditReportPage />} />

                    {/* System */}
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />
                </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export const App: React.FC = () => {
    return (
        <AuthProvider>
            <DataProvider>
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
            </DataProvider>
        </AuthProvider>
    );
};
