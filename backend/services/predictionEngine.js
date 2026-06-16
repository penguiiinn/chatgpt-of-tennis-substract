/**
 * AceIntel Prediction Engine
 * Weighted scoring model for tennis match outcome prediction.
 *
 * Inputs: { profile, form, surfaces, trends } objects for playerA and playerB
 * Output: { winner, winProbability, confidence, factors, upsetAlert }
 */

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
  ranking: 0.30,
  form:    0.25,
  surface: 0.20,
  h2h:     0.15,
  trend:   0.10
};

/**
 * Clamp a value between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Convert a raw score difference (A - B) to a 0–1 probability for A.
 * Uses a logistic curve so extreme differences approach 0 or 1 smoothly.
 */
function scoreToProbability(scoreA, scoreB) {
  const diff = scoreA - scoreB;
  // Logistic function: 1 / (1 + e^(-k * diff))
  const k = 0.08; // steepness — tune for tennis range
  return 1 / (1 + Math.exp(-k * diff));
}

/**
 * Derive a "surface win rate" for a player over their last 100 matches.
 * surfaces object: { hard: N, clay: N, grass: N }  (match count per surface, not win %)
 * Since profileService.getSurfaceStats returns counts not win-rates, we infer
 * dominant surface preference as a proxy for surface comfort (higher count = more
 * experience / comfort on that surface).
 *
 * Returns a 0–100 score representing relative surface comfort (0–100 scale).
 */
function surfaceComfortScore(surfaces, targetSurface) {
  if (!surfaces) return 50;

  const surface = (targetSurface || "hard").toLowerCase();
  const total = (surfaces.hard || 0) + (surfaces.clay || 0) + (surfaces.grass || 0);
  if (total === 0) return 50;

  const onSurface = surfaces[surface] || 0;
  // Return % of matches on this surface as comfort score (0–100)
  return (onSurface / total) * 100;
}

/**
 * Parse winRate string ("60.0") → float (60.0). Fallbacks to 50.
 */
function parseWinRate(form) {
  if (!form) return 50;
  const r = parseFloat(form.winRate);
  return isNaN(r) ? 50 : r;
}

/**
 * H2H score for playerA against playerB.
 * h2h object expected shape: { wins, losses } (or null/undefined).
 * Returns 0–100 score.
 */
function h2hScore(h2h) {
  if (!h2h) return 50; // neutral if no H2H data
  const wins   = h2h.wins   || 0;
  const losses = h2h.losses || 0;
  const total  = wins + losses;
  if (total === 0) return 50;
  return (wins / total) * 100;
}

/**
 * Trend momentum score.
 * trends object: { streak, momentum }
 * streak = # of wins in last 5 matches.
 * Returns 0–100 score.
 */
function trendScore(trends) {
  if (!trends) return 50;
  const streak = trends.streak || 0;
  // streak is 0–5 → map to 0–100
  return (streak / 5) * 100;
}

/**
 * Ranking score for a player.
 * Lower rank number = better → we invert: score = 1000 - rank (clamped).
 * Returns 0–100 normalised score.
 */
function rankingScore(rank) {
  if (!rank || rank <= 0) return 50;
  // Assume max meaningful rank is 500
  const inverted = Math.max(0, 500 - rank);
  return (inverted / 500) * 100;
}

/**
 * Main prediction function.
 *
 * @param {Object} playerA - { profile, form, surfaces, trends, h2h }
 * @param {Object} playerB - { profile, form, surfaces, trends, h2h }
 * @param {string} [surface="hard"] - Surface for this match (optional context)
 * @returns {Object} Prediction result
 */
