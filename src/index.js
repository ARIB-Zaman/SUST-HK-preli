require("dotenv").config();
const express = require("express");
const cors = require("cors");

const healthRouter = require("./routes/health");
const analyzeTicketRouter = require("./routes/analyzeTicket");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/health", healthRouter);
app.use("/analyze-ticket", analyzeTicketRouter);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Log full details server-side; never expose stack traces or secrets to clients.
app.use((err, _req, res, _next) => {
  console.error("[global error handler]", err);
  res.status(err.status || 500).json({ error: "An unexpected error occurred. Please try again later." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
