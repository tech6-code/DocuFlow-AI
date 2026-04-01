import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/ct-workflow/conversions/:conversionId
 * Fetches the specific conversion and all its associated steps.
 */
router.get("/conversions/:conversionId", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Fetch the conversion first to check ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Workflow attempt not found" });

    // Authorization: Normal users only see their own conversions
    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "You do not have permission to view this workflow" });
    }

    // Fetch all steps for this specific conversion
    const { data: steps, error: stepsError } = await supabaseAdmin
        .from("ct_workflow_data")
        .select("*")
        .eq("conversion_id", conversionId)
        .order("step_number", { ascending: true });

    if (stepsError) return res.status(500).json({ message: stepsError.message });

    return res.json({
        ...conversion,
        steps: steps || []
    });
});

/**
 * GET /api/ct-workflow/list
 * Lists all conversions for a specific period and CT type.
 */
router.get("/list", requireAuth, async (req: AuthedRequest, res) => {
    const { periodId, ctTypeId: rawCtTypeId } = req.query as { periodId?: string; ctTypeId?: string };

    if (!periodId || !rawCtTypeId) {
        return res.status(400).json({ message: "periodId and ctTypeId are required" });
    }

    const ctTypeId = await resolveCtTypeId(rawCtTypeId);
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    let query = supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("period_id", periodId)
        .eq("ct_type_id", ctTypeId);

    if (!isSuperAdmin) {
        query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    return res.json(data || []);
});

/**
 * POST /api/ct-workflow/conversions
 * Creates a new workflow attempt (conversion).
 */
router.post("/conversions", requireAuth, async (req: AuthedRequest, res) => {
    const { customerId, ctTypeId: rawCtTypeId, periodId } = req.body;

    if (!customerId || !rawCtTypeId || !periodId) {
        return res.status(400).json({ message: "customerId, ctTypeId, and periodId are required" });
    }

    const ctTypeId = await resolveCtTypeId(rawCtTypeId);
    const user = req.auth?.user;

    const payload = {
        user_id: user.id,
        customer_id: customerId,
        ct_type_id: ctTypeId,
        period_id: periodId,
        status: "draft"
    };

    const { data, error } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .insert(payload)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(data);
});

/**
 * POST /api/ct-workflow/upsert
 * Saves or updates a single step's data for a specific conversion.
 * Unique on (conversion_id, step_key).
 */
router.post("/upsert", requireAuth, async (req: AuthedRequest, res) => {
    const {
        conversionId,
        stepNumber,
        stepKey,
        data,
        status,
        // Optional extras for legacy compatibility or direct creation
        customerId,
        ctTypeId: rawCtTypeId,
        periodId
    } = req.body;

    if (!conversionId || !stepKey) {
        return res.status(400).json({ message: "conversionId and stepKey are required" });
    }

    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Verify conversion ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Workflow attempt not found" });

    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "You do not have permission to update this workflow" });
    }

    const payload = {
        user_id: conversion.user_id,
        customer_id: conversion.customer_id,
        ct_type_id: conversion.ct_type_id,
        period_id: conversion.period_id,
        conversion_id: conversionId,
        step_number: stepNumber,
        step_key: stepKey,
        data: data || {},
        status: status || "draft",
        updated_at: new Date().toISOString()
    };

    // Server-side recalculation for Profit & Loss (Step 5)
    // Skip recalculation for Type 4 (audit report) — extracted values are already verified
    const isType4 = typeof stepKey === 'string' && stepKey.startsWith('type-4_');
    if (stepNumber === 5 && payload.data.pnlValues && !isType4) {
        payload.data.pnlValues = recalculatePnlStepData(payload.data.pnlValues);
    }

    // Server-side recalculation for Balance Sheet (Step 6)
    // Skip recalculation for Type 4 (audit report) — extracted values are already verified
    if (stepNumber === 6 && payload.data.balanceSheetValues && !isType4) {
        payload.data.balanceSheetValues = recalculateBsStepData(
            payload.data.balanceSheetValues,
            payload.data.tbCoaCustomTargets || []
        );
    }

    const { data: upserted, error } = await supabaseAdmin
        .from("ct_workflow_data")
        .upsert(payload, { onConflict: "conversion_id,step_key" })
        .select()
        .single();

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    // Update parent filing period status to "In Progress" if it's currently "Not Started"
    const { data: period } = await supabaseAdmin
        .from("ct_filing_period")
        .select("status")
        .eq("id", conversion.period_id)
        .maybeSingle();

    if (period && period.status !== "In Progress" && period.status !== "Submitted") {
        await supabaseAdmin
            .from("ct_filing_period")
            .update({ status: "In Progress" })
            .eq("id", conversion.period_id);
    }

    return res.json(upserted);
});

