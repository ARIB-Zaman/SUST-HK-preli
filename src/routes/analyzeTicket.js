const { Router } = require("express");
const validateTicket = require("../middleware/validateTicket");

const router = Router();

// POST /analyze-ticket
router.post("/", validateTicket, async (req, res) => {
  try {
    const { ticket_id } = req.body;

    // TODO: pass validated payload to LLM service layer here

    // Placeholder 200 — replace with real LLM response once service is wired up
    res.status(200).json({
      ticket_id,
      status: "received",
      message: "Ticket accepted and queued for analysis.",
    });
  } catch (err) {
    console.error("[analyze-ticket] Unexpected error:", err);
    res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
});

module.exports = router;
