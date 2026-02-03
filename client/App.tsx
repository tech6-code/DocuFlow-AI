import React from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
    Outlet,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";

import { Layout } from "./components/Layout";
import { HomePage } from "./components/HomePage";
import { AuthPage } from "./components/AuthPage";
import { SimpleLoading } from "./components/SimpleLoading";

import { DashboardPage } from "./pages/DashboardPage";
import { RolesPermissionsPage } from "./pages/RolesPermissionsPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { DepartmentManagementPage } from "./pages/DepartmentManagementPage";
import { CustomerManagementPage } from "./pages/CustomerManagementPage";
import { BankStatementsPage } from "./pages/BankStatementsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { GenericDocumentPage } from "./pages/GenericDocumentPage";
import { BankStatementAnalysisPage } from "./pages/BankStatementAnalysisPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { BookkeepingPage } from "./pages/BookkeepingPage";
import { VatFilingPage } from "./pages/VatFilingPage";
import { CtFilingPage } from "./pages/CtFilingPage";
import { CtFilingPeriodsList } from "./components/CtFilingPeriodsList";
import { CtAddFilingPeriod } from "./components/CtAddFilingPeriod";
import { CtEditFilingPeriod } from "./components/CtEditFilingPeriod";
import { RegistrationPage } from "./pages/RegistrationPage";
import { AuditReportPage } from "./pages/AuditReportPage";

import { EmiratesIdUpload } from "./components/EmiratesIdUpload";
import { PassportUpload } from "./components/PassportUpload";
import { VisaUpload } from "./components/VisaUpload";
import { TradeLicenseUpload } from "./components/TradeLicenseUpload";
import { StepDispatcher } from "./components/ctfiling/StepDispatcher";
import { LeadsPage } from "./pages/LeadsPage";
import { DealsPage } from "./pages/DealsPage";
import { SalesSettingsPage } from "./pages/SalesSettingsPage";
import { LeadFormPage } from "./pages/LeadFormPage";
import { DealFormPage } from "./pages/DealFormPage";
import { CustomFieldsPage } from "./pages/CustomFieldsPage";


// ✅ Auth Guard
const RequireAuth: React.FC = () => {
    const { currentUser, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <SimpleLoading message="Checking session..." />;
    }

    if (!currentUser) {
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

const AppRoutes: React.FC = () => {
    return (
        <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="signup" />} />

            {/* Protected */}
            <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />

                    <Route path="/roles-permissions" element={<RolesPermissionsPage />} />
                    <Route path="/users" element={<UserManagementPage />} />
                    <Route path="/departments" element={<DepartmentManagementPage />} />
                    <Route path="/customers" element={<CustomerManagementPage />} />
                    <Route path="/customers/:id" element={<CustomerManagementPage />} />

                    <Route path="/bank-statements" element={<BankStatementsPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />

                    <Route
                        path="/emirates-id"
                        element={
                            <GenericDocumentPage
                                documentType="EmiratesID"
                                title="Emirates ID"
                                UploadComponent={EmiratesIdUpload}
                            />
                        }
                    />
                    <Route
                        path="/passport"
                        element={
                            <GenericDocumentPage
                                documentType="Passport"
                                title="Passport"
                                UploadComponent={PassportUpload}
                            />
                        }
                    />
                    <Route
                        path="/visa"
                        element={
                            <GenericDocumentPage
                                documentType="Visa"
                                title="Visa"
                                UploadComponent={VisaUpload}
                            />
                        }
                    />
                    <Route
                        path="/trade-license"
                        element={
                            <GenericDocumentPage
                                documentType="TradeLicense"
                                title="Trade License"
                                UploadComponent={TradeLicenseUpload}
                            />
                        }
                    />

                    <Route path="/analysis" element={<BankStatementAnalysisPage />} />

                    <Route path="/projects/bookkeeping" element={<BookkeepingPage />} />
                    <Route path="/projects/vat-filing" element={<VatFilingPage />} />

                    <Route path="/projects/ct-filing" element={<CtFilingPage />} />
                    <Route path="/projects/ct-filing/:customerId" element={<CtFilingPage />} />
                    <Route
                        path="/projects/ct-filing/:customerId/:typeName/filing-periods"
                        element={<CtFilingPeriodsList />}
                    />
                    <Route
                        path="/projects/ct-filing/:customerId/:typeName/add-period"
                        element={<CtAddFilingPeriod />}
                    />
                    <Route
                        path="/projects/ct-filing/:customerId/:typeName/:periodId/upload"
                        element={<CtFilingPage />}
                    />
                    <Route
                        path="/projects/ct-filing/:customerId/:typeName/:periodId/results"
                        element={<CtFilingPage />}
                    >
                        <Route index element={<Navigate to="step-1" replace />} />
                        <Route path="step-1" element={<StepDispatcher step={1} />} />
                        <Route path="step-2" element={<StepDispatcher step={2} />} />
                        <Route path="step-3" element={<StepDispatcher step={3} />} />
                        <Route path="step-4" element={<StepDispatcher step={4} />} />
                        <Route path="step-5" element={<StepDispatcher step={5} />} />
                        <Route path="step-6" element={<StepDispatcher step={6} />} />
                        <Route path="step-7" element={<StepDispatcher step={7} />} />
                        <Route path="step-8" element={<StepDispatcher step={8} />} />
                        <Route path="step-9" element={<StepDispatcher step={9} />} />
                        <Route path="step-10" element={<StepDispatcher step={10} />} />
                        <Route path="step-11" element={<StepDispatcher step={11} />} />
                        <Route path="step-12" element={<StepDispatcher step={12} />} />
                        <Route path="step-13" element={<StepDispatcher step={13} />} />
                        <Route path="step-14" element={<StepDispatcher step={14} />} />
                    </Route>
                    <Route
                        path="/projects/ct-filing/:customerId/:typeName/:periodId/edit"
                        element={<CtEditFilingPeriod />}
                    />

                    <Route path="/projects/registration" element={<RegistrationPage />} />
                    <Route path="/projects/audit-report" element={<AuditReportPage />} />

                    <Route path="/sales/leads" element={<LeadsPage />} />
                    <Route path="/sales/leads/:id" element={<LeadsPage />} />
                    <Route path="/sales/leads/create" element={<LeadFormPage />} />
                    <Route path="/sales/leads/edit/:id" element={<LeadFormPage />} />
                    <Route path="/sales/deals" element={<DealsPage />} />
                    <Route path="/sales/deals/create" element={<DealFormPage />} />
                    <Route path="/sales/deals/edit/:id" element={<DealFormPage />} />
                    <Route path="/sales/deals/:id" element={<DealsPage />} />
                    <Route path="/sales/custom-fields" element={<CustomFieldsPage />} />
                    <Route path="/sales/settings" element={<SalesSettingsPage />} />

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