/**
 * PATCH /api/ct-workflow/conversions/:conversionId/status
 * Updates the status of a full conversion attempt.
 */
router.patch("/conversions/:conversionId/status", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const { status } = req.body;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    const { data: existing } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("user_id")
        .eq("id", conversionId)
        .maybeSingle();

    if (!existing) return res.status(404).json({ message: "Conversion not found" });
    if (!isSuperAdmin && existing.user_id !== user.id) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const { data, error } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", conversionId)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });

    // Sync status with parent filing period
    if (status === "submitted" || status === "completed") {
        await supabaseAdmin
            .from("ct_filing_period")
            .update({ status: "Submitted" })
            .eq("id", data.period_id);
    } else if (status === "draft") {
        await supabaseAdmin
            .from("ct_filing_period")
            .update({ status: "In Progress" })
            .eq("id", data.period_id);
    }

    return res.json(data);
});

/**
 * Helper to resolve ctTypeId from name if it is a number string.
 */
async function resolveCtTypeId(ctTypeId: string): Promise<string> {
    // If it's already a UUID, return it
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(ctTypeId)) {
        return ctTypeId;
    }

    // Otherwise, try to map from "1", "2", etc. to "CT Type 1", etc.
    const typeNum = ctTypeId.replace(/\D/g, "");
    if (!typeNum) return ctTypeId; // Fallback to original

    const targetName = `CT Type ${typeNum}`;
    const { data: ctType } = await supabaseAdmin
        .from("ct_types")
        .select("id")
        .ilike("name", targetName)
        .maybeSingle();

    return ctType?.id || ctTypeId;
}

/**
 * Helper to check if a user is a Super Admin.
 */
async function checkIsSuperAdmin(roleId: string): Promise<boolean> {
    const { data: role } = await supabaseAdmin
        .from("roles")
        .select("name")
        .eq("id", roleId)
        .single();

    return role?.name?.toUpperCase() === "SUPER ADMIN";
}

/**
 * DELETE /api/ct-workflow/conversions/:conversionId
 * Deletes a conversion and all its associated steps.
 */
router.delete("/conversions/:conversionId", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Verify ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Conversion not found" });

    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    // Capture period_id before deletion
    const periodId = conversion.period_id;

    // Delete steps first (optional if cascade is on, but safer)
    await supabaseAdmin
        .from("ct_workflow_data")
        .delete()
        .eq("conversion_id", conversionId);

    // Delete conversion
    const { error: deleteError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .delete()
        .eq("id", conversionId);

    if (deleteError) return res.status(500).json({ message: deleteError.message });

    // 🚨 Logic to reset parent filing period status if no conversions remain
    if (periodId) {
        const { count, error: countError } = await supabaseAdmin
            .from("ct_workflow_data_conversions")
            .select("*", { count: 'exact', head: true })
            .eq("period_id", periodId);

        if (!countError && count === 0) {
            console.log(`[ctWorkflow] No conversions left for period ${periodId}, resetting status to 'Not Started'`);
            await supabaseAdmin
                .from("ct_filing_period")
                .update({ status: 'Not Started' })
                .eq("id", periodId);
        }
    }

    return res.status(204).send();
});

const recalculatePnlStepData = (pnlValues: any) => {
    if (!pnlValues || typeof pnlValues !== "object") return pnlValues;

    const getV = (id: string, year: 'currentYear' | 'previousYear') => pnlValues[id]?.[year] || 0;
    const years: ('currentYear' | 'previousYear')[] = ['currentYear', 'previousYear'];
    const updatedValues = { ...pnlValues };

    years.forEach(year => {
        const revenue = getV('revenue', year);
        const costOfRevenue = getV('cost_of_revenue', year);
        const grossProfit = revenue - costOfRevenue;
        updatedValues['gross_profit'] = {
            ...updatedValues['gross_profit'],
            [year]: grossProfit
        };

        const otherIncome = getV('other_income', year);
        const unrealisedGainLoss = getV('unrealised_gain_loss_fvtpl', year);
        const shareProfits = getV('share_profits_associates', year);
        const gainLossProperty = getV('gain_loss_revaluation_property', year);
        const impairmentPpe = getV('impairment_losses_ppe', year);
        const impairmentIntangible = getV('impairment_losses_intangible', year);
        const businessPromotion = getV('business_promotion_selling', year);
        const foreignExchangeLoss = getV('foreign_exchange_loss', year);
        const sellingDist = getV('selling_distribution_expenses', year);
        const adminExp = getV('administrative_expenses', year);
        const financeCosts = getV('finance_costs', year);
        const depreciationPpe = getV('depreciation_ppe', year);

        const operatingProfit = grossProfit + otherIncome + unrealisedGainLoss + shareProfits + gainLossProperty
            - impairmentPpe - impairmentIntangible - businessPromotion - foreignExchangeLoss
            - sellingDist - adminExp - financeCosts - depreciationPpe;

        updatedValues['operating_profit'] = {
            ...updatedValues['operating_profit'],
            [year]: operatingProfit
        };

        const profitLossYear = operatingProfit;
        updatedValues['profit_loss_year'] = {
            ...updatedValues['profit_loss_year'],
            [year]: profitLossYear
        };

        const gainRevalProperty = getV('gain_revaluation_property', year);
        const shareGainLossAssociates = getV('share_gain_loss_revaluation_associates', year);
        const fairValueSale = getV('changes_fair_value_available_sale', year);
        const fairValueSaleReclass = getV('changes_fair_value_available_sale_reclassified', year);
        const exchangeDiff = getV('exchange_difference_translating', year);

        const totalComprehensiveIncome = profitLossYear + gainRevalProperty + shareGainLossAssociates
            + fairValueSale + fairValueSaleReclass + exchangeDiff;

        updatedValues['total_comprehensive_income'] = {
            ...updatedValues['total_comprehensive_income'],
            [year]: totalComprehensiveIncome
        };
    });

    return updatedValues;
};

