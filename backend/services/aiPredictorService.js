const { getDb, initStore, getPlayerMatches, getPlayerSurfaceStats, getPlayerH2H } = require("../history/historicalStore");
const { getLivePlayerProfile } = require("../scraper/multiSourceScraper");
const { PLAYERS_DB } = require("../data/db");

// Factor weights (must sum to 1.0) - Updated per task requirements
const WEIGHTS = {
  // Task requirement: Elo (20%), Recent form (25%), Historical (25%), Surface (15%), H2H (15%)
  elo:              0.20,
  recentForm:       0.25,
  historical:      0.25,
  surface:         0.15,
  h2h:            0.15
};

// Time-weighted form: Last 3 months = 40%, Last 12 months = 35%, Older = 25%
const TIME_WEIGHTS = {
  last3Months:  0.40,
  last12Months: 0.35,
  older:       0.25
};

// Tournament importance multipliers
const TOURNAMENT_WEIGHTS = {
  "grand slam": 1.5,
  "wimbledon": 1.5,
  "roland garros": 1.5,
  "us open": 1.5,
  "australian open": 1.5,
  "masters": 1.3,
  "atp finals": 1.3,
  "1000": 1.3,
  "500": 1.15,
  "250": 1.0
};

/**
 * Normalizes a field value to verify if it is valid (not null/undefined/Unknown/N/A).
 */
function isValid(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") {
    const norm = val.trim().toUpperCase();
    return norm !== "" && norm !== "UNKNOWN" && norm !== "N/A" && !norm.includes("UNKNOWN");
  }
  return true;
}

/**
 * Calculates days since last match.
 */
