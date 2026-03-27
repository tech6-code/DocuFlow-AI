import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { InvoiceUpload } from "../components/InvoiceUpload";
import { InvoiceResults } from "../components/InvoiceResults";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { extractInvoicesData } from "../services/geminiService";

import { Invoice, DocumentHistoryItem } from "../types";

import {
  generatePreviewUrls,
  convertFileToParts,
  Part,
} from "../utils/fileUtils";


// Helpers moved to utils/fileUtils.ts

export const InvoicesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { knowledgeBase, addToKnowledgeBase, addHistoryItem } = useData();

  const [appState, setAppState] = useState<
    "initial" | "loading" | "success" | "error"
  >("initial");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pageCountPerFile, setPageCountPerFile] = useState<number[]>([]);
  const [pdfPassword, setPdfPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyTrn, setCompanyTrn] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Results
  const [processedInvoices, setProcessedInvoices] = useState<Invoice[]>([]);

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressSubText, setProgressSubText] = useState("");

  const normalizeInvoiceType = (invoice: Invoice): Invoice => {
    // No company identity → everything is "other"
    if (!companyName && !companyTrn) {
      return { ...invoice, invoiceType: "other" };
    }

    const normalize = (value: string) =>
      value ? value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";

    const uTrn = normalize(companyTrn || "");
    const uName = normalize(companyName || "");
    const vTrn = normalize(invoice.vendorTrn || "");
    const cTrn = normalize(invoice.customerTrn || "");
    const vName = normalize(invoice.vendorName || "");
    const cName = normalize(invoice.customerName || "");

    const trnMatch = (a: string, b: string) =>
      a && b && (a === b || a.includes(b) || b.includes(a));

    const nameMatch = (a: string, b: string) =>
      a && b && a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a));

    // Check if user company matches vendor field (could mean sales OR Gemini swapped)
    const userMatchesVendor = trnMatch(uTrn, vTrn) || nameMatch(uName, vName);
    // Check if user company matches customer field
    const userMatchesCustomer = trnMatch(uTrn, cTrn) || nameMatch(uName, cName);

    if (userMatchesVendor && !userMatchesCustomer) {
      // User is the vendor/supplier → Sales invoice
      return { ...invoice, invoiceType: "sales" };
    } else if (userMatchesCustomer && !userMatchesVendor) {
      // User is the customer/buyer → Purchase invoice
      return { ...invoice, invoiceType: "purchase" };
    }
    // Ambiguous (matches both or neither) → "other"
    return { ...invoice, invoiceType: "other" };
  };

  const handleFileSelect = async (files: File[] | File | null) => {
    if (!files) {
      setSelectedFiles([]);
      setPreviewUrls([]);
      return;
    }
    const fileArray = Array.isArray(files) ? files : [files];
    setSelectedFiles(fileArray);
    const result = await generatePreviewUrls(fileArray);
    setPreviewUrls(result.urls);
    setPageCountPerFile(result.pageCountPerFile);
  };

  const processFiles = async () => {
    setAppState("loading");
    setProgress(2);
    setProgressMessage("Preparing invoices...");
    setProgressSubText("");

    try {
      const totalFiles = selectedFiles.length;

      // Phase 1: Convert all files to parts and build a per-file map
      const fileEntries: { file: File; parts: Part[] }[] = [];
      let totalPages = 0;

      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        setProgressMessage(`Converting file ${i + 1}/${totalFiles}`);
        setProgressSubText(file.name);
        setProgress(2 + Math.round(((i + 1) / totalFiles) * 8)); // 2-10%
        try {
          const parts = await convertFileToParts(file, {
            pdfPassword,
            maxPdfPages: Number.MAX_SAFE_INTEGER,
          });
          fileEntries.push({ file, parts });
          totalPages += parts.length;
          setProgressSubText(`${file.name} — ${totalPages} pages`);
        } catch (fileError) {
          console.error(`Failed to convert file: ${file.name}`, fileError);
        }
      }

      if (fileEntries.length === 0) {
        throw new Error("No readable pages found in uploaded files.");
      }

      console.log(
        `[InvoicesPage] ${fileEntries.length} files, ${totalPages} total pages`,
      );

      // Phase 2: Process pages in batches across all files
      // Split large files into page batches to avoid huge payloads and show page-level progress.
      const PAGES_PER_BATCH = 8;
      const CONCURRENT_BATCHES = 4;
      const allInvoices: Invoice[] = [];
      let pagesProcessedOverall = 0;

      // Build a flat list of page batches with file context
      const pageBatches: { file: File; parts: Part[]; batchStart: number; batchEnd: number }[] = [];
      for (const { file, parts } of fileEntries) {
        for (let start = 0; start < parts.length; start += PAGES_PER_BATCH) {
          const end = Math.min(start + PAGES_PER_BATCH, parts.length);
          pageBatches.push({ file, parts: parts.slice(start, end), batchStart: start + 1, batchEnd: end });
        }
      }

      let nextBatchIdx = 0;

      const batchWorker = async () => {
        while (nextBatchIdx < pageBatches.length) {
          const batchIdx = nextBatchIdx++;
          const { file, parts, batchStart, batchEnd } = pageBatches[batchIdx];

          setProgressMessage(file.name);
          setProgressSubText(
            `Page ${pagesProcessedOverall}/${totalPages} — ${allInvoices.length} invoices found`,
          );

          try {
            const kbSlice =
              allInvoices.length > 50
                ? allInvoices.slice(-50)
                : allInvoices;
            const result = await extractInvoicesData(
              parts,
              [...knowledgeBase, ...kbSlice],
              companyName,
              companyTrn,
            );
            if (result?.invoices?.length) {
              allInvoices.push(...result.invoices);
            }
          } catch (err) {
            console.error(
              `[InvoicesPage] Failed to extract pages ${batchStart}-${batchEnd} from ${file.name}`,
              err,
            );
          }

          pagesProcessedOverall += parts.length;

          const overallProgress =
            10 + Math.round((pagesProcessedOverall / totalPages) * 85);
          setProgress(overallProgress);
          setProgressSubText(
            `Page ${pagesProcessedOverall}/${totalPages} — ${allInvoices.length} invoices found`,
          );
        }
      };

      await Promise.all(
        Array.from({
          length: Math.min(CONCURRENT_BATCHES, pageBatches.length),
        }).map(() => batchWorker()),
      );

      console.log(
        `[InvoicesPage] Total invoices extracted: ${allInvoices.length}`,
      );

      const normalizedInvoices = allInvoices.map(normalizeInvoiceType);
      const sales = normalizedInvoices.filter((i) => i.invoiceType === "sales");
      const purchases = normalizedInvoices.filter(
        (i) => i.invoiceType === "purchase",
      );
      setProcessedInvoices(normalizedInvoices);

      setProgress(100);
      setProgressMessage("Complete");
      setProgressSubText(
        `${allInvoices.length} invoices extracted from ${totalPages} pages across ${fileEntries.length} file${fileEntries.length > 1 ? 's' : ''}`,
      );
      setAppState("success");

      const historyItem: DocumentHistoryItem = {
        id: Date.now().toString(),
        type: "Invoices & Bills",
        title: `Invoices Batch (${normalizedInvoices.length})`,
        processedAt: new Date().toISOString(),
        pageCount: selectedFiles.length,
        processedBy: currentUser?.name || "User",
        salesInvoices: sales,
        purchaseInvoices: purchases,
      };
      addHistoryItem(historyItem);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Failed to process invoices.");
      setAppState("error");
    }
  };

  const resetState = () => {
    setAppState("initial");
    setProcessedInvoices([]);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setPageCountPerFile([]);
    setCompanyName("");
    setCompanyTrn("");
    setPdfPassword("");
    setProgress(0);
    setProgressMessage("");
    setProgressSubText("");
    setIsConfirmModalOpen(false);
  };

  if (appState === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingIndicator
          progress={progress}
          statusText={progressMessage}
          subStatusText={progressSubText}
        />
      </div>
    );
  }

  if (appState === "success") {
    const hasCompanyIdentity =
      companyName.trim().length > 0 || companyTrn.trim().length > 0;

    return (
      <InvoiceResults
        invoices={processedInvoices}
        onReset={resetState}
        previewUrls={previewUrls}
        knowledgeBase={knowledgeBase}
        onAddToKnowledgeBase={addToKnowledgeBase}
        onUpdateInvoice={() => {}}
        visibleSections={['sales', 'purchase', 'other', 'salesTotal', 'purchaseTotal', 'otherTotal', 'vatSummary', 'vatReturn']}
      />
    );
  }

  return (
    <>
      <InvoiceUpload
        onFilesSelect={handleFileSelect}
        selectedFiles={selectedFiles}
        showCompanyFields={true}
        pageConfig={{
          title: "Invoices & Bills",
          subtitle: "Upload invoices for analysis",
          uploadButtonText: "Add Invoices",
        }}
        knowledgeBase={knowledgeBase}
        pdfPassword={pdfPassword}
        onPasswordChange={setPdfPassword}
        companyName={companyName}
        onCompanyNameChange={setCompanyName}
        companyTrn={companyTrn}
        onCompanyTrnChange={setCompanyTrn}
        onProcess={() => setIsConfirmModalOpen(true)}
        previewUrls={previewUrls}
        pageCountPerFile={pageCountPerFile}
      />
      <ConfirmationDialog
        isOpen={isConfirmModalOpen}
        onConfirm={() => {
          setIsConfirmModalOpen(false);
          processFiles();
        }}
        onCancel={() => setIsConfirmModalOpen(false)}
        title="Start Processing?"
      >
        Are you sure you want to process {selectedFiles.length} files?
      </ConfirmationDialog>
    </>
  );
};
