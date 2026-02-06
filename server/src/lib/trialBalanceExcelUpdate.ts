import * as XLSX from "xlsx";

export type TrialBalanceUpdateAuditEntry = {
  accountCode: string;
  column: string;
  oldValue: number | null;
  newValue: number | null;
};

export type TrialBalanceUpdatePreviewRow = {
  rowNumber: number;
  accountCode: string;
  ledgerName: string;
  matchedBy: "accountCode" | "ledgerName";
  updates: TrialBalanceUpdateAuditEntry[];
};

type HeaderMapping = {
  accountCode: number | null;
  ledgerName: number | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
};

type PdfRecord = {
  accountCode?: string;
  ledgerName?: string;
  debit?: number;
  credit?: number;
  balance?: number;
};

const HEADER_ALIASES = {
  accountCode: [
    "account code",
    "account no",
    "account number",
    "account #",
    "acct code",
    "a c code",
    "gl code",
    "code",
  ],
  ledgerName: [
    "ledger name",
    "account name",
    "account",
    "ledger",
    "description",
    "name",
  ],
  debit: ["debit", "dr", "net debit", "debit amount"],
  credit: ["credit", "cr", "net credit", "credit amount"],
  balance: [
    "balance",
    "amount",
    "net",
    "closing balance",
    "net balance",
    "balance amount",
    "value",
  ],
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeAccountCode = (value?: string) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

const normalizeLedgerName = (value?: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const isNegative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[(),\s]/g, "");
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  return isNegative ? -numeric : numeric;
};

const matchesHeader = (value: string, aliases: string[]) => {
  const normalized = normalizeHeader(value);
  if (!normalized) return false;
  return aliases.some((alias) => normalized === alias || normalized.includes(alias));
};

const findHeaderMapping = (row: unknown[]): HeaderMapping => {
  const mapping: HeaderMapping = {
    accountCode: null,
    ledgerName: null,
    debit: null,
    credit: null,
    balance: null,
  };

  row.forEach((cell, idx) => {
    const text = String(cell || "").trim();
    if (!text) return;
    if (mapping.accountCode === null && matchesHeader(text, HEADER_ALIASES.accountCode)) {
      mapping.accountCode = idx;
      return;
    }
    if (mapping.ledgerName === null && matchesHeader(text, HEADER_ALIASES.ledgerName)) {
      mapping.ledgerName = idx;
      return;
    }
    if (mapping.debit === null && matchesHeader(text, HEADER_ALIASES.debit)) {
      mapping.debit = idx;
      return;
    }
    if (mapping.credit === null && matchesHeader(text, HEADER_ALIASES.credit)) {
      mapping.credit = idx;
      return;
    }
    if (mapping.balance === null && matchesHeader(text, HEADER_ALIASES.balance)) {
      mapping.balance = idx;
    }
  });

  return mapping;
};

const detectHeaderRow = (rows: unknown[][]) => {
  let bestRowIndex = -1;
  let bestScore = -1;
  let bestMapping: HeaderMapping | null = null;

  const scanRows = Math.min(rows.length, 10);
  for (let i = 0; i < scanRows; i += 1) {
    const mapping = findHeaderMapping(rows[i] || []);
    const score =
      (mapping.accountCode !== null ? 2 : 0) +
      (mapping.ledgerName !== null ? 2 : 0) +
      (mapping.debit !== null ? 1 : 0) +
      (mapping.credit !== null ? 1 : 0) +
      (mapping.balance !== null ? 1 : 0);

    if (score > bestScore) {
      bestRowIndex = i;
      bestScore = score;
      bestMapping = mapping;
    }
  }

  return {
    rowIndex: bestRowIndex,
    mapping: bestMapping,
  };
};

const coercePdfRecords = (payload: any): PdfRecord[] => {
  const entries = Array.isArray(payload)
    ? payload
    : payload?.entries || payload?.data || payload?.trialBalance || payload?.rows || [];

  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry: any) => {
      const accountCode =
        entry?.accountCode ??
        entry?.account_code ??
        entry?.accountNo ??
        entry?.accountNumber ??
        entry?.code ??
        entry?.account_code_id;
      const ledgerName =
        entry?.ledgerName ??
        entry?.accountName ??
        entry?.account ??
        entry?.ledger ??
        entry?.description ??
        entry?.name;

      const debit = parseNumber(entry?.debit ?? entry?.dr ?? entry?.debitAmount);
      const credit = parseNumber(entry?.credit ?? entry?.cr ?? entry?.creditAmount);
      let balance = parseNumber(entry?.balance ?? entry?.amount ?? entry?.net ?? entry?.value);

      if (balance === null && debit !== null && credit !== null) {
        balance = round2(debit - credit);
      }

      if (!accountCode && !ledgerName) return null;

      return {
        accountCode: accountCode ? String(accountCode).trim() : undefined,
        ledgerName: ledgerName ? String(ledgerName).trim() : undefined,
        debit: debit === null ? undefined : debit,
        credit: credit === null ? undefined : credit,
        balance: balance === null ? undefined : balance,
      } as PdfRecord;
    })
    .filter(Boolean) as PdfRecord[];
};

export type TrialBalanceUpdateOptions = {
  sheetName?: string;
  dryRun?: boolean;
};

