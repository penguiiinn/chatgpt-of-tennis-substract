/**
 * AceIntel Betting Intelligence Engine
 *
 * Analyses a match prediction against bookmaker odds to surface:
 *  - Edge (model probability vs implied probability)
 *  - Value bet flag
 *  - Risk score
 *  - Betting tag (Safe / Medium / Aggressive)
 *  - Trap match warning
 */

/**
 * Convert decimal odds to implied probability (%).
 * e.g. odds = 1.80  →  impliedProb = 55.6
 *
 * @param {number} decimalOdds
 * @returns {number} implied probability 0-100
 */
function impliedProbability(decimalOdds) {
  if (!decimalOdds || decimalOdds <= 1) return 100; // safety
  return parseFloat(((1 / decimalOdds) * 100).toFixed(2));
}

/**
 * Derive betting tag from edge magnitude.
 * Safe       → edge ≥ 15%  (strong book error)
 * Medium     → edge ≥ 7%   (value threshold)
 * Aggressive → edge ≥ 0%   (slight model edge, higher risk)
 * No Bet     → edge < 0    (book has better read)
 *
 * @param {number} edge  (percentage points, e.g. 12.4)
 * @returns {string}
 */
function bettingTag(edge) {
  if (edge >= 15) return "Safe";
  if (edge >= 7)  return "Medium";
  if (edge >= 0)  return "Aggressive";
  return "No Bet";
}

/**
 * Map prediction confidence to betting risk score.
 *
 * @param {string} confidence - "High" | "Medium" | "Low"
 * @returns {string} "Low" | "Medium" | "High"
 */
function riskScore(confidence) {
  switch ((confidence || "").toLowerCase()) {
    case "high":   return "Low";
    case "medium": return "Medium";
    default:       return "High";
  }
}

/**
 * Main betting analysis function.
 *
 * @param {Object} prediction  - Output from predictionEngine.predictMatch()
 *   prediction.winner            {string}
 *   prediction.winProbability    {number}  50-95
 *   prediction.confidence        {string}  "High" | "Medium" | "Low"
 *   prediction.upsetAlert        {boolean}
 *   prediction.meta.playerA.name {string}
 *   prediction.meta.playerB.name {string}
 *
 * @param {Object} odds
 *   odds.playerA  {number}  Decimal odds for Player A (e.g. 1.65)
 *   odds.playerB  {number}  Decimal odds for Player B (e.g. 2.30)
 *
 * @returns {Object}
 */
function analyzeBet(prediction, odds) {
  const { winProbability, confidence, upsetAlert, winner, meta } = prediction;

  const playerAName = meta?.playerA?.name || "Player A";
  const playerBName = meta?.playerB?.name || "Player B";

  // Determine which player our model favours and get their odds
  const modelFavoursA = winner === playerAName;
  const favouredOdds  = modelFavoursA ? odds.playerA : odds.playerB;

  // Implied probability from bookmaker odds for the favoured player
  const implied = impliedProbability(favouredOdds);

  // Edge = model probability minus implied probability (in percentage points)
  const edge = parseFloat((winProbability - implied).toFixed(2));

  // Value bet: true if edge exceeds 7 percentage points
  const valueBet = edge > 7;

  // Risk and tag
  const risk = riskScore(confidence);
  const tag  = bettingTag(edge);

  // Trap match: upset scenario where model confidence is low
  // upsetAlert fires when a lower-ranked player has better form+surface
  // winProbability < 65 means the model isn't highly confident
  const trapMatch = upsetAlert === true && winProbability < 65;

  return {
    // Favoured player context
    favouredPlayer: winner,
    favouredOdds:   favouredOdds ?? null,

    // Core betting metrics
    impliedProbability: implied,
    modelProbability:   winProbability,
    edge,
    valueBet,

    // Risk classification
    risk,
    tag,

    // Warning flags
    trapMatch,
    upsetAlert: upsetAlert ?? false,

    // Human-readable summary
    summary: buildSummary({ winner, winProbability, edge, valueBet, tag, trapMatch, risk })
  };
}

/**
 * Build a concise one-line summary string for display in the frontend.
 */
function buildSummary({ winner, winProbability, edge, valueBet, tag, trapMatch, risk }) {
  const parts = [];

  if (trapMatch) {
    parts.push(`⚠️ TRAP MATCH — proceed with caution.`);
  }

  if (valueBet) {
    parts.push(`✅ Value bet on ${winner} (${winProbability}% model probability, ${edge > 0 ? "+" : ""}${edge}pp edge).`);
  } else if (tag === "No Bet") {
    parts.push(`🚫 No bet — book has the edge on this market.`);
  } else {
    parts.push(`⚡ Aggressive play on ${winner} — thin edge of ${edge > 0 ? "+" : ""}${edge}pp.`);
  }

  parts.push(`Risk: ${risk}.`);
  return parts.join(" ");
}

module.exports = { analyzeBet };
