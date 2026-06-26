/**
 * buildPrompt
 *
 * Converts a validated ticket object into a { systemInstruction, userMessage }
 * pair ready to be sent to the Gemini API.
 *
 * Keep this file focused — it's the only place prompt language lives.
 * The service layer (geminiService.js) stays model-agnostic.
 */

/**
 * @param {object} ticket – validated request body from POST /analyze-ticket
 * @returns {{ systemInstruction: string, userMessage: string }}
 */
function buildPrompt(ticket) {
  // ── System instruction ─────────────────────────────────────────────────────
  // Tells the model who it is and what format to return.
  // TODO: expand with domain rules, output schema, and few-shot examples.
  const systemInstruction = `\
You are an intelligent customer support AI for a mobile financial service (MFS) platform.
Your job is to analyze a customer support ticket and return a structured JSON response.

Guidelines:
- Be concise and factual. Do not hallucinate transaction details.
- The complaint may be written in English, Bangla, or a mix (Banglish). Handle all three.
- Cross-reference the complaint text with any transaction_history entries provided.
- Return ONLY valid JSON — no markdown, no extra commentary.

Output schema (fill every key; use null for unknown values):
{
  "ticket_id":       string,   // echo back the incoming ticket_id unchanged
  "category":        string,   // e.g. "wrong_transfer", "fraud", "general_inquiry"
  "severity":        string,   // "low" | "medium" | "high" | "critical"
  "summary":         string,   // one-sentence summary of the complaint in English
  "matched_transaction_id": string | null, // transaction_id from history that matches the complaint, or null
  "recommended_action": string, // suggested next step for the support agent
  "confidence":      number    // 0.0–1.0, how confident the model is in its analysis
}`;

  // ── User message ───────────────────────────────────────────────────────────
  // The full ticket payload serialised as JSON so the model sees every field.
  const userMessage = `Analyze the following support ticket and return the JSON response:\n\n${JSON.stringify(ticket, null, 2)}`;

  return { systemInstruction, userMessage };
}

module.exports = { buildPrompt };
