const { getDb, getPlayerMatches, getPlayerSurfaceStats } = require("../history/historicalStore");
const { getLivePlayerProfile, getLiveProfileCache } = require("../scraper/multiSourceScraper");
const { PLAYERS_DB } = require("../data/db");

// Trend score weights
const TREND_WEIGHTS = {
  recentForm: 0.35,
  winStreak: 0.20,
  rankingImprovement: 0.15,
  surfaceStreak: 0.15,
  upsetQuality: 0.15
};

// Labels
const LABELS = {
  HOT: "🔥",
  RISING: "📈",
  DANGEROUS: "⚡",
  SLUMPING: "📉",
  NEUTRAL: "—"
};

// Cache for trending data
let trendingCache = null;
let lastComputeTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate trend score for a player
 */
async function computeTrendScore(player, profile, historicalMatches) {
  const scores = {
    recentForm: 0,
    winStreak: 0,
    rankingImprovement: 0,
    surfaceStreak: 0,
    upsetQuality: 0,
    total: 0
  };

  // 1. Recent form (35%) - from last 10 matches
  const recentForm = profile.recentForm || [];
  if (recentForm.length > 0) {
    const wins = recentForm.filter(f =>
      f === "W" || f === "win" || f === "W/W" || f.includes("W")
    ).length;
    scores.recentForm = (wins / recentForm.length) * 100;
  } else if (profile.recentMatches && profile.recentMatches.length > 0) {
    const wins = profile.recentMatches.slice(0, 10).filter(m =>
      m.result === "W" || m.result === "win"
    ).length;
    scores.recentForm = (wins / Math.min(10, profile.recentMatches.length)) * 100;
  }

  // 2. Win streak (20%) - consecutive wins from most recent
  let streak = 0;
  const formToCheck = recentForm.length > 0 ? recentForm : (profile.recentMatches || []).slice(0, 10).map(m => m.result);
  for (let i = 0; i < formToCheck.length; i++) {
    const f = formToCheck[i];
    if (f === "W" || f === "win" || f === "W/W" || f.includes("W")) {
      streak++;
    } else {
      break;
    }
  }
  scores.winStreak = Math.min(streak * 15, 100); // Max 100 at 6+ streak

  // 3. Ranking improvement (15%) - from historical rankings
  const rankingsHistory = profile.rankingsHistory || [];
  if (rankingsHistory.length >= 2) {
    // Compare avg rank last 10 matches vs avg rank previous 10
    const recentAvg = rankingsHistory.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const olderAvg = rankingsHistory.slice(5, 15).reduce((a, b) => a + b, 0) / Math.min(10, rankingsHistory.length - 5);
    if (olderAvg > recentAvg) {
      scores.rankingImprovement = Math.min(((olderAvg - recentAvg) / olderAvg) * 100, 100);
    }
  } else if (profile.bestRank && profile.rank) {
    // Fallback: use best rank vs current
    const currentRank = parseInt(profile.rank) || 100;
    const bestRank = parseInt(profile.bestRank) || currentRank;
    if (bestRank < currentRank) {
      scores.rankingImprovement = Math.min(((currentRank - bestRank) / currentRank) * 50, 100);
    }
  }

  // 4. Surface streak (15%) - wins on current surface
  // We'll calculate from recent matches if surface data available
  const surfaceMatchData = profile.recentMatches || [];
  if (surfaceMatchData.length > 0) {
    let surfStreak = 0;
    for (const m of surfaceMatchData) {
      if (m.surface && m.surface.toLowerCase() === (profile.lastSurface || "hard").toLowerCase()) {
        if (m.result === "W" || m.result === "win") {
          surfStreak++;
        } else {
          break;
        }
      }
    }
    scores.surfaceStreak = Math.min(surfStreak * 20, 100);
  }

  // 5. Upset quality (15%) - wins vs higher ranked opponents
  if (historicalMatches && profile.recentMatches) {
    let upsetWins = 0;
    let upsetMatches = 0;
    const currentRank = parseInt(profile.rank) || 100;

    profile.recentMatches.slice(0, 10).forEach(m => {
      if (m.result === "W" || m.result === "win") {
        const oppRank = m.opponentRanking || m.opponentRank || 999;
        if (oppRank < currentRank) {
          // Beat someone better
          upsetWins += (currentRank - oppRank) / 10;
        }
      }
    });
    scores.upsetQuality = Math.min(upsetWins * 10, 100);
  }

  // Calculate total
  scores.total = (
    TREND_WEIGHTS.recentForm * scores.recentForm +
    TREND_WEIGHTS.winStreak * scores.winStreak +
    TREND_WEIGHTS.rankingImprovement * scores.rankingImprovement +
    TREND_WEIGHTS.surfaceStreak * scores.surfaceStreak +
    TREND_WEIGHTS.upsetQuality * scores.upsetQuality
  );

  return scores;
}

