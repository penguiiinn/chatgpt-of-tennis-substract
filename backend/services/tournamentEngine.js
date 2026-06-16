/**
 * AceIntel Tournament Engine
 *
 * Analyses a player's tournament prospects based on:
 *  - Ranking strength
 *  - Recent form (last 10 matches win rate)
 *  - Surface fit (% of recent matches on tournament surface)
 *  - Recent fatigue (match volume in last 5 results)
 *
 * Returns:
 *  titleProbability  {number}  0–100 (%)
 *  pathDifficulty    {string}  "Easy" | "Medium" | "Hard"
 *  surfaceFit        {string}  "Poor" | "Good" | "Excellent"
 *  dangerRounds      {Array}   predicted tough rounds (strings)
 *  upsetRisk         {string}  "Low" | "Medium" | "High"
 */

// ── Known tournament surfaces ────────────────────────────────────────────────
// Covers the main ATP/WTA events. Unknown tournaments default to "hard".
const TOURNAMENT_SURFACES = {
  // Hard
  "australian open":       "hard",
  "us open":               "hard",
  "indian wells masters":  "hard",
  "miami open":            "hard",
  "canada masters":        "hard",
  "cincinnati masters":    "hard",
  "madrid open":           "hard",   // (indoor hard when listed as such)
  "paris masters":         "hard",
  "vienna open":           "hard",
  "basel indoor":          "hard",
  "nitto atp finals":      "hard",
  "united cup":            "hard",
  "atp cup":               "hard",
  "brisbane international": "hard",
  "doha":                  "hard",
  "dubai":                 "hard",
  "acapulco":              "hard",
  "eastbourne":            "grass",
  // Clay
  "roland garros":         "clay",
  "french open":           "clay",
  "rome masters":          "clay",
  "monte-carlo masters":   "clay",
  "monte carlo masters":   "clay",
  "barcelona open":        "clay",
  "munich open":           "clay",
  "estoril open":          "clay",
  "hamburg open":          "clay",
  "geneva open":           "clay",
  "lyon open":             "clay",
  "stuttgart open":        "clay",   // sometimes grass, clay version here
  // Grass
  "wimbledon":             "grass",
  "queens club":           "grass",
  "halle open":            "grass",
  "s-hertogenbosch":       "grass",
  "nottingham open":       "grass",
  "newport":               "grass",
};

/**
 * Resolve tournament surface from name.
 * @param {string} tournamentName
 * @returns {string} "hard" | "clay" | "grass"
 */
function resolveTournamentSurface(tournamentName) {
  if (!tournamentName) return "hard";
  const key = tournamentName.trim().toLowerCase();
  return TOURNAMENT_SURFACES[key] || "hard";
}

/**
 * Compute surface fit score (0–100) and label.
 * Uses ratio of matches played on target surface from recent history.
 *
 * @param {Object} surfaces  { hard, clay, grass }
 * @param {string} surface   target surface
 * @returns {{ score: number, label: string }}
 */
function computeSurfaceFit(surfaces, surface) {
  if (!surfaces) return { score: 50, label: "Good" };

  const total = (surfaces.hard || 0) + (surfaces.clay || 0) + (surfaces.grass || 0);
  if (total === 0) return { score: 50, label: "Good" };

  const onSurface = surfaces[surface] || 0;
  const pct = (onSurface / total) * 100;

  let label;
  if (pct >= 50)      label = "Excellent";
  else if (pct >= 25) label = "Good";
  else                label = "Poor";

  return { score: Math.round(pct), label };
}

/**
 * Compute ranking score (0–100). Lower rank → higher score.
 * @param {number} rank
 * @returns {number}
 */
function rankScore(rank) {
  if (!rank || rank <= 0) return 50;
  return Math.max(0, Math.round(((500 - Math.min(rank, 500)) / 500) * 100));
}

/**
 * Parse win rate from form object.
 * @param {Object} form { winRate }
 * @returns {number} 0–100
 */
function parseWinRate(form) {
  if (!form) return 50;
  const r = parseFloat(form.winRate);
  return isNaN(r) ? 50 : r;
}

/**
 * Compute fatigue level from trends.
 * More matches in last 5 = higher fatigue (match density signal).
 * trends.recentMatches.length → 0–5
 * @param {Object} trends { recentMatches, streak, momentum }
 * @returns {{ fatigue: number, label: string }}   fatigue 0–100
 */
function computeFatigue(trends) {
  if (!trends) return { fatigue: 30, label: "Fresh" };
  const count = (trends.recentMatches || []).length;
  // 5 matches in 5 = maximally busy; 0 = fully rested
  const fatigue = Math.round((count / 5) * 100);
  let label;
  if (fatigue >= 80)      label = "Fatigued";
  else if (fatigue >= 40) label = "Moderate";
  else                    label = "Fresh";
  return { fatigue, label };
}

