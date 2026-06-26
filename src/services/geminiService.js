/**
 * geminiService.js
 *
 * Thin wrapper around the Google GenAI SDK.
 * Responsibilities:
 *   1. Initialise the SDK client once (module-level singleton).
 *   2. Call the Gemini model with the prompt built by analyzeTicketPrompt.js.
 *   3. Retry transient failures with exponential backoff.
 *   4. Parse the model's JSON reply.
 *   5. Wrap SDK errors into a safe, route-friendly error object.
 *
 * This file knows NOTHING about Express — it's pure business logic.
 */

const { GoogleGenAI } = require("@google/genai");
const { buildPrompt } = require("../prompts/analyzeTicketPrompt");

// ── SDK client (created once, reused for every request) ────────────────────
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
}

const ai    = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ── Retry config (override via .env if needed) ─────────────────────────────
const MAX_RETRIES   = parseInt(process.env.GEMINI_MAX_RETRIES   ?? "4", 10);
const BASE_DELAY_MS = parseInt(process.env.GEMINI_BASE_DELAY_MS ?? "500", 10);

// HTTP status codes / error keywords that are worth retrying.
// Auth errors (401, 403) and bad requests (400) are NOT retried.
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Returns true if this SDK error looks transient (server busy, rate-limited,
 * network blip) and is worth retrying.
 *
 * @param {Error} err
 */
function isRetryable(err) {
  // Google GenAI SDK surfaces HTTP status on err.status (number)
  if (err.status && RETRYABLE_STATUS_CODES.has(err.status)) return true;

  // Fallback: scan the message for known transient phrases
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("overloaded") ||
    msg.includes("service unavailable") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("server error") ||
    msg.includes("timeout")
  );
}

/**
 * sleep — returns a Promise that resolves after `ms` milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── callWithRetry ──────────────────────────────────────────────────────────
/**
 * Calls `fn` up to (1 + MAX_RETRIES) times, with exponential backoff + jitter
 * between attempts. Only retries on transient errors.
 *
 * Backoff schedule (BASE_DELAY_MS = 500ms, jitter up to 200ms):
 *   Attempt 1 — immediate
 *   Attempt 2 — ~500 ms
 *   Attempt 3 — ~1 000 ms
 *   Attempt 4 — ~2 000 ms
 *   Attempt 5 — ~4 000 ms
 *
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function callWithRetry(fn) {
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isRetryable(err)) {
        // Non-transient (e.g. auth failure, bad prompt) — fail immediately
        throw err;
      }

      if (attempt === MAX_RETRIES) break; // no more attempts

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 200;
      console.warn(
        `[geminiService] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed ` +
        `(${err.status ?? err.message}). Retrying in ${Math.round(delay)}ms…`
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

// ── analyzeTicket ──────────────────────────────────────────────────────────
/**
 * Sends a validated ticket to Gemini and returns the parsed analysis object.
 *
 * @param {object} ticket – validated request body
 * @returns {Promise<object>} – parsed LLM JSON response
 * @throws {GeminiServiceError}
 */
async function analyzeTicket(ticket) {
  const { systemInstruction, userMessage } = buildPrompt(ticket);

  let rawText;

  try {
    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: userMessage,          // shorthand for a single user turn
        config: {
          systemInstruction,
          responseMimeType: "application/json", // forces the model to return JSON
        },
      })
    );

    rawText = response.text;
  } catch (sdkErr) {
    throw new GeminiServiceError("Gemini API call failed after retries.", sdkErr);
  }

  // ── Parse JSON ─────────────────────────────────────────────────────────
  try {
    return JSON.parse(rawText);
  } catch {
    throw new GeminiServiceError(
      "Gemini returned a response that could not be parsed as JSON.",
      null,
      rawText   // attach raw text for server-side debugging only
    );
  }
}

// ── Custom error class ──────────────────────────────────────────────────────
/**
 * Wraps Gemini-specific failures so the route can catch them separately
 * from unexpected JS errors and respond with the right HTTP code.
 */
class GeminiServiceError extends Error {
  /**
   * @param {string}      message   – safe message (may be sent to client)
   * @param {Error|null}  cause     – original SDK error (server-side only)
   * @param {string|null} rawOutput – raw model text (server-side debugging)
   */
  constructor(message, cause = null, rawOutput = null) {
    super(message);
    this.name    = "GeminiServiceError";
    this.cause   = cause;
    this.rawOutput = rawOutput;
  }
}

module.exports = { analyzeTicket, GeminiServiceError };
