import { Router } from "express";
import multer from "multer";
import { requireAuth, requirePermission } from "../middleware/auth";
import { updateTrialBalanceExcel } from "../lib/trialBalanceExcelUpdate";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/update-excel",
  requireAuth,
  requirePermission(["projects:view", "projects-ct-filing:view"]),
  upload.fields([
    { name: "excel", maxCount: 1 },
    { name: "pdfJson", maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const excelFile = files?.excel?.[0];

    if (!excelFile) {
      return res.status(400).json({ message: "Excel file is required." });
    }

    let pdfPayload: any = null;
    const bodyPdf = req.body?.pdfJson || req.body?.pdfData;

    try {
      if (files?.pdfJson?.[0]) {
        pdfPayload = JSON.parse(files.pdfJson[0].buffer.toString("utf-8"));
      } else if (typeof bodyPdf === "string" && bodyPdf.trim()) {
        pdfPayload = JSON.parse(bodyPdf);
      }
    } catch (error) {
      return res.status(400).json({ message: "Unable to parse PDF JSON payload." });
    }

    if (!pdfPayload) {
      return res.status(400).json({ message: "PDF JSON payload is required." });
    }

    const dryRun =
      String(req.body?.dryRun || "")
        .trim()
        .toLowerCase() === "true" || String(req.body?.dryRun || "") === "1";
    const sheetName = req.body?.sheetName ? String(req.body.sheetName) : undefined;

    try {
      const result = updateTrialBalanceExcel(excelFile.buffer, pdfPayload, {
        sheetName,
        dryRun,
      });

      const fileName = `updated_${excelFile.originalname || "trial_balance.xlsx"}`;

      return res.json({
        fileName,
        fileBase64: result.updatedBuffer ? result.updatedBuffer.toString("base64") : null,
        auditLog: result.auditLog,
        preview: result.preview,
        matchedRows: result.matchedRows,
        updatedCells: result.updatedCells,
        sheetName: result.sheetName,
        dryRun,
      });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Unable to update Excel file." });
    }
  },
);

export default router;
