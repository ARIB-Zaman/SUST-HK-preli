/**
 * Middleware: validateTicket
 *
 * Validates the POST /analyze-ticket request body.
 *
 * Required top-level fields  : id, label, input
 * Required fields inside input: ticket_id, complaint
 *
 * Returns:
 *   400 – missing / wrong-type required fields
 *   422 – schema valid but semantically unusable (e.g. blank complaint)
 */

const VALID_LANGUAGES = ["en", "bn"];
const VALID_CHANNELS = ["in_app_chat", "sms", "email", "call"];
const VALID_USER_TYPES = ["customer", "agent", "merchant"];
const VALID_TRANSACTION_TYPES = ["transfer", "cash_in", "cash_out", "payment"];
const VALID_TRANSACTION_STATUSES = ["completed", "pending", "failed"];

function validateTicket(req, res, next) {
  const body = req.body;

  // ── Top-level required fields ─────────────────────────────────────────────
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Request body must be a JSON object." });
  }

  const { id, label, input } = body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid required field: id (string)." });
  }

  if (!label || typeof label !== "string") {
    return res.status(400).json({ error: "Missing or invalid required field: label (string)." });
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return res.status(400).json({ error: "Missing or invalid required field: input (object)." });
  }

  // ── Required fields inside input ──────────────────────────────────────────
  const { ticket_id, complaint } = input;

  if (!ticket_id || typeof ticket_id !== "string") {
    return res.status(400).json({ error: "Missing or invalid required field: input.ticket_id (string)." });
  }

  if (complaint === undefined || complaint === null) {
    return res.status(400).json({ error: "Missing required field: input.complaint." });
  }

  if (typeof complaint !== "string") {
    return res.status(400).json({ error: "Invalid field: input.complaint must be a string." });
  }

  // ── 422: Semantically invalid ─────────────────────────────────────────────
  if (complaint.trim().length === 0) {
    return res.status(422).json({ error: "input.complaint must not be empty or whitespace-only." });
  }

  if (complaint.trim().length < 10) {
    return res.status(422).json({ error: "input.complaint is too short to be meaningful (minimum 10 characters)." });
  }

  // ── Optional field type-checks ────────────────────────────────────────────
  const { language, channel, user_type, campaign_context, transaction_history } = input;

  if (language !== undefined && !VALID_LANGUAGES.includes(language)) {
    return res.status(422).json({
      error: `Invalid value for input.language. Allowed: ${VALID_LANGUAGES.join(", ")}.`,
    });
  }

  if (channel !== undefined && !VALID_CHANNELS.includes(channel)) {
    return res.status(422).json({
      error: `Invalid value for input.channel. Allowed: ${VALID_CHANNELS.join(", ")}.`,
    });
  }

  if (user_type !== undefined && !VALID_USER_TYPES.includes(user_type)) {
    return res.status(422).json({
      error: `Invalid value for input.user_type. Allowed: ${VALID_USER_TYPES.join(", ")}.`,
    });
  }

  if (campaign_context !== undefined && typeof campaign_context !== "string") {
    return res.status(422).json({ error: "input.campaign_context must be a string." });
  }

  if (transaction_history !== undefined) {
    if (!Array.isArray(transaction_history)) {
      return res.status(422).json({ error: "input.transaction_history must be an array." });
    }

    for (let i = 0; i < transaction_history.length; i++) {
      const txn = transaction_history[i];
      const prefix = `input.transaction_history[${i}]`;

      if (!txn.transaction_id || typeof txn.transaction_id !== "string") {
        return res.status(422).json({ error: `${prefix}.transaction_id is required and must be a string.` });
      }
      if (!txn.timestamp || typeof txn.timestamp !== "string") {
        return res.status(422).json({ error: `${prefix}.timestamp is required and must be an ISO 8601 string.` });
      }
      if (isNaN(Date.parse(txn.timestamp))) {
        return res.status(422).json({ error: `${prefix}.timestamp is not a valid date-time string.` });
      }
      if (txn.type !== undefined && !VALID_TRANSACTION_TYPES.includes(txn.type)) {
        return res.status(422).json({
          error: `${prefix}.type is invalid. Allowed: ${VALID_TRANSACTION_TYPES.join(", ")}.`,
        });
      }
      if (txn.amount !== undefined && (typeof txn.amount !== "number" || txn.amount < 0)) {
        return res.status(422).json({ error: `${prefix}.amount must be a non-negative number.` });
      }
      if (txn.status !== undefined && !VALID_TRANSACTION_STATUSES.includes(txn.status)) {
        return res.status(422).json({
          error: `${prefix}.status is invalid. Allowed: ${VALID_TRANSACTION_STATUSES.join(", ")}.`,
        });
      }
    }
  }

  next();
}

module.exports = validateTicket;