function predictMatch(playerA, playerB, surface = "hard") {
  // ── Extract raw scores per dimension ────────────────────────────────────────

  const aRankScore = rankingScore(playerA.profile?.rank);
  const bRankScore = rankingScore(playerB.profile?.rank);

  const aFormScore = parseWinRate(playerA.form);
  const bFormScore = parseWinRate(playerB.form);

  const aSurfaceScore = surfaceComfortScore(playerA.surfaces, surface);
  const bSurfaceScore = surfaceComfortScore(playerB.surfaces, surface);

  const aH2HScore = h2hScore(playerA.h2h);
  const bH2HScore = 100 - aH2HScore; // symmetric — A's H2H win rate vs B is B's loss rate

  const aTrendScore = trendScore(playerA.trends);
  const bTrendScore = trendScore(playerB.trends);

  // ── Compute weighted composite score ────────────────────────────────────────

  const aComposite =
    WEIGHTS.ranking * aRankScore +
    WEIGHTS.form    * aFormScore +
    WEIGHTS.surface * aSurfaceScore +
    WEIGHTS.h2h     * aH2HScore +
    WEIGHTS.trend   * aTrendScore;

  const bComposite =
    WEIGHTS.ranking * bRankScore +
    WEIGHTS.form    * bFormScore +
    WEIGHTS.surface * bSurfaceScore +
    WEIGHTS.h2h     * bH2HScore +
    WEIGHTS.trend   * bTrendScore;

  // ── Derive win probability for A ────────────────────────────────────────────

  const rawProb = scoreToProbability(aComposite, bComposite); // 0–1
  // Scale to 50–95 range as required
  const winProbA = clamp(Math.round(50 + (rawProb - 0.5) * 90), 50, 95);
  const winProbB = 100 - winProbA;

  const aWins = winProbA >= winProbB;
  const winner = aWins
    ? (playerA.profile?.name || "Player A")
    : (playerB.profile?.name || "Player B");

  const winProbability = aWins ? winProbA : winProbB;

  // ── Confidence level ────────────────────────────────────────────────────────

  const probDiff = Math.abs(aComposite - bComposite);
  let confidence;
  if (probDiff > 12)      confidence = "High";
  else if (probDiff > 5)  confidence = "Medium";
  else                    confidence = "Low";

  // ── Upset alert ─────────────────────────────────────────────────────────────
  // True when the lower-ranked player (worse rank number) is predicted to win
  // AND has stronger form + surface score.

  const aRank = playerA.profile?.rank || 9999;
  const bRank = playerB.profile?.rank || 9999;
  const aIsLowerRanked = aRank > bRank; // higher number = worse ranking

  let upsetAlert = false;
  if (aIsLowerRanked && aWins) {
    // A is lower ranked but predicted to win
    upsetAlert = (aFormScore > bFormScore) && (aSurfaceScore > bSurfaceScore);
  } else if (!aIsLowerRanked && !aWins) {
    // B is lower ranked but predicted to win
    upsetAlert = (bFormScore > aFormScore) && (bSurfaceScore > aSurfaceScore);
  }

  // ── Factor breakdown (A vs B scores) ────────────────────────────────────────

  const factors = {
    ranking: {
      playerA: Math.round(aRankScore),
      playerB: Math.round(bRankScore),
      winner:  aRankScore >= bRankScore
        ? (playerA.profile?.name || "Player A")
        : (playerB.profile?.name || "Player B"),
      weight: "30%"
    },
    form: {
      playerA: Math.round(aFormScore),
      playerB: Math.round(bFormScore),
      winner:  aFormScore >= bFormScore
        ? (playerA.profile?.name || "Player A")
        : (playerB.profile?.name || "Player B"),
      weight: "25%"
    },
    surface: {
      playerA: Math.round(aSurfaceScore),
      playerB: Math.round(bSurfaceScore),
      winner:  aSurfaceScore >= bSurfaceScore
        ? (playerA.profile?.name || "Player A")
        : (playerB.profile?.name || "Player B"),
      weight: "20%"
    },
    h2h: {
      playerA: Math.round(aH2HScore),
      playerB: Math.round(bH2HScore),
      winner:  aH2HScore >= bH2HScore
        ? (playerA.profile?.name || "Player A")
        : (playerB.profile?.name || "Player B"),
      weight: "15%"
    },
    trend: {
      playerA: Math.round(aTrendScore),
      playerB: Math.round(bTrendScore),
      winner:  aTrendScore >= bTrendScore
        ? (playerA.profile?.name || "Player A")
        : (playerB.profile?.name || "Player B"),
      weight: "10%"
    }
  };

  return {
    winner,
    winProbability,
    confidence,
    factors,
    upsetAlert,
    meta: {
      playerA: {
        name:      playerA.profile?.name || "Player A",
        composite: Math.round(aComposite * 10) / 10
      },
      playerB: {
        name:      playerB.profile?.name || "Player B",
        composite: Math.round(bComposite * 10) / 10
      },
      surface
    }
  };
}

module.exports = { predictMatch };
