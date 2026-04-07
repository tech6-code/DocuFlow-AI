import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";

const router = Router();

type ScopeType = "super_admin" | "department_admin" | "user";

type DbUser = {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
};

type DbDepartment = {
  id: string;
  name: string;
};

type DbCustomer = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  type: string | null;
  owner_id: string | null;
  created_at: string | null;
};

type DbVatPeriod = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  status: string | null;
  created_at: string | null;
};

type DbCtPeriod = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  ct_type_id: string | null;
  period_from: string | null;
  period_to: string | null;
  due_date: string | null;
  status: string | null;
  created_at: string | null;
};

type DbConversion = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  status: string | null;
  created_at: string | null;
};

interface DashboardFilters {
  month: number | null;       // 1-12
  year: number | null;        // e.g. 2026
  filingType: "all" | "vat" | "ct";
  departmentId: string | null;
  userId: string | null;
}

function parseDashboardFilters(query: Record<string, any>): DashboardFilters {
  const month = query.month ? parseInt(query.month, 10) : null;
  const year = query.year ? parseInt(query.year, 10) : null;
  return {
    month: month && month >= 1 && month <= 12 ? month : null,
    year: year && year >= 2000 && year <= 2100 ? year : null,
    filingType: ["vat", "ct"].includes(query.filingType) ? query.filingType : "all",
    departmentId: query.departmentId || null,
    userId: query.userId || null,
  };
}

function getFilterDateRange(filters: DashboardFilters): { from: Date | null; to: Date | null } {
  if (filters.month && filters.year) {
    const from = new Date(Date.UTC(filters.year, filters.month - 1, 1));
    const to = new Date(Date.UTC(filters.year, filters.month, 0, 23, 59, 59, 999));
    return { from, to };
  }
  if (filters.year) {
    const from = new Date(Date.UTC(filters.year, 0, 1));
    const to = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
    return { from, to };
  }
  return { from: null, to: null };
}

function isDepartmentAdmin(roleName: string) {
  const normalized = String(roleName || "").trim().toUpperCase();
  return normalized.includes("DEPARTMENT") && normalized.includes("ADMIN");
}

function normalizeStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();

  if (!normalized) return "Unknown";
  if (["submitted", "completed", "complete"].includes(normalized)) return "Submitted";
  if (["in progress", "in_progress", "progress", "processing"].includes(normalized)) return "In Progress";
  if (["not started", "not_started"].includes(normalized)) return "Not Started";
  if (["draft"].includes(normalized)) return "Draft";
  if (["completed & filed", "completed_and_filed", "filed"].includes(normalized)) return "Completed & Filed";

  return status || "Unknown";
}

function isSubmittedStatus(status: string | null | undefined) {
  const ns = normalizeStatus(status);
  return ns === "Submitted" || ns === "Completed & Filed";
}