function getDaysSinceDate(dateStr) {
  if (!dateStr) return null;
  try {
    const lastDate = new Date(dateStr);
    if (isNaN(lastDate.getTime())) return null;
    // Assume current local time is 2026-06-17
    const currentDate = new Date("2026-06-17");
    const diffTime = Math.abs(currentDate - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

/**
 * Predict match outcome between two players.
 * @param {string} player1Name 
 * @param {string} player2Name 
 * @param {string} surface - hard, clay, grass
 */
async function predictMatch(player1Name, player2Name, surface = "hard") {
  // 1. Ensure Historical Store is loaded
  await initStore();

  const normSurface = (surface || "hard").toLowerCase().trim();

  // 2. Fetch live profiles from Multi-Source Scraper
  const [profile1, profile2] = await Promise.all([
    getLivePlayerProfile(player1Name),
    getLivePlayerProfile(player2Name)
  ]);

  if (!profile1 || !profile1.player || !profile2 || !profile2.player) {
    console.error("[aiPredictorService] Player profiles not resolved:", { profile1: !!profile1, profile2: !!profile2 });
    throw new Error("One or both player profiles could not be resolved.");
  }

  // Debug: log profile names to verify data is loaded
  console.log("[aiPredictorService] Resolved players:", profile1.player.name, "vs", profile2.player.name);

  const p1 = profile1.player;
  const p2 = profile2.player;

  let missingFactorsCount = 0;

  // ── Calculate Factor 1: Time-weighted Historical form (last 6-7 years) ──
  // Time weights: Last 3 months = 40%, Last 12 months = 35%, Older = 25%
  let p1HistMatches = getPlayerMatches(p1.name);
  let p2HistMatches = getPlayerMatches(p2.name);

  const getTimeWeightedHistWinRate = (matches) => {
    if (!matches) {
      missingFactorsCount++;
      return null;
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    let wins3mo = 0, total3mo = 0;
    let wins12mo = 0, total12mo = 0;
    let winsOlder = 0, totalOlder = 0;

    Object.keys(matches).forEach(year => {
      matches[year].forEach(m => {
        const matchDate = m.matchDate ? new Date(m.matchDate) : null;
        const isWin = m.result === "W";

        if (matchDate && matchDate >= threeMonthsAgo) {
          total3mo++;
          if (isWin) wins3mo++;
        } else if (matchDate && matchDate >= twelveMonthsAgo) {
          total12mo++;
          if (isWin) wins12mo++;
        } else {
          // Older matches - also count year-level matches without dates
          totalOlder++;
          if (isWin) winsOlder++;
        }
      });
    });

    // Calculate weighted percentages
    const pct3mo = total3mo > 0 ? (wins3mo / total3mo) * 100 : 50;
    const pct12mo = total12mo > 0 ? (wins12mo / total12mo) * 100 : 50;
    const pctOlder = totalOlder > 0 ? (winsOlder / totalOlder) * 100 : 50;

    // Apply time weights
    const weightedScore = (
      TIME_WEIGHTS.last3Months * pct3mo +
      TIME_WEIGHTS.last12Months * pct12mo +
      TIME_WEIGHTS.older * pctOlder
    );

    return weightedScore;
  };

  const getTournamentWeightedHistWinRate = (matches) => {
    // Calculate win rate with tournament importance weighting
    if (!matches) return 50;
    let weightedWins = 0;
    let weightedTotal = 0;

    Object.keys(matches).forEach(year => {
      matches[year].forEach(m => {
        let weight = 1.0;
        const tourney = (m.tournament || "").toLowerCase();

        // Match tournament name against weights
        for (const [key, val] of Object.entries(TOURNAMENT_WEIGHTS)) {
          if (tourney.includes(key)) {
            weight = val;
            break;
          }
        }

        weightedTotal += weight;
        if (m.result === "W") {
          weightedWins += weight;
        }
      });
    });

    return weightedTotal > 0 ? (weightedWins / weightedTotal) * 100 : 50;
  };

  let p1HistWinPct = getTimeWeightedHistWinRate(p1HistMatches);
  let p2HistWinPct = getTimeWeightedHistWinRate(p2HistMatches);

  let p1TourneyWeightedWinPct = getTournamentWeightedHistWinRate(p1HistMatches);
  let p2TourneyWeightedWinPct = getTournamentWeightedHistWinRate(p2HistMatches);

  // Fallback to career win pct if no historical matches exist
  if (p1HistWinPct === null) {
    p1HistWinPct = isValid(p1.careerWinPct) ? Number(p1.careerWinPct) : 50;
    p1TourneyWeightedWinPct = p1HistWinPct;
  }
  if (p2HistWinPct === null) {
    p2HistWinPct = isValid(p2.careerWinPct) ? Number(p2.careerWinPct) : 50;
    p2TourneyWeightedWinPct = p2HistWinPct;
  }

  // ── Calculate Factor 2: Recent 10 matches ──
  const getRecentWinPct = (player) => {
    if (player.recentForm && player.recentForm.length > 0) {
      const wins = player.recentForm.filter(f => f === "W" || f === "win" || f === "W/W").length;
      return (wins / player.recentForm.length) * 100;
    }
    if (player.recentMatches && player.recentMatches.length > 0) {
      const wins = player.recentMatches.slice(0, 10).filter(m => m.result === "win" || m.result === "W").length;
      return (wins / Math.min(10, player.recentMatches.length)) * 100;
    }
    missingFactorsCount++;
    return 50;
  };

  const p1RecentWinPct = getRecentWinPct(p1);
  const p2RecentWinPct = getRecentWinPct(p2);

  // ── Calculate Factor 3: Surface win rate ──
  const getSurfaceWinPct = (pName, playerObj, sfc) => {
    let histStats = getPlayerSurfaceStats(pName);
    let histPct = null;
    if (histStats && histStats.surfaces) {
      // Find matching surface key case-insensitively
      const key = Object.keys(histStats.surfaces).find(k => k.toLowerCase() === sfc);
      if (key && histStats.surfaces[key].total > 0) {
        histPct = histStats.surfaces[key].winRate;
      }
    }

    let livePct = null;
    if (playerObj.surfaceStats) {
      const key = Object.keys(playerObj.surfaceStats).find(k => k.toLowerCase() === sfc);
      if (key && playerObj.surfaceStats[key].winPct !== undefined) {
        livePct = playerObj.surfaceStats[key].winPct;
      }
    }

    if (histPct !== null && livePct !== null) {
      return (histPct * 0.6) + (livePct * 0.4);
    } else if (histPct !== null) {
      return histPct;
    } else if (livePct !== null) {
      return livePct;
    }
    missingFactorsCount++;
    return 50;
  };

  const p1SurfaceWinPct = getSurfaceWinPct(p1.name, p1, normSurface);
  const p2SurfaceWinPct = getSurfaceWinPct(p2.name, p2, normSurface);

  // ── Calculate Factor 4: H2H history with surface-specific and time weighting ──
  let p1Wins = 0;
  let p2Wins = 0;
  let p1SurfaceWins = 0;
  let p2SurfaceWins = 0;
  let recentH2HWeight = 0; // Weight recent meetings more

  // Check historical H2H with surface breakdown
  const histH2H = getPlayerH2H(p1.name, p2.name);
  if (histH2H && histH2H.matches) {
    histH2H.matches.forEach((m, idx) => {
      const isP1Winner = m.result === "W";
      const isSurfaceMatch = m.surface && m.surface.toLowerCase() === normSurface;

      // Count all H2H
      if (isP1Winner) p1Wins++; else p2Wins++;

      // Count surface-specific H2H
      if (isSurfaceMatch) {
        if (isP1Winner) p1SurfaceWins++; else p2SurfaceWins++;
      }

      // Weight recent meetings (last 2 years get 2x weight)
      const matchDate = m.matchDate ? new Date(m.matchDate) : null;
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      if (matchDate && matchDate >= twoYearsAgo) {
        recentH2HWeight += 0.5; // Additional weight for recent
      }
    });
    // Add baseline weight for historical matches
    recentH2HWeight += Math.min(histH2H.matches.length * 0.5, 2);
  }

  // Check live H2H
  if (p1.h2h && p1.h2h[p2.name]) {
    p1Wins = Math.max(p1Wins, p1.h2h[p2.name].wins || 0);
    p2Wins = Math.max(p2Wins, p1.h2h[p2.name].losses || 0);
  } else if (p2.h2h && p2.h2h[p1.name]) {
    p2Wins = Math.max(p2Wins, p2.h2h[p1.name].wins || 0);
    p1Wins = Math.max(p1Wins, p2.h2h[p1.name].losses || 0);
  }

  // Check static H2H
  const staticP1 = PLAYERS_DB[p1.name];
  const staticP2 = PLAYERS_DB[p2.name];
  if (staticP1 && staticP1.h2h && staticP1.h2h.opponent === p2.name) {
    const parts = staticP1.h2h.record.split("-").map(p => parseInt(p.trim()));
    if (parts.length === 2) {
      p1Wins = Math.max(p1Wins, parts[0]);
      p2Wins = Math.max(p2Wins, parts[1]);
    }
  } else if (staticP2 && staticP2.h2h && staticP2.h2h.opponent === p1.name) {
    const parts = staticP2.h2h.record.split("-").map(p => parseInt(p.trim()));
    if (parts.length === 2) {
      p2Wins = Math.max(p2Wins, parts[0]);
      p1Wins = Math.max(p1Wins, parts[1]);
    }
  }

  let p1H2HWinPct = 50;
  let p1SurfaceH2HPct = 50;

  // Calculate overall H2H with time weighting
  if (p1Wins > 0 || p2Wins > 0) {
    p1H2HWinPct = (p1Wins / (p1Wins + p2Wins)) * 100;
    // Apply recent meeting bonus (up to +10%)
    p1H2HWinPct = Math.min(95, p1H2HWinPct + (recentH2HWeight * 5));
  } else {
    missingFactorsCount++;
  }

  // Calculate surface-specific H2H
  const surfaceTotal = p1SurfaceWins + p2SurfaceWins;
  if (surfaceTotal > 0) {
    p1SurfaceH2HPct = (p1SurfaceWins / surfaceTotal) * 100;
  } else {
    // Fallback to overall surface win rate if no surface-specific H2H
    p1SurfaceH2HPct = p1SurfaceWinPct;
  }

  // ── Calculate Factor 5: Performance vs Top 10/20/50 from historical ──
  const getTopPerformance = (matches) => {
    if (!matches) return { top10: 50, top20: 50, top50: 50 };

    let t10w = 0, t10t = 0;
    let t20w = 0, t20t = 0;
    let t50w = 0, t50t = 0;

    Object.keys(matches).forEach(year => {
      matches[year].forEach(m => {
        const rank = m.opponentRanking;
        if (rank !== null && rank !== undefined) {
          if (rank <= 10) { t10t++; if (m.result === "W") t10w++; }
          if (rank <= 20) { t20t++; if (m.result === "W") t20w++; }
          if (rank <= 50) { t50t++; if (m.result === "W") t50w++; }
        }
      });
    });

    return {
      top10: t10t > 0 ? (t10w / t10t) * 100 : 50,
      top20: t20t > 0 ? (t20w / t20t) * 100 : 50,
      top50: t50t > 0 ? (t50w / t50t) * 100 : 50
    };
  };

  const p1TopPerf = getTopPerformance(p1HistMatches);
  const p2TopPerf = getTopPerformance(p2HistMatches);

  // ── Calculate Factor 5: ATP ranking ──
  const getRankScore = (player) => {
    if (!isValid(player.rank)) {
      missingFactorsCount++;
      return 50;
    }
    const rank = Number(player.rank);
    // Lower rank number is better. Score = Math.max(0, 500 - rank) / 5
    return (Math.max(0, 500 - rank) / 500) * 100;
  };

  const p1RankScore = getRankScore(p1);
  const p2RankScore = getRankScore(p2);

  // ── Calculate Factor 6: Elo rating ──
  const getEloScore = (player, opponent) => {
    const pElo = isValid(player.elo) ? Number(player.elo) : 1700;
    const oElo = isValid(opponent.elo) ? Number(opponent.elo) : 1700;

    if (!isValid(player.elo)) missingFactorsCount++;

    const diff = pElo - oElo;
    // Logistic probability
    return (1 / (1 + Math.pow(10, -diff / 400))) * 100;
  };

  const p1EloScore = getEloScore(p1, p2);
  const p2EloScore = getEloScore(p2, p1);

  // ── Calculate Factor 7: Opponent strength ──
  const getOppStrengthScore = (pName, matches, playerObj) => {
    if (!matches) {
      const rank = isValid(playerObj.rank) ? Number(playerObj.rank) : 100;
      if (rank <= 3) return 65;
      if (rank <= 10) return 55;
      if (rank <= 25) return 45;
      return 35;
    }

    let top10Wins = 0;
    let top10Matches = 0;

    Object.keys(matches).forEach(year => {
      matches[year].forEach(m => {
        if (m.opponentRanking !== null && m.opponentRanking <= 10) {
          top10Matches++;
          if (m.result === "W") top10Wins++;
        }
      });
    });

    if (top10Matches > 0) {
      return (top10Wins / top10Matches) * 100;
    }

    missingFactorsCount++;
    const rank = isValid(playerObj.rank) ? Number(playerObj.rank) : 100;
    if (rank <= 3) return 65;
    if (rank <= 10) return 55;
    if (rank <= 25) return 45;
    return 35;
  };

  const p1OppStrength = getOppStrengthScore(p1.name, p1HistMatches, p1);
  const p2OppStrength = getOppStrengthScore(p2.name, p2HistMatches, p2);

  // ── Calculate Factor 8: Momentum score ──
  const getMomentumScore = (player) => {
    const form = player.recentForm || [];
    if (form.length === 0) {
      missingFactorsCount++;
      return 50;
    }
    // Calculate winning streak (consecutive Ws from the beginning of form array)
    let streak = 0;
    for (let i = 0; i < form.length; i++) {
      if (form[i] === "W" || form[i] === "win" || form[i] === "W/W") {
        streak++;
      } else {
        break;
      }
    }
    return Math.min(95, 50 + (streak * 9));
  };

  const p1Momentum = getMomentumScore(p1);
  const p2Momentum = getMomentumScore(p2);

  // ── Calculate Factor 9: Tournament level weighting ──
  const getWeightedHistWinPct = (matches) => {
    if (!matches) return 50;
    let weightedWins = 0;
    let weightedTotal = 0;

    Object.keys(matches).forEach(year => {
      matches[year].forEach(m => {
        let weight = 1.0;
        const tourney = (m.tournament || "").toLowerCase();
        if (tourney.includes("grand slam") || tourney.includes("wimbledon") || tourney.includes("roland garros") || tourney.includes("us open") || tourney.includes("australian open")) {
          weight = 1.5;
        } else if (tourney.includes("masters") || tourney.includes("1000") || tourney.includes("atp finals")) {
          weight = 1.2;
        }

        weightedTotal += weight;
        if (m.result === "W") {
          weightedWins += weight;
        }
      });
    });

    return weightedTotal > 0 ? (weightedWins / weightedTotal) * 100 : 50;
  };

  const p1WeightedHistWinPct = getWeightedHistWinPct(p1HistMatches);
  const p2WeightedHistWinPct = getWeightedHistWinPct(p2HistMatches);

  // ── Calculate Factor 10: Injury/inactivity penalty ──
  const checkInactivity = (player) => {
    if (!player.recentMatches || player.recentMatches.length === 0) return { inactive: false, days: 0, penalty: 0 };
    // Find most recent match date
    let lastDateStr = null;
    player.recentMatches.forEach(m => {
      if (m.date && (!lastDateStr || new Date(m.date) > new Date(lastDateStr))) {
        lastDateStr = m.date;
      }
    });

    if (!lastDateStr) return { inactive: false, days: 0, penalty: 0 };
    const days = getDaysSinceDate(lastDateStr);
    if (days !== null && days > 60) {
      // Inactivity penalty is applied. -2% for every 30 days past 60 days, max -10%
      const penalty = Math.min(10, Math.floor((days - 60) / 30) * 2 + 2);
      return { inactive: true, days, penalty };
    }
    return { inactive: false, days: days || 0, penalty: 0 };
  };

  const p1Inactivity = checkInactivity(p1);
  const p2Inactivity = checkInactivity(p2);

  // ── Compute Weighted Composite Scores using 5 required factors ──
  // Use: Elo (20%), Recent form (25%), Historical (25%), Surface (15%), H2H (15%)
  // Combine time-weighted historical with tournament-weighted for final historical factor
  const p1CombinedHistorical = (p1HistWinPct * 0.6) + (p1TourneyWeightedWinPct * 0.4);
  const p2CombinedHistorical = (p2HistWinPct * 0.6) + (p2TourneyWeightedWinPct * 0.4);

  const p1Composite = (
    WEIGHTS.elo * p1EloScore +
    WEIGHTS.recentForm * p1RecentWinPct +
    WEIGHTS.historical * p1CombinedHistorical +
    WEIGHTS.surface * p1SurfaceWinPct +
    WEIGHTS.h2h * p1H2HWinPct -
    p1Inactivity.penalty
  );

  const p2Composite = (
    WEIGHTS.elo * p2EloScore +
    WEIGHTS.recentForm * p2RecentWinPct +
    WEIGHTS.historical * p2CombinedHistorical +
    WEIGHTS.surface * p2SurfaceWinPct +
    WEIGHTS.h2h * (100 - p1H2HWinPct) -
    p2Inactivity.penalty
  );

  // ── Win Probability ──
  const diff = p1Composite - p2Composite;
  const rawProb = 1 / (1 + Math.exp(-0.06 * diff)); // Logistic steepness
  let winProbA = Math.round(50 + (rawProb - 0.5) * 90);
  winProbA = Math.min(Math.max(winProbA, 50), 95);
  const winProbB = 100 - winProbA;

  const p1Favors = winProbA >= winProbB;
  const favorite = p1Favors ? p1.name : p2.name;
  const winProbability = p1Favors ? winProbA : winProbB;

  // ── Confidence Meter Calculation ──
  let confidencePct = 100;
  // Lower confidence for missing factors
  confidencePct -= (missingFactorsCount * 10);
  // Lower confidence for inactive players
  if (p1Inactivity.inactive || p2Inactivity.inactive) {
    confidencePct -= 15;
  }
  confidencePct = Math.min(95, Math.max(20, confidencePct));

  let confidence = "Medium";
  if (confidencePct >= 75) confidence = "High";
  else if (confidencePct < 45) confidence = "Low";

  // ── Edge Calculations for Breakdown ──
  // 1. Surface Edge
  const surfaceDiff = p1SurfaceWinPct - p2SurfaceWinPct;
  let surfaceEdge = "Even suitability on " + surface;
  if (surfaceDiff > 1.5) {
    surfaceEdge = `${p1.name} (+${surfaceDiff.toFixed(1)}% ${surface.toUpperCase()} Win Rate)`;
  } else if (surfaceDiff < -1.5) {
    surfaceEdge = `${p2.name} (+${Math.abs(surfaceDiff).toFixed(1)}% ${surface.toUpperCase()} Win Rate)`;
  }

  // 2. Recent Form Edge
  const recentDiff = p1RecentWinPct - p2RecentWinPct;
  let recentFormEdge = `Even recent form (${Math.round(p1RecentWinPct)}% wins)`;
  if (recentDiff > 0) {
    recentFormEdge = `${p1.name} (${Math.round(p1RecentWinPct)}% vs ${Math.round(p2RecentWinPct)}% wins)`;
  } else if (recentDiff < 0) {
    recentFormEdge = `${p2.name} (${Math.round(p2RecentWinPct)}% vs ${Math.round(p1RecentWinPct)}% wins)`;
  }

  // 3. Historical Edge - Use tournament-weighted combined historical
  const combinedP1Hist = (p1HistWinPct * 0.6) + (p1TourneyWeightedWinPct * 0.4);
  const combinedP2Hist = (p2HistWinPct * 0.6) + (p2TourneyWeightedWinPct * 0.4);
  const histDiff = combinedP1Hist - combinedP2Hist;
  let historicalEdge = "Even historical performance";
  if (histDiff > 1.5) {
    historicalEdge = `${p1.name} (+${histDiff.toFixed(1)}% time-weighted historical win rate)`;
  } else if (histDiff < -1.5) {
    historicalEdge = `${p2.name} (+${Math.abs(histDiff).toFixed(1)}% time-weighted historical win rate)`;
  }

  // 4. H2H Edge - Include surface-specific
  let h2hEdge = `Even head-to-head record (${p1Wins}-${p2Wins})`;
  if (p1Wins > p2Wins) {
    const recentMsg = recentH2HWeight > 0.5 ? " (recent meetings weighted)" : "";
    h2hEdge = `${p1.name} leads H2H ${p1Wins}-${p2Wins}${recentMsg}`;
  } else if (p2Wins > p1Wins) {
    const recentMsg = recentH2HWeight > 0.5 ? " (recent meetings weighted)" : "";
    h2hEdge = `${p2.name} leads H2H ${p2Wins}-${p1Wins}${recentMsg}`;
  }

  // Add surface H2H edge if different from overall
  if (p1SurfaceWins > 0 || p2SurfaceWins > 0) {
    const surfH2HDiff = p1SurfaceH2HPct - (100 - p1SurfaceH2HPct);
    if (Math.abs(surfH2HDiff) > 5) {
      const surfWinner = surfH2HDiff > 0 ? p1.name : p2.name;
      h2hEdge += ` | ${surfWinner} leads on ${surface}`;
    }
  }

  // ── Advantages vs Risk Factors ──
  const p1Advantages = [];
  const p2Advantages = [];
  const riskFactors = [];

  // Elo rating advantage
  const p1Elo = isValid(p1.elo) ? Number(p1.elo) : 1700;
  const p2Elo = isValid(p2.elo) ? Number(p2.elo) : 1700;
  if (p1Elo > p2Elo + 30) {
    p1Advantages.push(`Higher overall Elo rating (${p1Elo} vs ${p2Elo})`);
  } else if (p2Elo > p1Elo + 30) {
    p2Advantages.push(`Higher overall Elo rating (${p2Elo} vs ${p1Elo})`);
  }

  // Surface suitability advantage
  if (p1SurfaceWinPct > p2SurfaceWinPct + 3) {
    p1Advantages.push(`Superior surface suitability on ${surface} (${p1SurfaceWinPct.toFixed(1)}% vs ${p2SurfaceWinPct.toFixed(1)}%)`);
  } else if (p2SurfaceWinPct > p1SurfaceWinPct + 3) {
    p2Advantages.push(`Superior surface suitability on ${surface} (${p2SurfaceWinPct.toFixed(1)}% vs ${p1SurfaceWinPct.toFixed(1)}%)`);
  }

  // H2H advantage
  if (p1Wins > p2Wins) {
    p1Advantages.push(`Leads direct head-to-head record (${p1Wins}-${p2Wins})`);
  } else if (p2Wins > p1Wins) {
    p2Advantages.push(`Leads direct head-to-head record (${p2Wins}-${p1Wins})`);
  }

  // Recent form
  if (p1RecentWinPct > p2RecentWinPct + 10) {
    p1Advantages.push(`Stronger recent form (${Math.round(p1RecentWinPct)}% wins vs ${Math.round(p2RecentWinPct)}%)`);
  } else if (p2RecentWinPct > p1RecentWinPct + 10) {
    p2Advantages.push(`Stronger recent form (${Math.round(p2RecentWinPct)}% wins vs ${Math.round(p1RecentWinPct)}%)`);
  }

  // Top opponent performance from historical (vs Top 10/20/50)
  if (p1TopPerf.top10 > p2TopPerf.top10 + 10) {
    p1Advantages.push(`Superior vs Top 10 historically (${p1TopPerf.top10.toFixed(0)}% vs ${p2TopPerf.top10.toFixed(0)}%)`);
  } else if (p2TopPerf.top10 > p1TopPerf.top10 + 10) {
    p2Advantages.push(`Superior vs Top 10 historically (${p2TopPerf.top10.toFixed(0)}% vs ${p1TopPerf.top10.toFixed(0)}%)`);
  }

  if (p1TopPerf.top20 > p2TopPerf.top20 + 10) {
    p1Advantages.push(`Better vs Top 20 (${p1TopPerf.top20.toFixed(0)}% vs ${p2TopPerf.top20.toFixed(0)}%)`);
  } else if (p2TopPerf.top20 > p1TopPerf.top20 + 10) {
    p2Advantages.push(`Better vs Top 20 (${p2TopPerf.top20.toFixed(0)}% vs ${p1TopPerf.top20.toFixed(0)}%)`);
  }

  // Inactivity risk factors
  if (p1Inactivity.inactive) {
    riskFactors.push(`${p1.name} has been inactive for ${p1Inactivity.days} days, risking lack of match sharpness (Inactivity Penalty Applied).`);
  }
  if (p2Inactivity.inactive) {
    riskFactors.push(`${p2.name} has been inactive for ${p2Inactivity.days} days, risking lack of match sharpness (Inactivity Penalty Applied).`);
  }

  // Underdog strength risk factors for the favorite
  const favAdvantages = p1Favors ? p1Advantages : p2Advantages;
  const undAdvantages = p1Favors ? p2Advantages : p1Advantages;

  undAdvantages.forEach(adv => {
    riskFactors.push(`Opponent edge in: ${adv}`);
  });

  // Ensure arrays have basic descriptions if empty
  if (favAdvantages.length === 0) {
    favAdvantages.push("Marginal statistical efficiency edge");
  }
  if (riskFactors.length === 0) {
    riskFactors.push("Potential drops in consistency under high baseline pressure");
  }

  // ── AI Reasoning & Key Battle ──
  const fav = p1Favors ? p1 : p2;
  const und = p1Favors ? p2 : p1;
  const favElo = p1Favors ? p1Elo : p2Elo;
  const undElo = p1Favors ? p2Elo : p1Elo;

  let reasoning = `${fav.name} is predicted to win, backed by a composited score edge (Elo ${favElo} vs ${undElo}). `;
  if (p1Favors ? (p1RecentWinPct > p2RecentWinPct) : (p2RecentWinPct > p1RecentWinPct)) {
    reasoning += `Their superior recent match record provides a strong momentum buffer. `;
  }
  if (p1Favors ? (p1SurfaceWinPct > p2SurfaceWinPct) : (p2SurfaceWinPct > p1SurfaceWinPct)) {
    reasoning += `Furthermore, they hold an advantage in clay/hard/grass suitability on ${surface}. `;
  }
  reasoning += `Prediction confidence is rated as ${confidence} (${confidencePct}%) based on historical data matching quality.`;

  let keyBattle = `Baseline Consistency: A high-intensity tactical battle where ${fav.name}'s overall Elo (${favElo}) clashes with ${und.name}'s baseline counter-punching (overall Elo ${undElo}).`;
  if (p1Wins > 0 || p2Wins > 0) {
    keyBattle = `Direct Clash: Head-to-head familiarity is key here, as ${fav.name} tries to extend their historical ${p1Favors ? p1Wins + "-" + p2Wins : p2Wins + "-" + p1Wins} rivalry lead.`;
  }

  // Ensure winner is never undefined - derive from favorite (the predicted winner)
  const resolvedWinner = favorite || p1.name || "Unknown";
  const resolvedFavorite = favorite || p1.name || "Unknown";

  return {
    winner: resolvedWinner,
    favorite: resolvedFavorite,
    winProbability,
    confidence,
    confidencePct,
    advantages: favAdvantages,
    riskFactors,
    reasoning,
    keyBattle,
    edges: {
      surfaceEdge,
      recentFormEdge,
      historicalEdge,
      h2hEdge
    }
  };
}

module.exports = {
  predictMatch
};