/**
 * Compute path difficulty from ranking and surface fit.
 * Top-10 players face harder draws (more giants) and scrutiny.
 * @param {number} rank
 * @param {number} surfaceScore
 * @returns {string} "Easy" | "Medium" | "Hard"
 */
function computePathDifficulty(rank, surfaceScore) {
  if (!rank || rank > 100) return "Easy";       // lower seeds face easier early rounds
  if (rank <= 10) {
    // Top players face harder draws on average
    return surfaceScore < 30 ? "Hard" : "Medium";
  }
  if (rank <= 30) return surfaceScore < 25 ? "Hard" : "Medium";
  return "Easy";
}

/**
 * Compute upset risk from fatigue, form, and rank.
 * @param {number} fatigue
 * @param {number} winRate
 * @param {number} rank
 * @returns {string} "Low" | "Medium" | "High"
 */
function computeUpsetRisk(fatigue, winRate, rank) {
  let risk = 0;
  if (fatigue >= 80)   risk += 3;
  else if (fatigue >= 40) risk += 1;

  if (winRate < 40)    risk += 3;
  else if (winRate < 55) risk += 1;

  if (!rank || rank > 50)  risk += 2;
  else if (rank > 20)       risk += 1;

  if (risk >= 5)  return "High";
  if (risk >= 2)  return "Medium";
  return "Low";
}

/**
 * Predict danger rounds based on path difficulty and player rank.
 * Returns round names where the player is most likely to be tested.
 * @param {string} pathDifficulty
 * @param {number} rank
 * @param {string} upsetRisk
 * @returns {string[]}
 */
function predictDangerRounds(pathDifficulty, rank, upsetRisk) {
  const rounds = [];

  // Top seeds always face danger in later rounds
  if (!rank || rank <= 5) {
    if (pathDifficulty === "Hard") rounds.push("Quarterfinal", "Semifinal");
    else                            rounds.push("Semifinal", "Final");
  } else if (rank <= 15) {
    if (upsetRisk === "High")       rounds.push("Round of 16", "Quarterfinal");
    else                            rounds.push("Quarterfinal");
  } else if (rank <= 40) {
    if (upsetRisk !== "Low")        rounds.push("Round of 32", "Round of 16");
    else                            rounds.push("Round of 16");
  } else {
    rounds.push("Round of 64", "Round of 32");
  }

  return rounds;
}

/**
 * Compute title probability (0–100) using weighted signals.
 * Weights: ranking 40%, form 35%, surface fit 25%
 *
 * @param {number} rScore     ranking score 0–100
 * @param {number} winRate    form win rate 0–100
 * @param {number} sfScore    surface fit score 0–100
 * @param {number} fatigue    fatigue 0–100 (penalty)
 * @returns {number}
 */
function computeTitleProbability(rScore, winRate, sfScore, fatigue) {
  const base =
    0.40 * rScore +
    0.35 * winRate +
    0.25 * sfScore;

  // Apply fatigue penalty: up to -15 points at max fatigue
  const fatiguePenalty = (fatigue / 100) * 15;

  return Math.max(1, Math.min(99, Math.round(base - fatiguePenalty)));
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {Object} player
 *   player.profile  { name, rank, ... }
 *   player.form     { winRate, matches, wins, losses }
 *   player.surfaces { hard, clay, grass }
 *   player.trends   { recentMatches, streak, momentum }
 *
 * @param {string} tournament  Tournament name (e.g. "Roland Garros")
 *
 * @returns {Object}
 */
function analyzeTournament(player, tournament) {
  const { profile, form, surfaces, trends } = player;

  // ── Resolve inputs ─────────────────────────────────────────────────────────
  const surface    = resolveTournamentSurface(tournament);
  const rank       = profile?.rank || 999;
  const winRate    = parseWinRate(form);

  const { score: sfScore, label: surfaceFit } = computeSurfaceFit(surfaces, surface);
  const { fatigue, label: fatigueLabel }       = computeFatigue(trends);
  const rScore                                 = rankScore(rank);

  // ── Derived signals ────────────────────────────────────────────────────────
  const titleProbability = computeTitleProbability(rScore, winRate, sfScore, fatigue);
  const pathDifficulty   = computePathDifficulty(rank, sfScore);
  const upsetRisk        = computeUpsetRisk(fatigue, winRate, rank);
  const dangerRounds     = predictDangerRounds(pathDifficulty, rank, upsetRisk);

  return {
    player:           profile?.name || "Unknown",
    tournament,
    surface,

    titleProbability,
    pathDifficulty,
    surfaceFit,
    dangerRounds,
    upsetRisk,

    // Supplementary breakdown for frontend display
    breakdown: {
      rankScore:    rScore,
      formScore:    Math.round(winRate),
      surfaceScore: sfScore,
      fatigue:      fatigue,
      fatigueLabel,
    }
  };
}

module.exports = { analyzeTournament, resolveTournamentSurface };
