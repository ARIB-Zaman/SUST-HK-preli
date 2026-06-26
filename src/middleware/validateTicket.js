/**
 * Middleware: validateTicket
 *
 * Validates the POST /analyze-ticket request body.
 *
 * Required : ticket_id, complaint
 * Optional : language, channel, user_type, campaign_context,
 *            transaction_history, metadata
 *
 * Returns:
 *   400 – missing or wrong-type required fields
 *   422 – schema valid but semantically unusable
 */

const VALID_LANGUAGES    = ["en", "bn", "mixed"];
const VALID_CHANNELS     = ["in_app_chat", "call_center", "email", "merchant_portal", "field_agent"];
const VALID_USER_TYPES   = ["customer", "merchant", "agent", "unknown"];
const VALID_TXN_TYPES    = ["transfer", "cash_in", "cash_out", "payment"];
const VALID_TXN_STATUSES = ["completed", "pending", "failed"];

function validateTicket(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Request body must be a JSON object." });
  }

  const {
    ticket_id,
    complaint,
    language,
    channel,
    user_type,
    campaign_context,
    transaction_history,
    metadata,
  } = body;

  // ── Required fields ───────────────────────────────────────────────────────
  if (!ticket_id || typeof ticket_id !== "string") {
    return res.status(400).json({ error: "Missing or invalid required field: ticket_id (string)." });
  }

  if (complaint === undefined || complaint === null) {
    return res.status(400).json({ error: "Missing required field: complaint." });
  }
  if (typeof complaint !== "string") {
    return res.status(400).json({ error: "Invalid field: complaint must be a string." });
  }

  // ── 422: semantically invalid complaint ───────────────────────────────────
  if (complaint.trim().length === 0) {
    return res.status(422).json({ error: "complaint must not be empty or whitespace-only." });
  }
  if (complaint.trim().length < 10) {
    return res.status(422).json({
      error: "complaint is too short to be meaningful (minimum 10 characters).",
    });
  }

  // ── Optional: language ────────────────────────────────────────────────────
  if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
    return res.status(422).json({
      error: `Invalid value for language. Allowed: ${VALID_LANGUAGES.join(", ")}.`,
    });
  }

  // ── Optional: channel ─────────────────────────────────────────────────────
  if (channel !== undefined && !VALID_CHANNELS.includes(channel)) {
    return res.status(422).json({
      error: `Invalid value for channel. Allowed: ${VALID_CHANNELS.join(", ")}.`,
    });
  }

  // ── Optional: user_type ───────────────────────────────────────────────────
  if (user_type !== undefined && !VALID_USER_TYPES.includes(user_type)) {
    return res.status(422).json({
      error: `Invalid value for user_type. Allowed: ${VALID_USER_TYPES.join(", ")}.`,
    });
  }

  // ── Optional: campaign_context ────────────────────────────────────────────
  if (campaign_context !== undefined && typeof campaign_context !== "string") {
    return res.status(422).json({ error: "campaign_context must be a string." });
  }

  // ── Optional: transaction_history ─────────────────────────────────────────
  if (transaction_history !== undefined) {
    if (!Array.isArray(transaction_history)) {
      return res.status(422).json({ error: "transaction_history must be an array." });
    }

    // Empty array is valid (safety-only cases have no transaction context)
    const seenIds = new Set();

    for (let i = 0; i < transaction_history.length; i++) {
      const txn = transaction_history[i];
      const p   = `transaction_history[${i}]`;

      if (!txn.transaction_id || typeof txn.transaction_id !== "string") {
        return res.status(422).json({ error: `${p}.transaction_id is required and must be a string.` });
      }

      if (seenIds.has(txn.transaction_id)) {
        return res.status(422).json({
          error: `Duplicate transaction_id "${txn.transaction_id}" found in transaction_history. Each transaction must have a unique ID.`,
        });
      }
      seenIds.add(txn.transaction_id);

      if (!txn.timestamp || typeof txn.timestamp !== "string") {
        return res.status(422).json({ error: `${p}.timestamp is required and must be an ISO 8601 string.` });
      }
      if (isNaN(Date.parse(txn.timestamp))) {
        return res.status(422).json({ error: `${p}.timestamp is not a valid date-time string.` });
      }
      if (txn.type !== undefined && !VALID_TXN_TYPES.includes(txn.type)) {
        return res.status(422).json({
          error: `${p}.type is invalid. Allowed: ${VALID_TXN_TYPES.join(", ")}.`,
        });
      }
      if (txn.amount !== undefined && (typeof txn.amount !== "number" || txn.amount < 0)) {
        return res.status(422).json({ error: `${p}.amount must be a non-negative number.` });
      }
      if (txn.status !== undefined && !VALID_TXN_STATUSES.includes(txn.status)) {
        return res.status(422).json({
          error: `${p}.status is invalid. Allowed: ${VALID_TXN_STATUSES.join(", ")}.`,
        });
      }
    }
  }

  // ── Optional: metadata ────────────────────────────────────────────────────
  if (metadata !== undefined) {
    if (typeof metadata !== "object" || Array.isArray(metadata) || metadata === null) {
      return res.status(422).json({ error: "metadata must be a plain object." });
    }
  }

  next();
}

module.exports = validateTicket;