/**
 * Assign label based on trend score and momentum
 */
function assignLabel(scores, currentRank) {
  if (scores.winStreak >= 5 && scores.recentForm >= 70) {
    return { label: "HOT", icon: LABELS.HOT };
  }
  if (scores.rankingImprovement >= 30 && currentRank <= 20) {
    return { label: "RISING", icon: LABELS.RISING };
  }
  if (scores.upsetQuality >= 40 && scores.recentForm >= 50) {
    return { label: "DANGEROUS", icon: LABELS.DANGEROUS };
  }
  if (scores.recentForm < 30 && scores.winStreak <= 1) {
    return { label: "SLUMPING", icon: LABELS.SLUMPING };
  }
  return { label: "NEUTRAL", icon: LABELS.NEUTRAL };
}

/**
 * Get trending players - main export
 * @param {string} surface - optional surface filter
 * @param {number} limit - max players to return
 */
async function getTrendingPlayers(surface = "hard", limit = 10) {
  const now = Date.now();

  // Return cached if valid
  if (trendingCache && now - lastComputeTime < CACHE_TTL_MS && trendingCache.surface === surface) {
    return trendingCache.players.slice(0, limit);
  }

  // Get profiles from live cache and static DB
  const liveCache = getLiveProfileCache();
  const profiles = {};

  // Add Target players (7 hardcoded)
  const TARGET_PLAYERS = ["Novak Djokovic", "Carlos Alcaraz", "Jannik Sinner", "Daniil Medvedev", "Alexander Zverev", "Holger Rune", "Taylor Fritz"];

  for (const name of TARGET_PLAYERS) {
    const cacheKey = name.toLowerCase().replace(/ /g, "");
    if (liveCache.has(cacheKey)) {
      const cached = liveCache.get(cacheKey);
      if (cached && cached.data && cached.data.player) {
        profiles[name] = cached.data.player;
      }
    } else {
      // Try to fetch and cache
      try {
        const result = await getLivePlayerProfile(name);
        if (result && result.player) {
          profiles[name] = result.player;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  const results = [];

  // Process each active player
  for (const [playerName, profile] of Object.entries(profiles)) {
    if (!profile || !profile.name || profile.name === "Unknown") continue;

    // Skip players ranked > 100 for trending
    const rank = parseInt(profile.rank) || 999;
    if (rank > 100) continue;

    try {
      // Get historical matches for surface stats
      const historicalMatches = getPlayerMatches(playerName);
      const surfaceStats = getPlayerSurfaceStats(playerName);

      // Compute trend scores
      const trendScores = await computeTrendScore(playerName, profile, historicalMatches);

      // Calculate surface win %
      let surfaceWinPct = 50;
      if (surfaceStats && surfaceStats.surfaces) {
        const surfKey = Object.keys(surfaceStats.surfaces).find(
          k => k.toLowerCase() === surface.toLowerCase()
        );
        if (surfKey) {
          surfaceWinPct = surfaceStats.surfaces[surfKey].winRate || 50;
        }
      }

      // Get last 10 match results
      const last10 = (profile.recentForm || []).slice(0, 10);
      const last10Results = last10.length > 0
        ? last10.map(f => f === "W" || f === "win" || f === "W/W" ? "W" : "L")
        : (profile.recentMatches || []).slice(0, 10).map(m => m.result === "W" ? "W" : "L");

      // Assign label
      const { label, icon } = assignLabel(trendScores, rank);

      results.push({
        rank,
        name: playerName,
        trendScore: Math.round(trendScores.total),
        recentForm: Math.round(trendScores.recentForm),
        winStreak: Math.round(trendScores.winStreak / 15), // Convert back to count
        rankingImprovement: Math.round(trendScores.rankingImprovement),
        surfaceWinPct: Math.round(surfaceWinPct),
        upsetScore: Math.round(trendScores.upsetQuality),
        last10: last10Results,
        label: `${icon} ${label}`,
        labelOnly: label,
        surface
      });
    } catch (err) {
      // Skip players with errors
    }
  }

  // Sort by trend score descending
  results.sort((a, b) => b.trendScore - a.trendScore);

  // Cache results
  trendingCache = {
    surface,
    players: results,
    computedAt: new Date().toISOString()
  };
  lastComputeTime = now;

  return results.slice(0, limit);
}

/**
 * Clear cache - for manual refresh
 */
function clearCache() {
  trendingCache = null;
  lastComputeTime = 0;
}

module.exports = {
  getTrendingPlayers,
  clearCache,
  computeTrendScore,
  assignLabel,
  TREND_WEIGHTS,
  LABELS
};