export type TrialBalanceUpdateResult = {
  updatedBuffer?: Buffer;
  auditLog: TrialBalanceUpdateAuditEntry[];
  preview: TrialBalanceUpdatePreviewRow[];
  matchedRows: number;
  updatedCells: number;
  sheetName: string;
};

export const updateTrialBalanceExcel = (
  buffer: Buffer,
  pdfPayload: any,
  options: TrialBalanceUpdateOptions = {},
): TrialBalanceUpdateResult => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName =
    (options.sheetName && workbook.SheetNames.includes(options.sheetName)
      ? options.sheetName
      : workbook.SheetNames[0]) || "";

  if (!sheetName) {
    throw new Error("No sheets found in the Excel file.");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error("Unable to read the selected sheet.");
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
  if (!rows.length) {
    throw new Error("Excel sheet is empty.");
  }

  const { rowIndex, mapping } = detectHeaderRow(rows);
  if (rowIndex < 0 || !mapping) {
    throw new Error("Unable to detect header row in the Excel sheet.");
  }

  if (mapping.accountCode === null && mapping.ledgerName === null) {
    throw new Error("Excel file must include an Account Code or Ledger Name column.");
  }

  if (mapping.debit === null && mapping.credit === null && mapping.balance === null) {
    throw new Error("Excel file must include Debit, Credit, or Balance/Amount columns.");
  }

  const records = coercePdfRecords(pdfPayload);
  if (!records.length) {
    throw new Error("No PDF entries were provided to update the Excel file.");
  }

  const byCode = new Map<string, PdfRecord>();
  const byName = new Map<string, PdfRecord>();

  records.forEach((record) => {
    if (record.accountCode) {
      const key = normalizeAccountCode(record.accountCode);
      if (key && !byCode.has(key)) byCode.set(key, record);
    }
    if (record.ledgerName) {
      const key = normalizeLedgerName(record.ledgerName);
      if (key && !byName.has(key)) byName.set(key, record);
    }
  });

  const auditLog: TrialBalanceUpdateAuditEntry[] = [];
  const preview: TrialBalanceUpdatePreviewRow[] = [];
  let matchedRows = 0;

  const headerRow = rows[rowIndex] || [];
  const headerLabel = (index: number | null, fallback: string) => {
    if (index === null) return fallback;
    const raw = String(headerRow[index] || "").trim();
    return raw || fallback;
  };

  const updateCell = (
    rowIndexValue: number,
    colIndex: number | null,
    recordValue: number | undefined,
    columnFallback: string,
    rowAccountCode: string,
    updates: TrialBalanceUpdateAuditEntry[],
  ) => {
    if (colIndex === null || recordValue === undefined) return;

    const cellAddress = XLSX.utils.encode_cell({ r: rowIndexValue, c: colIndex });
    const cell = worksheet[cellAddress];
    const oldValue = parseNumber(cell?.v ?? rows[rowIndexValue]?.[colIndex]);
    const newValue = round2(recordValue);
    const delta = oldValue === null ? Math.abs(newValue) : Math.abs(oldValue - newValue);

    if (oldValue !== null && delta <= 0.005) return;

    if (!options.dryRun) {
      worksheet[cellAddress] = { t: "n", v: newValue };
    }

    const entry: TrialBalanceUpdateAuditEntry = {
      accountCode: rowAccountCode,
      column: headerLabel(colIndex, columnFallback),
      oldValue,
      newValue,
    };
    updates.push(entry);
    auditLog.push(entry);
  };

  for (let r = rowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const rowAccountCode =
      mapping.accountCode !== null ? String(row[mapping.accountCode] ?? "").trim() : "";
    const rowLedgerName =
      mapping.ledgerName !== null ? String(row[mapping.ledgerName] ?? "").trim() : "";

    const codeKey = normalizeAccountCode(rowAccountCode);
    const nameKey = normalizeLedgerName(rowLedgerName);

    let record: PdfRecord | undefined;
    let matchedBy: "accountCode" | "ledgerName" | null = null;

    if (codeKey && byCode.has(codeKey)) {
      record = byCode.get(codeKey);
      matchedBy = "accountCode";
    } else if (nameKey && byName.has(nameKey)) {
      record = byName.get(nameKey);
      matchedBy = "ledgerName";
    }

    if (!record || !matchedBy) continue;
    matchedRows += 1;

    const updates: TrialBalanceUpdateAuditEntry[] = [];
    const logAccountCode = record.accountCode || rowAccountCode || rowLedgerName;
    updateCell(r, mapping.debit, record.debit, "Debit", logAccountCode, updates);
    updateCell(r, mapping.credit, record.credit, "Credit", logAccountCode, updates);
    updateCell(r, mapping.balance, record.balance, "Balance", logAccountCode, updates);

    if (updates.length > 0) {
      preview.push({
        rowNumber: r + 1,
        accountCode: rowAccountCode,
        ledgerName: rowLedgerName,
        matchedBy,
        updates,
      });
    }
  }

  const updatedBuffer = options.dryRun
    ? undefined
    : (XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer);

  return {
    updatedBuffer,
    auditLog,
    preview,
    matchedRows,
    updatedCells: auditLog.length,
    sheetName,
  };
};
