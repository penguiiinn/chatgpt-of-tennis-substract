/**
 * Tennis Profile Intelligence Layer
 * Converts raw Tennis Abstract player stats into human-readable insights.
 */

const generatePlayerInsights = (profile) => {
  if (!profile || !profile.overview || !profile.surfaces) {
    return {
      strengths: [],
      weaknesses: [],
      playStyle: [],
      surfaceInsights: [],
      recentFormInsights: [],
      matchupFlags: []
    };
  }

  const { overview, surfaces, serve, returnAnalytics } = profile;
  
  const strengths = [];
  const weaknesses = [];
  const playStyle = [];
  const surfaceInsights = [];
  const recentFormInsights = [];
  const matchupFlags = [];

  // 1. Serve Rules
  const holdPct = profile.strengthMeter ? profile.strengthMeter.serve : 75;
  const acesPct = (serve && serve.acesPct) ? serve.acesPct.value : 0;
  const doubleFaultsPct = (serve && serve.doubleFaultsPct) ? serve.doubleFaultsPct.value : 0;

  if (holdPct > 85) {
    strengths.push(`Elite Server: Holds service games ${holdPct}% of the time, well above tour average.`);
  }
  if (acesPct > 10) {
    strengths.push(`Aggressive Serve Weapon: Generates free points easily with an ace rate of ${acesPct}%.`);
    playStyle.push("Big Server / Aggressive Serve-Oriented");
  }
  if (doubleFaultsPct > 5) {
    weaknesses.push(`Inconsistent Under Pressure: Commits double faults on ${doubleFaultsPct}% of service points, indicating second serve vulnerability.`);
  }

  // 2. Return Rules
  const breakPct = (returnAnalytics && returnAnalytics.returnGamesWon) ? returnAnalytics.returnGamesWon.value : 20;

  if (breakPct > 25) {
    strengths.push(`Elite Returner: Breaks opponent serve ${breakPct}% of the time, placing constant pressure on opponents.`);
    if (breakPct > 28) {
      playStyle.push("Counterpuncher / Return Specialist");
    }
  } else if (breakPct < 18) {
    weaknesses.push(`Weak Returner: Struggles to break serve, winning only ${breakPct}% of return games.`);
  }

  // 3. Play Style Default fallback
  if (playStyle.length === 0) {
    if (holdPct > 80 && breakPct > 23) {
      playStyle.push("All-Court Player / Highly Balanced");
    } else {
      playStyle.push("Baseline Aggressor");
    }
  }

  // 4. Surface Rules (clay, grass, hard, indoor)
  let bestSurface = "";
  let worstSurface = "";
  let maxWinPct = -1;
  let minWinPct = 101;

  const surfaceKeys = ["hard", "clay", "grass", "indoor"];
  const surfaceLabels = {
    hard: "Hard Court",
    clay: "Clay Court",
    grass: "Grass Court",
    indoor: "Indoor Court"
  };

  surfaceKeys.forEach(sKey => {
    if (surfaces[sKey]) {
      const winPct = surfaces[sKey].winPct;
      if (winPct > maxWinPct) {
        maxWinPct = winPct;
        bestSurface = sKey;
      }
      if (winPct < minWinPct && winPct > 0) {
        minWinPct = winPct;
        worstSurface = sKey;
      }
    }
  });

  if (bestSurface) {
    surfaceInsights.push(`Strongest surface is ${surfaceLabels[bestSurface]} with a ${maxWinPct}% career win rate.`);
  }
  if (worstSurface && worstSurface !== bestSurface) {
    surfaceInsights.push(`Weakest surface is ${surfaceLabels[worstSurface]} where career win rate drops to ${minWinPct}%.`);
    if (minWinPct < 55) {
      matchupFlags.push(`Vulnerable on ${surfaceLabels[worstSurface]}`);
    }
  }

  // 5. Form Rules (streak insights from last 10 matches)
  const recentForm = overview.recentForm || [];
  if (recentForm.length > 0) {
    const winsCount = recentForm.filter(r => r === "W").length;
    recentFormInsights.push(`Won ${winsCount} of the last 10 matches (${winsCount * 10}% form index).`);

    // Detect winning/losing streak
    let streakCount = 0;
    const streakType = recentForm[0]; // 'W' or 'L'
    for (let i = 0; i < recentForm.length; i++) {
      if (recentForm[i] === streakType) {
        streakCount++;
      } else {
        break;
      }
    }
    
    if (streakCount > 0) {
      recentFormInsights.push(`Currently on a ${streakCount}-match ${streakType === "W" ? "winning" : "losing"} streak.`);
      if (streakType === "W" && streakCount >= 3) {
        matchupFlags.push(`Form Indicator: Hot Streak (${streakCount} consecutive wins)`);
      }
    }
  }

  // 6. Ranking Rules (Current vs Peak)
  const currentRank = overview.currentRank;
  const peakRank = overview.peakRank;
  
  if (currentRank && peakRank) {
    if (currentRank === peakRank) {
      recentFormInsights.push(`Currently playing at a career-high ranking of #${currentRank}!`);
    } else {
      const diff = currentRank - peakRank;
      recentFormInsights.push(`Currently ranked #${currentRank}, aiming to return to peak rank of #${peakRank} (difference of ${diff} spots).`);
    }
  }

  // 7. Tiebreak Clutch Rules (>60% = clutch player)
  const tiebreakPct = overview.tiebreakPct || 50;
  if (tiebreakPct > 60) {
    strengths.push(`Clutch Player: Wins ${tiebreakPct}% of tiebreaks, showing strong mental composure in close sets.`);
    matchupFlags.push("Elite clutch performer in tiebreaks");
  } else if (tiebreakPct < 45) {
    weaknesses.push(`Struggles in Tight Sets: Wins only ${tiebreakPct}% of tiebreaks.`);
  }

  // 8. Opponent Quality (>50% winrate vs Top 10 = Strong vs top players)
  const top10WinPct = overview.top10WinPct || 0;
  if (top10WinPct > 50) {
    strengths.push(`Giant Killer: Possesses a strong win rate of ${top10WinPct}% against Top 10 players, showing the ability to compete at the absolute highest level.`);
    matchupFlags.push("Dangerous underdog against top-ranked players");
  } else if (top10WinPct > 0 && top10WinPct < 30) {
    weaknesses.push(`Top-Tier Barrier: Wins only ${top10WinPct}% against Top 10 opponents, indicating a performance gap against elite competition.`);
  }

  // Miscellaneous Matchup Flags
  if (overview.age > 34) {
    matchupFlags.push("Veteran Experience");
  } else if (overview.age > 0 && overview.age < 21) {
    matchupFlags.push("Rising Young Talent");
  }

  return {
    strengths,
    weaknesses,
    playStyle,
    surfaceInsights,
    recentFormInsights,
    matchupFlags
  };
};

module.exports = {
  generatePlayerInsights
};
