const { Router } = require("express");
const validateTicket = require("../middleware/validateTicket");
const { analyzeTicket, GeminiServiceError } = require("../services/geminiService");

const router = Router();

// POST /analyze-ticket
router.post("/", validateTicket, async (req, res) => {
  try {
    const result = await analyzeTicket(req.body);
    return res.status(200).json(result);

  } catch (err) {
    if (err instanceof GeminiServiceError) {
      // Log full details server-side (cause + rawOutput may contain secrets)
      console.error("[analyze-ticket] Gemini error:", err.message, err.cause, err.rawOutput);
      return res.status(500).json({ error: "Failed to process ticket with AI service. Please try again later." });
    }

    // Unexpected JS error
    console.error("[analyze-ticket] Unexpected error:", err);
    return res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
  }
});

module.exports = router;
