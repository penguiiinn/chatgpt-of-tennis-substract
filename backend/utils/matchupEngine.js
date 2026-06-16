const { H2H_MEETINGS, PLAYERS_DB } = require("../data/db");

function getMatchupKey(a, b) {
  const sorted = [a, b].sort();
  return sorted.join("___");
}

function getOpponentQuality(p) {
  if (p.overview && typeof p.overview.top10WinPct === "number") {
    return p.overview.top10WinPct;
  }
  // Fallback for static players based on rank
  const name = p.overview?.name;
  if (name && PLAYERS_DB[name]) {
    const staticRank = PLAYERS_DB[name].rank;
    if (staticRank <= 3) return 65;
    if (staticRank <= 10) return 55;
    if (staticRank <= 25) return 45;
    return 35;
  }
  const rank = p.overview?.currentRank || 100;
  if (rank <= 3) return 65;
  if (rank <= 10) return 55;
  if (rank <= 25) return 45;
  return 35;
}

function analyzeMatchup(p1, p2, targetSurface = "hard") {
  const surface = (targetSurface || "hard").toLowerCase();
  
  // Extract clean stats for comparison
  const p1Name = p1.overview?.name || "Player 1";
  const p1Static = PLAYERS_DB[p1Name];
  const p1Stats = {
    name: p1Name,
    elo: p1.overview?.elo || p1Static?.stats?.elo || 1500,
    surfaceElo: p1.surfaces?.[surface]?.elo || p1.overview?.elo || p1Static?.stats?.elo || 1500,
    holdPct: p1.strengthMeter?.serve || p1.surfaces?.[surface]?.holdPct || p1Static?.stats?.serve || 75,
    breakPct: p1.returnAnalytics?.returnGamesWon?.value || p1.surfaces?.[surface]?.breakPct || p1Static?.stats?.breakPt || (p1.strengthMeter?.return ? Math.round(p1.strengthMeter.return / 2) : 20),
    firstServePct: p1.serve?.firstServePct?.value || p1Static?.h2h?.stats?.["1st Serve %"]?.p1 || 60,
    returnPointsWonPct: p1.returnAnalytics?.returnPointsWon?.value || p1Static?.h2h?.stats?.["Break Points Won"]?.p1 || 40,
    tiebreakPct: p1.overview?.tiebreakPct || p1Static?.stats?.tiebreak || p1.stats?.tiebreak || 50,
    recentFormWins: Array.isArray(p1.overview?.recentForm)
      ? p1.overview.recentForm.filter(f => f === "W").length
      : 5,
    opponentQuality: getOpponentQuality(p1),
    h2hWins: 0
  };

  const p2Name = p2.overview?.name || "Player 2";
  const p2Static = PLAYERS_DB[p2Name];
  const p2Stats = {
    name: p2Name,
    elo: p2.overview?.elo || p2Static?.stats?.elo || 1500,
    surfaceElo: p2.surfaces?.[surface]?.elo || p2.overview?.elo || p2Static?.stats?.elo || 1500,
    holdPct: p2.strengthMeter?.serve || p2.surfaces?.[surface]?.holdPct || p2Static?.stats?.serve || 75,
    breakPct: p2.returnAnalytics?.returnGamesWon?.value || p2.surfaces?.[surface]?.breakPct || p2Static?.stats?.breakPt || (p2.strengthMeter?.return ? Math.round(p2.strengthMeter.return / 2) : 20),
    firstServePct: p2.serve?.firstServePct?.value || p2Static?.h2h?.stats?.["1st Serve %"]?.p1 || 60,
    returnPointsWonPct: p2.returnAnalytics?.returnPointsWon?.value || p2Static?.h2h?.stats?.["Break Points Won"]?.p1 || 40,
    tiebreakPct: p2.overview?.tiebreakPct || p2Static?.stats?.tiebreak || p2.stats?.tiebreak || 50,
    recentFormWins: Array.isArray(p2.overview?.recentForm)
      ? p2.overview.recentForm.filter(f => f === "W").length
      : 5,
    opponentQuality: getOpponentQuality(p2),
    h2hWins: 0
  };

  // 1. Head-to-Head lookup
  const matchupKey = getMatchupKey(p1Stats.name, p2Stats.name);
  const meetings = H2H_MEETINGS[matchupKey];
  if (meetings && meetings.record) {
    const namesSorted = [p1Stats.name, p2Stats.name].sort();
    if (p1Stats.name === namesSorted[0]) {
      p1Stats.h2hWins = meetings.record.a;
      p2Stats.h2hWins = meetings.record.b;
    } else {
      p1Stats.h2hWins = meetings.record.b;
      p2Stats.h2hWins = meetings.record.a;
    }
  }

  // Check recent matches for dynamic H2H elements
  const scanRecentMatches = (player, opponentName) => {
    let wins = 0;
    let losses = 0;
    if (Array.isArray(player.recentMatches)) {
      player.recentMatches.forEach(m => {
        if (m.opponent && m.opponent.toLowerCase().includes(opponentName.toLowerCase())) {
          if (m.result === "win") wins++;
          else if (m.result === "loss") losses++;
        }
      });
    }
    return { wins, losses };
  };

  const scan1 = scanRecentMatches(p1, p2Stats.name);
  const scan2 = scanRecentMatches(p2, p1Stats.name);

  const dynamicP1Wins = Math.max(scan1.wins, scan2.losses);
  const dynamicP2Wins = Math.max(scan1.losses, scan2.wins);

  if (dynamicP1Wins > 0 || dynamicP2Wins > 0) {
    p1Stats.h2hWins = Math.max(p1Stats.h2hWins, dynamicP1Wins);
    p2Stats.h2hWins = Math.max(p2Stats.h2hWins, dynamicP2Wins);
  }

  // 2. Win Probability calculation
  const eloDiff = p1Stats.elo - p2Stats.elo;
  let winProb = (1 / (1 + Math.pow(10, -eloDiff / 400))) * 100;

  // Adjustments
  // - Surface Elo difference (+/- up to 8%)
  const surfaceEloDiff = p1Stats.surfaceElo - p2Stats.surfaceElo;
  winProb += (surfaceEloDiff / 400) * 10;

  // - Recent form difference (+/- up to 5%)
  const formDiff = p1Stats.recentFormWins - p2Stats.recentFormWins;
  winProb += formDiff * 1.0;

  // - H2H factor (+/- up to 5%)
  const h2hDiff = p1Stats.h2hWins - p2Stats.h2hWins;
  if (h2hDiff !== 0) {
    winProb += Math.min(Math.max(h2hDiff * 1.5, -5), 5);
  }

  // Bounds check (5% to 95%)
  winProb = Math.min(Math.max(Math.round(winProb), 5), 95);

  const p1Favors = winProb >= 50;
  const favorite = p1Favors ? p1Stats.name : p2Stats.name;
  const winProbability = p1Favors ? winProb : 100 - winProb;

  // Confidence Level
  let confidence = "Medium";
  if (winProbability > 62) {
    confidence = "High";
  } else if (winProbability < 54) {
    confidence = "Low";
  }

  // Collect Advantages & Risk Factors from comparisons
  const p1Advantages = [];
  const p2Advantages = [];

  // Elo comparison
  if (p1Stats.elo > p2Stats.elo + 30) {
    p1Advantages.push(`Higher overall Elo rating (${p1Stats.elo} vs ${p2Stats.elo})`);
  } else if (p2Stats.elo > p1Stats.elo + 30) {
    p2Advantages.push(`Higher overall Elo rating (${p2Stats.elo} vs ${p1Stats.elo})`);
  }

  // Surface Elo comparison
  if (p1Stats.surfaceElo > p2Stats.surfaceElo + 30) {
    p1Advantages.push(`Superior surface-specific Elo on ${surface} (${p1Stats.surfaceElo} vs ${p2Stats.surfaceElo})`);
  } else if (p2Stats.surfaceElo > p1Stats.surfaceElo + 30) {
    p2Advantages.push(`Superior surface-specific Elo on ${surface} (${p2Stats.surfaceElo} vs ${p1Stats.surfaceElo})`);
  }

  // Hold %
  if (p1Stats.holdPct > p2Stats.holdPct + 2) {
    p1Advantages.push(`Stronger serve hold rate (${p1Stats.holdPct}% vs ${p2Stats.holdPct}%)`);
  } else if (p2Stats.holdPct > p1Stats.holdPct + 2) {
    p2Advantages.push(`Stronger serve hold rate (${p2Stats.holdPct}% vs ${p1Stats.holdPct}%)`);
  }

  // Break %
  if (p1Stats.breakPct > p2Stats.breakPct + 2) {
    p1Advantages.push(`Superior return break rate (${p1Stats.breakPct}% vs ${p2Stats.breakPct}%)`);
  } else if (p2Stats.breakPct > p1Stats.breakPct + 2) {
    p2Advantages.push(`Superior return break rate (${p2Stats.breakPct}% vs ${p1Stats.breakPct}%)`);
  }

  // First serve %
  if (p1Stats.firstServePct > p2Stats.firstServePct + 2) {
    p1Advantages.push(`Higher first serve accuracy (${p1Stats.firstServePct}% vs ${p2Stats.firstServePct}%)`);
  } else if (p2Stats.firstServePct > p1Stats.firstServePct + 2) {
    p2Advantages.push(`Higher first serve accuracy (${p2Stats.firstServePct}% vs ${p1Stats.firstServePct}%)`);
  }

  // Return points won %
  if (p1Stats.returnPointsWonPct > p2Stats.returnPointsWonPct + 1) {
    p1Advantages.push(`Greater efficiency in return points won (${p1Stats.returnPointsWonPct}% vs ${p2Stats.returnPointsWonPct}%)`);
  } else if (p2Stats.returnPointsWonPct > p1Stats.returnPointsWonPct + 1) {
    p2Advantages.push(`Greater efficiency in return points won (${p2Stats.returnPointsWonPct}% vs ${p1Stats.returnPointsWonPct}%)`);
  }

  // Tiebreak %
  if (p1Stats.tiebreakPct > p2Stats.tiebreakPct + 3) {
    p1Advantages.push(`Superior tiebreak efficiency (${p1Stats.tiebreakPct}% vs ${p2Stats.tiebreakPct}%)`);
  } else if (p2Stats.tiebreakPct > p1Stats.tiebreakPct + 3) {
    p2Advantages.push(`Superior tiebreak efficiency (${p2Stats.tiebreakPct}% vs ${p1Stats.tiebreakPct}%)`);
  }

  // Recent Form
  if (p1Stats.recentFormWins > p2Stats.recentFormWins) {
    p1Advantages.push(`Stronger recent form (${p1Stats.recentFormWins}/10 wins vs ${p2Stats.recentFormWins}/10)`);
  } else if (p2Stats.recentFormWins > p1Stats.recentFormWins) {
    p2Advantages.push(`Stronger recent form (${p2Stats.recentFormWins}/10 wins vs ${p1Stats.recentFormWins}/10)`);
  }

  // H2H
  if (p1Stats.h2hWins > p2Stats.h2hWins) {
    p1Advantages.push(`Leads historical head-to-head matchups (${p1Stats.h2hWins}-${p2Stats.h2hWins})`);
  } else if (p2Stats.h2hWins > p1Stats.h2hWins) {
    p2Advantages.push(`Leads historical head-to-head matchups (${p2Stats.h2hWins}-${p1Stats.h2hWins})`);
  }

  // Opponent quality
  if (p1Stats.opponentQuality > p2Stats.opponentQuality + 3) {
    p1Advantages.push(`Higher success rate against top-10 opponents (${p1Stats.opponentQuality}% vs ${p2Stats.opponentQuality}%)`);
  } else if (p2Stats.opponentQuality > p1Stats.opponentQuality + 3) {
    p2Advantages.push(`Higher success rate against top-10 opponents (${p2Stats.opponentQuality}% vs ${p1Stats.opponentQuality}%)`);
  }

  const favAdvantages = p1Favors ? p1Advantages : p2Advantages;
  const underdogAdvantages = p1Favors ? p2Advantages : p1Advantages;

  // Risk Factors for the favorite are the underdog's strengths/advantages,
  // or areas where the favorite is statistically weaker
  const riskFactors = [];
  if (underdogAdvantages.length > 0) {
    underdogAdvantages.forEach(adv => {
      // Rephrase slightly as a threat
      riskFactors.push(`Opponent holds advantage in: ${adv}`);
    });
  }

  // Add standard risk factors if arrays are sparse
  const favoriteStats = p1Favors ? p1Stats : p2Stats;
  const underdogStats = p1Favors ? p2Stats : p1Stats;

  if (favoriteStats.tiebreakPct < 52) {
    riskFactors.push(`${favoriteStats.name}'s below-average tiebreak percentage (${favoriteStats.tiebreakPct}%) could be costly in close sets.`);
  }
  if (favoriteStats.recentFormWins < 6) {
    riskFactors.push(`Favorite shows signs of vulnerability in recent form (${favoriteStats.recentFormWins}/10 wins).`);
  }
  if (underdogStats.h2hWins > 0 && underdogStats.h2hWins >= favoriteStats.h2hWins) {
    riskFactors.push(`Underdog has demonstrated competitive capability in H2H with ${underdogStats.h2hWins} wins.`);
  }

  // If no advantages were generated, add a basic one
  if (favAdvantages.length === 0) {
    favAdvantages.push(`Slight statistical edge in baseline efficiency`);
  }
  if (riskFactors.length === 0) {
    riskFactors.push(`Potential drop in consistency under sustained baseline pressure`);
  }

  // Generate Reasoning Text
  let reasoning = "";
  if (winProbability >= 65) {
    reasoning = `${favorite} is the clear favorite in this matchup, driven by an Elo rating advantage (${favoriteStats.elo} vs ${underdogStats.elo}) and overall consistency. Key stats like hold rate (${favoriteStats.holdPct}% vs ${underdogStats.holdPct}%) and superior performance against top-tier opponents position them well to control the matches.`;
  } else if (winProbability >= 55) {
    reasoning = `${favorite} holds a moderate advantage, largely due to recent form and surface suitability. However, with an Elo difference of only ${Math.abs(eloDiff)} points, the margin remains thin, and ${underdogStats.name} remains highly competitive.`;
  } else {
    reasoning = `This is a highly balanced, pick'em matchup. ${favorite} is marginally favored, but the small statistical difference suggests a high-intensity match that could go either way. Key points and clutch serving will decide the outcome.`;
  }

  // Generate Key Battle
  let keyBattle = "";
  const favServeUnderdogReturn = favoriteStats.holdPct - underdogStats.returnPointsWonPct;
  const underdogServeFavReturn = underdogStats.holdPct - favoriteStats.returnPointsWonPct;
  
  if (Math.abs(favServeUnderdogReturn - underdogServeFavReturn) > 5) {
    keyBattle = `Serve vs Return: ${favorite}'s serve capability (hold% of ${favoriteStats.holdPct}%) will go head-to-head with ${underdogStats.name}'s defensive returning (winning ${underdogStats.returnPointsWonPct}% of return points).`;
  } else if (Math.abs(favoriteStats.tiebreakPct - underdogStats.tiebreakPct) > 10) {
    keyBattle = `Clutch tiebreak situations: ${favoriteStats.name} (${favoriteStats.tiebreakPct}% tiebreaks won) vs ${underdogStats.name} (${underdogStats.tiebreakPct}% tiebreaks won) in critical pressure moments.`;
  } else {
    keyBattle = `Baseline Consistency: A grueling tactical rally battle where ${favorite}'s overall surface Elo (${favoriteStats.surfaceElo}) clashes with ${underdogStats.name}'s defensive baseline resistance (overall Elo ${underdogStats.elo}).`;
  }

  return {
    favorite,
    winProbability,
    confidence,
    advantages: favAdvantages,
    reasoning,
    riskFactors,
    keyBattle
  };
}

module.exports = {
  analyzeMatchup
};