function isPendingStatus(status: string | null | undefined) {
  return !isSubmittedStatus(status);
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDate(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function makePeriodLabel(periodFrom: string | null, periodTo: string | null) {
  if (periodFrom && periodTo) return `${periodFrom} to ${periodTo}`;
  return periodFrom || periodTo || "-";
}

function customerDisplayName(customer: DbCustomer | undefined) {
  if (!customer) return "Unknown Customer";
  if (customer.type === "business" && customer.company_name) return customer.company_name;
  const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  return fullName || customer.company_name || "Unknown Customer";
}

async function resolveScope(req: AuthedRequest) {
  const currentUserId = req.auth?.user?.id || "";
  const profile = req.profile;
  const roleId = profile?.role_id;

  const { data: role, error: roleError } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .single();

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roleName = String(role?.name || "");
  const scope: ScopeType =
    roleName.toUpperCase() === "SUPER ADMIN"
      ? "super_admin"
      : isDepartmentAdmin(roleName)
        ? "department_admin"
        : "user";

  let usersQuery = supabaseAdmin.from("users").select("id,name,email,department_id");
  if (scope === "department_admin") {
    usersQuery = usersQuery.eq("department_id", profile?.department_id || "");
  } else if (scope === "user") {
    usersQuery = usersQuery.eq("id", currentUserId);
  }

  const { data: users, error: usersError } = await usersQuery;
  if (usersError) {
    throw new Error(usersError.message);
  }

  const scopedUsers = (users || []) as DbUser[];
  const allowedUserIds = scopedUsers.map((user) => user.id);

  return {
    scope,
    roleName,
    currentUserId,
    departmentId: profile?.department_id || null,
    allowedUserIds,
    scopedUsers,
  };
}

function applyUserScope<T extends { user_id: string | null }>(rows: T[], allowedUserIds: string[]) {
  if (!allowedUserIds.length) return [];
  const allowed = new Set(allowedUserIds);
  return rows.filter((row) => row.user_id && allowed.has(row.user_id));
}

function applyCustomerScope(rows: DbCustomer[], allowedUserIds: string[], scope: ScopeType, currentUserId: string) {
  if (scope === "super_admin") return rows;
  if (scope === "user") {
    return rows.filter((row) => row.owner_id === currentUserId);
  }

  if (!allowedUserIds.length) return [];
  const allowed = new Set(allowedUserIds);
  return rows.filter((row) => row.owner_id && allowed.has(row.owner_id));
}

function filterByDateRange<T extends { due_date?: string | null; created_at?: string | null }>(
  rows: T[],
  from: Date | null,
  to: Date | null
): T[] {
  if (!from || !to) return rows;
  return rows.filter((row) => {
    const d = parseDate(row.due_date) || parseDate(row.created_at);
    if (!d) return true;
    return d >= from && d <= to;
  });
}

function filterByFilingType(
  vatPeriods: DbVatPeriod[],
  ctPeriods: DbCtPeriod[],
  filingType: "all" | "vat" | "ct"
): { vat: DbVatPeriod[]; ct: DbCtPeriod[] } {
  return {
    vat: filingType === "ct" ? [] : vatPeriods,
    ct: filingType === "vat" ? [] : ctPeriods,
  };
}

function filterByDepartment<T extends { user_id: string | null }>(
  rows: T[],
  departmentId: string | null,
  userMap: Map<string, DbUser>
): T[] {
  if (!departmentId) return rows;
  return rows.filter((row) => {
    if (!row.user_id) return false;
    const user = userMap.get(row.user_id);
    return user?.department_id === departmentId;
  });
}

function filterByUser<T extends { user_id: string | null }>(rows: T[], userId: string | null): T[] {
  if (!userId) return rows;
  return rows.filter((row) => row.user_id === userId);
}

function computePercentageChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

router.get("/summary", requireAuth, requirePermission("dashboard:view"), async (req: AuthedRequest, res) => {
  try {
    const filters = parseDashboardFilters(req.query as Record<string, any>);
    const dateRange = getFilterDateRange(filters);
    const scopeInfo = await resolveScope(req);
    const {
      scope,
      roleName,
      currentUserId,
      departmentId,
      allowedUserIds,
      scopedUsers,
    } = scopeInfo;

    const [
      departmentsResult,
      customersResult,
      vatPeriodsResult,
      ctPeriodsResult,
      vatConversionsResult,
      ctConversionsResult,
    ] = await Promise.all([
      supabaseAdmin.from("departments").select("id,name").order("name"),
      supabaseAdmin.from("customers").select("id,company_name,first_name,last_name,type,owner_id,created_at"),
      supabaseAdmin.from("vat_filing_period").select("id,user_id,customer_id,period_from,period_to,due_date,status,created_at"),
      supabaseAdmin.from("ct_filing_period").select("id,user_id,customer_id,ct_type_id,period_from,period_to,due_date,status,created_at"),
      supabaseAdmin.from("vat_filing_conversions").select("id,user_id,customer_id,status,created_at").order("created_at", { ascending: false }).limit(25),
      supabaseAdmin.from("ct_workflow_data_conversions").select("id,user_id,customer_id,status,created_at").order("created_at", { ascending: false }).limit(25),
    ]);

    if (departmentsResult.error) throw new Error(departmentsResult.error.message);
    if (customersResult.error) throw new Error(customersResult.error.message);
    if (vatPeriodsResult.error) throw new Error(vatPeriodsResult.error.message);
    if (ctPeriodsResult.error) throw new Error(ctPeriodsResult.error.message);
    if (vatConversionsResult.error) throw new Error(vatConversionsResult.error.message);
    if (ctConversionsResult.error) throw new Error(ctConversionsResult.error.message);

    const departments = (departmentsResult.data || []) as DbDepartment[];
    const allCustomers = (customersResult.data || []) as DbCustomer[];
    const allVatPeriodsRaw = (vatPeriodsResult.data || []) as DbVatPeriod[];
    const allCtPeriodsRaw = (ctPeriodsResult.data || []) as DbCtPeriod[];
    const allVatConversions = (vatConversionsResult.data || []) as DbConversion[];
    const allCtConversions = (ctConversionsResult.data || []) as DbConversion[];

    const customers = applyCustomerScope(allCustomers, allowedUserIds, scope, currentUserId);
    const customerIdSet = new Set(customers.map((customer) => customer.id));

    // Apply scope filtering
    let vatPeriodsScoped = applyUserScope(allVatPeriodsRaw, allowedUserIds).filter((row) => row.customer_id && customerIdSet.has(row.customer_id));
    let ctPeriodsScoped = applyUserScope(allCtPeriodsRaw, allowedUserIds).filter((row) => row.customer_id && customerIdSet.has(row.customer_id));

    // Keep unfiltered copies for "all time" counts before date/type filtering
    const vatPeriodsAll = vatPeriodsScoped;
    const ctPeriodsAll = ctPeriodsScoped;

    // Apply date range filter
    vatPeriodsScoped = filterByDateRange(vatPeriodsScoped, dateRange.from, dateRange.to);
    ctPeriodsScoped = filterByDateRange(ctPeriodsScoped, dateRange.from, dateRange.to);

    // Apply filing type filter
    const { vat: vatPeriods, ct: ctPeriods } = filterByFilingType(vatPeriodsScoped, ctPeriodsScoped, filters.filingType);

    // Apply department filter (for super_admin drilling into a dept)
    const userMap = new Map(scopedUsers.map((user) => [user.id, user]));
    const allUsersForLookup = new Map(scopedUsers.map((user) => [user.id, user]));

    const vatPeriodsFiltered = filterByUser(filterByDepartment(vatPeriods, filters.departmentId, allUsersForLookup), filters.userId);
    const ctPeriodsFiltered = filterByUser(filterByDepartment(ctPeriods, filters.departmentId, allUsersForLookup), filters.userId);

    const vatConversions = applyUserScope(allVatConversions, allowedUserIds).filter((row) => row.customer_id && customerIdSet.has(row.customer_id));
    const ctConversions = applyUserScope(allCtConversions, allowedUserIds).filter((row) => row.customer_id && customerIdSet.has(row.customer_id));

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const departmentMap = new Map(departments.map((department) => [department.id, department.name]));
    const today = startOfTodayUtc();
    const weekEnd = addDays(today, 7);
    const monthEnd = addDays(today, 30);

    const allFilings = [
      ...vatPeriodsFiltered.map((row) => ({ ...row, filingType: "VAT" as const })),
      ...ctPeriodsFiltered.map((row) => ({ ...row, filingType: "CT" as const })),
    ];

    // Previous period calculation for comparison
    let prevPeriodFilings: typeof allFilings = [];
    if (dateRange.from && dateRange.to) {
      const duration = dateRange.to.getTime() - dateRange.from.getTime();
      const prevFrom = new Date(dateRange.from.getTime() - duration - 1);
      const prevTo = new Date(dateRange.from.getTime() - 1);
      const prevVat = filterByDateRange(vatPeriodsAll, prevFrom, prevTo);
      const prevCt = filterByDateRange(ctPeriodsAll, prevFrom, prevTo);
      const { vat: prevVatTyped, ct: prevCtTyped } = filterByFilingType(prevVat, prevCt, filters.filingType);
      prevPeriodFilings = [
        ...filterByUser(filterByDepartment(prevVatTyped, filters.departmentId, allUsersForLookup), filters.userId).map((row) => ({ ...row, filingType: "VAT" as const })),
        ...filterByUser(filterByDepartment(prevCtTyped, filters.departmentId, allUsersForLookup), filters.userId).map((row) => ({ ...row, filingType: "CT" as const })),
      ];
    }

    // Trend: always show last 6 months regardless of filter
    const trendStart = startOfMonthUtc(addMonths(today, -5));
    const trendBuckets = Array.from({ length: 6 }, (_, index) => {
      const bucketDate = addMonths(trendStart, index);
      return {
        key: `${bucketDate.getUTCFullYear()}-${bucketDate.getUTCMonth()}`,
        label: formatMonthLabel(bucketDate),
        vat: 0,
        ct: 0,
        submitted: 0,
      };
    });
    const trendIndex = new Map(trendBuckets.map((bucket) => [bucket.key, bucket]));

    // Use all-scoped (unfiltered by date) for trend
    const allFilingsForTrend = [
      ...vatPeriodsAll.map((row) => ({ ...row, filingType: "VAT" as const })),
      ...ctPeriodsAll.map((row) => ({ ...row, filingType: "CT" as const })),
    ];

    allFilingsForTrend.forEach((row) => {
      const sourceDate = parseDate(row.created_at) || parseDate(row.due_date);
      if (!sourceDate) return;
      const key = `${sourceDate.getUTCFullYear()}-${sourceDate.getUTCMonth()}`;
      const bucket = trendIndex.get(key);
      if (!bucket) return;
      if (filters.filingType === "all" || filters.filingType === "vat") {
        if (row.filingType === "VAT") bucket.vat += 1;
      }
      if (filters.filingType === "all" || filters.filingType === "ct") {
        if (row.filingType === "CT") bucket.ct += 1;
      }
      if (isSubmittedStatus(row.status)) bucket.submitted += 1;
    });

    const pendingCount = allFilings.filter((row) => isPendingStatus(row.status)).length;
    const submittedCount = allFilings.filter((row) => isSubmittedStatus(row.status)).length;
    const overdueCount = allFilings.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return !!dueDate && dueDate < today && isPendingStatus(row.status);
    }).length;
    const dueThisWeekCount = allFilings.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return !!dueDate && dueDate >= today && dueDate < weekEnd && isPendingStatus(row.status);
    }).length;
    const dueThisMonthCount = allFilings.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return !!dueDate && dueDate >= today && dueDate < monthEnd && isPendingStatus(row.status);
    }).length;

    // Previous period counts for comparison
    const prevPending = prevPeriodFilings.filter((row) => isPendingStatus(row.status)).length;
    const prevSubmitted = prevPeriodFilings.filter((row) => isSubmittedStatus(row.status)).length;
    const prevOverdue = prevPeriodFilings.filter((row) => {
      const dueDate = parseDate(row.due_date);
      return !!dueDate && dueDate < today && isPendingStatus(row.status);
    }).length;
    const prevVatCount = prevPeriodFilings.filter((r) => r.filingType === "VAT").length;
    const prevCtCount = prevPeriodFilings.filter((r) => r.filingType === "CT").length;

    const cards = {
      customers: customers.length,
      users: scopedUsers.length,
      departments:
        scope === "super_admin"
          ? departments.length
          : departmentId
            ? 1
            : 0,
      vatFilings: vatPeriodsFiltered.length,
      ctFilings: ctPeriodsFiltered.length,
      pending: pendingCount,
      submitted: submittedCount,
      overdue: overdueCount,
      dueThisWeek: dueThisWeekCount,
      dueThisMonth: dueThisMonthCount,
      activeFilingCustomers: new Set(allFilings.map((row) => row.customer_id).filter(Boolean)).size,
    };

    const comparison = {
      vatFilings: computePercentageChange(cards.vatFilings, prevVatCount),
      ctFilings: computePercentageChange(cards.ctFilings, prevCtCount),
      pending: computePercentageChange(cards.pending, prevPending),
      submitted: computePercentageChange(cards.submitted, prevSubmitted),
      overdue: computePercentageChange(cards.overdue, prevOverdue),
    };

    const buildStatusCounts = (rows: Array<{ status: string | null }>) => {
      const labels = ["Not Started", "In Progress", "Draft", "Submitted", "Completed & Filed"];
      const counts = new Map(labels.map((label) => [label, 0]));

      rows.forEach((row) => {
        const label = normalizeStatus(row.status);
        counts.set(label, (counts.get(label) || 0) + 1);
      });

      return Array.from(counts.entries())
        .filter(([, count]) => count > 0)
        .map(([label, count]) => ({ label, count }));
    };

    const overallStatusMap = new Map<string, number>();
    allFilings.forEach((row) => {
      const label = normalizeStatus(row.status);
      overallStatusMap.set(label, (overallStatusMap.get(label) || 0) + 1);
      const dueDate = parseDate(row.due_date);
      if (dueDate && dueDate < today && isPendingStatus(row.status)) {
        overallStatusMap.set("Overdue", (overallStatusMap.get("Overdue") || 0) + 1);
      }
    });
    const overallStatus = Array.from(overallStatusMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const workloadByUser = scopedUsers
      .map((user) => {
        const userFilings = allFilings.filter((row) => row.user_id === user.id);
        return {
          id: user.id,
          name: user.name,
          total: userFilings.length,
          pending: userFilings.filter((row) => isPendingStatus(row.status)).length,
          submitted: userFilings.filter((row) => isSubmittedStatus(row.status)).length,
          overdue: userFilings.filter((row) => {
            const dueDate = parseDate(row.due_date);
            return !!dueDate && dueDate < today && isPendingStatus(row.status);
          }).length,
        };
      })
      .filter((item) => item.total > 0 || scope !== "super_admin")
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const workloadByDepartmentMap = new Map<string, { id: string; name: string; total: number; pending: number; submitted: number; overdue: number }>();
    allFilings.forEach((row) => {
      const user = row.user_id ? userMap.get(row.user_id) : null;
      const deptId = user?.department_id || departmentId || "unassigned";
      const deptName =
        (deptId && departmentMap.get(deptId)) ||
        (scope === "department_admin" && departmentId ? departmentMap.get(departmentId) : null) ||
        "Unassigned";
      const dueDate = parseDate(row.due_date);
      const entry = workloadByDepartmentMap.get(deptId) || {
        id: deptId,
        name: deptName || "Unassigned",
        total: 0,
        pending: 0,
        submitted: 0,
        overdue: 0,
      };

      entry.total += 1;
      if (isSubmittedStatus(row.status)) {
        entry.submitted += 1;
      } else {
        entry.pending += 1;
      }
      if (dueDate && dueDate < today && isPendingStatus(row.status)) {
        entry.overdue += 1;
      }
      workloadByDepartmentMap.set(deptId, entry);
    });

    const workloadByDepartment = Array.from(workloadByDepartmentMap.values()).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name),
    );

    const dueDates = allFilings
      .filter((row) => row.customer_id)
      .map((row) => {
        const customer = row.customer_id ? customerMap.get(row.customer_id) : undefined;
        const assignedUser = row.user_id ? userMap.get(row.user_id) : undefined;
        const deptId = assignedUser?.department_id || departmentId || "";
        return {
          customerId: row.customer_id || "",
          customerName: customerDisplayName(customer),
          filingType: row.filingType,
          periodLabel: makePeriodLabel(row.period_from, row.period_to),
          dueDate: row.due_date || "",
          status: normalizeStatus(row.status),
          assignedUserId: assignedUser?.id,
          assignedUserName: assignedUser?.name || "Unassigned",
          departmentId: deptId || undefined,
          departmentName: (deptId && departmentMap.get(deptId)) || "Unassigned",
        };
      })
      .sort((a, b) => {
        const aDate = parseDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bDate = parseDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .slice(0, 12);

    const recentActivity = [
      ...vatConversions.map((row) => ({ ...row, filingType: "VAT" as const, title: "VAT conversion updated" })),
      ...ctConversions.map((row) => ({ ...row, filingType: "CT" as const, title: "CT workflow updated" })),
      ...vatPeriodsFiltered.map((row) => ({ id: `vat-period-${row.id}`, user_id: row.user_id, customer_id: row.customer_id, status: row.status, created_at: row.created_at, filingType: "VAT" as const, title: "VAT filing period created" })),
      ...ctPeriodsFiltered.map((row) => ({ id: `ct-period-${row.id}`, user_id: row.user_id, customer_id: row.customer_id, status: row.status, created_at: row.created_at, filingType: "CT" as const, title: "CT filing period created" })),
    ]
      .filter((row) => row.customer_id)
      .sort((a, b) => {
        const aDate = parseDate(a.created_at)?.getTime() || 0;
        const bDate = parseDate(b.created_at)?.getTime() || 0;
        return bDate - aDate;
      })
      .slice(0, 12)
      .map((row) => {
        const customer = row.customer_id ? customerMap.get(row.customer_id) : undefined;
        const user = row.user_id ? userMap.get(row.user_id) : undefined;
        return {
          id: row.id,
          title: row.title,
          filingType: row.filingType,
          status: normalizeStatus(row.status),
          customerName: customerDisplayName(customer),
          userName: user?.name || "Unknown User",
          createdAt: row.created_at || "",
        };
      });

    const customerAttention = customers
      .map((customer) => {
        const customerVat = vatPeriodsFiltered.filter((row) => row.customer_id === customer.id);
        const customerCt = ctPeriodsFiltered.filter((row) => row.customer_id === customer.id);
        const combined = [...customerVat, ...customerCt];
        const openFilings = combined.filter((row) => isPendingStatus(row.status));
        const dueDatesForCustomer = openFilings
          .map((row) => parseDate(row.due_date))
          .filter(Boolean) as Date[];
        const nextDueDate = dueDatesForCustomer.length
          ? new Date(Math.min(...dueDatesForCustomer.map((date) => date.getTime()))).toISOString()
          : null;

        return {
          customerId: customer.id,
          customerName: customerDisplayName(customer),
          openVatFilings: customerVat.filter((row) => isPendingStatus(row.status)).length,
          openCtFilings: customerCt.filter((row) => isPendingStatus(row.status)).length,
          overdueFilings: combined.filter((row) => {
            const dueDate = parseDate(row.due_date);
            return !!dueDate && dueDate < today && isPendingStatus(row.status);
          }).length,
          nextDueDate,
        };
      })
      .filter((item) => item.openVatFilings > 0 || item.openCtFilings > 0 || item.overdueFilings > 0)
      .sort((a, b) => {
        if (b.overdueFilings !== a.overdueFilings) return b.overdueFilings - a.overdueFilings;
        const aDate = parseDate(a.nextDueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bDate = parseDate(b.nextDueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .slice(0, 10);

    // Customer growth: last 12 months, new customers + cumulative total
    const growthStart = startOfMonthUtc(addMonths(today, -11));
    const customerGrowth: Array<{ label: string; newCustomers: number; totalCustomers: number }> = [];
    {
      const allScopedCustomers = customers;
      const sortedByCreated = allScopedCustomers
        .map((c) => ({ ...c, _created: parseDate(c.created_at) }))
        .filter((c) => c._created !== null)
        .sort((a, b) => a._created!.getTime() - b._created!.getTime());

      // Count customers created before the growth window (baseline)
      let cumulative = sortedByCreated.filter((c) => c._created! < growthStart).length;

      for (let i = 0; i < 12; i++) {
        const bucketStart = addMonths(growthStart, i);
        const bucketEnd = addMonths(growthStart, i + 1);
        const newInMonth = sortedByCreated.filter(
          (c) => c._created! >= bucketStart && c._created! < bucketEnd,
        ).length;
        cumulative += newInMonth;
        customerGrowth.push({
          label: formatMonthLabel(bucketStart),
          newCustomers: newInMonth,
          totalCustomers: cumulative,
        });
      }

      // Also include customers with no created_at in the total
      const noDateCount = allScopedCustomers.filter((c) => !parseDate(c.created_at)).length;
      if (noDateCount > 0 && customerGrowth.length > 0) {
        customerGrowth.forEach((bucket) => {
          bucket.totalCustomers += noDateCount;
        });
      }
    }

    // Customer type distribution
    const customerTypeDistribution = (() => {
      const typeCounts = new Map<string, number>();
      customers.forEach((c) => {
        const label = c.type === "business" ? "Business" : c.type === "individual" ? "Individual" : "Other";
        typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
      });
      return Array.from(typeCounts.entries())
        .filter(([, count]) => count > 0)
        .map(([label, count]) => ({ label, count }));
    })();

    // Build available filter options for the frontend
    const filterOptions = {
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      users: scope === "super_admin" || scope === "department_admin"
        ? scopedUsers.map((u) => ({ id: u.id, name: u.name }))
        : [],
    };

    const response = {
      scope,
      roleName,
      departmentName: (departmentId && departmentMap.get(departmentId)) || "All Departments",
      cards,
      comparison,
      vatStatus: buildStatusCounts(vatPeriodsFiltered),
      ctStatus: buildStatusCounts(ctPeriodsFiltered),
      workloadByDepartment,
      workloadByUser,
      filingTrend: trendBuckets,
      overallStatus,
      completionRate: {
        total: allFilings.length,
        submitted: submittedCount,
        percentage: allFilings.length ? Math.round((submittedCount / allFilings.length) * 100) : 0,
      },
      dueDates,
      recentActivity,
      customerAttention,
      customerGrowth,
      customerTypeDistribution,
      filterOptions,
      appliedFilters: {
        month: filters.month,
        year: filters.year,
        filingType: filters.filingType,
        departmentId: filters.departmentId,
        userId: filters.userId,
      },
    };

    return res.json(response);
  } catch (error: any) {
    console.error("[DashboardRoute] Failed to build dashboard summary:", error);
    const msg = String(error?.message || "");
    const causeCode = error?.cause?.code;
    const isTimeout =
      causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
      msg.toLowerCase().includes("fetch failed") ||
      msg.toLowerCase().includes("connect timeout") ||
      error?.name === "AuthRetryableFetchError";
    if (isTimeout) {
      return res.status(503).json({ message: "Database service temporarily unavailable. Please try again." });
    }
    return res.status(500).json({ message: error?.message || "Failed to load dashboard summary" });
  }
});

export default router;
