import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import rolesRoutes from "./routes/roles";
import permissionsRoutes from "./routes/permissions";
import departmentsRoutes from "./routes/departments";
import customersRoutes from "./routes/customers";
import leadsRoutes from "./routes/leads";
import dealsRoutes from "./routes/deals";
import salesSettingsRoutes from "./routes/salesSettings";
import ctFilingRoutes from "./routes/ctFiling";
import ctWorkflowRoutes from "./routes/ctWorkflow";
import aiRoutes from "./routes/ai";
import trialBalanceRoutes from "./routes/trialBalance";

const app = express();

const originEnv = process.env.CLIENT_ORIGIN || "";
const allowedOrigins = originEnv
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/deals", dealsRoutes);
app.use("/api/sales-settings", salesSettingsRoutes);
app.use("/api/ct", ctFilingRoutes);
app.use("/api/ct-workflow", ctWorkflowRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/trial-balance", trialBalanceRoutes);

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`DocuFlow backend listening on ${port}`);
});