type TbCoaCustomTarget = { name: string; category: string; subCategory?: string };

const customBsId = (name: string) =>
    `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

const recalculateBsStepData = (
    values: Record<string, { currentYear: number; previousYear: number }>,
    customTargets: TbCoaCustomTarget[] = []
) => {
    const getV = (id: string, year: 'currentYear' | 'previousYear') => values[id]?.[year] || 0;
    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;
    const years: ('currentYear' | 'previousYear')[] = ['currentYear', 'previousYear'];
    const updatedValues = { ...values };

    // Helper: sum custom target values for a given section
    const customSum = (cat: string, sub: string | undefined, year: 'currentYear' | 'previousYear') =>
        customTargets
            .filter(t => t.category === cat && (t.subCategory || '') === (sub || ''))
            .reduce((s, t) => s + getV(customBsId(t.name), year), 0);

    years.forEach(year => {
        const totalNonCurrentAssets = round2(
            getV('property_plant_equipment', year) +
            getV('intangible_assets', year) +
            getV('long_term_investments', year) +
            getV('other_non_current_assets', year) +
            customSum('Assets', 'NonCurrentAssets', year)
        );
        updatedValues['total_non_current_assets'] = { ...updatedValues['total_non_current_assets'], [year]: totalNonCurrentAssets };

        const totalCurrentAssets = round2(
            getV('cash_bank_balances', year) +
            getV('inventories', year) +
            getV('trade_receivables', year) +
            getV('advances_deposits_receivables', year) +
            getV('related_party_transactions_assets', year) +
            customSum('Assets', 'CurrentAssets', year) +
            customSum('Assets', undefined, year)
        );
        updatedValues['total_current_assets'] = { ...updatedValues['total_current_assets'], [year]: totalCurrentAssets };

        const totalAssets = round2(totalNonCurrentAssets + totalCurrentAssets);
        updatedValues['total_assets'] = { ...updatedValues['total_assets'], [year]: totalAssets };

        const totalEquity = round2(
            getV('share_capital', year) +
            getV('retained_earnings', year) +
            getV('shareholders_current_accounts', year) +
            customSum('Equity', undefined, year)
        );
        updatedValues['total_equity'] = { ...updatedValues['total_equity'], [year]: totalEquity };

        const totalNonCurrentLiabilities = round2(
            getV('employees_end_service_benefits', year) +
            getV('bank_borrowings_non_current', year) +
            customSum('Liabilities', 'NonCurrentLiabilities', year)
        );
        updatedValues['total_non_current_liabilities'] = { ...updatedValues['total_non_current_liabilities'], [year]: totalNonCurrentLiabilities };

        const totalCurrentLiabilities = round2(
            getV('short_term_borrowings', year) +
            getV('trade_other_payables', year) +
            getV('related_party_transactions_liabilities', year) +
            customSum('Liabilities', 'CurrentLiabilities', year) +
            customSum('Liabilities', undefined, year)
        );
        updatedValues['total_current_liabilities'] = { ...updatedValues['total_current_liabilities'], [year]: totalCurrentLiabilities };

        const totalLiabilities = round2(totalNonCurrentLiabilities + totalCurrentLiabilities);
        updatedValues['total_liabilities'] = { ...updatedValues['total_liabilities'], [year]: totalLiabilities };

        const totalEquityLiabilities = round2(totalEquity + totalLiabilities);
        updatedValues['total_equity_liabilities'] = { ...updatedValues['total_equity_liabilities'], [year]: totalEquityLiabilities };
    });

    return updatedValues;
};

export default router;
