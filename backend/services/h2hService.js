const { PROFILE_DB, H2H_MEETINGS, H2H_STYLE, H2H_MATCHUP } = require("../data/db");
const { resolvePlayerKey, getPlayerProfile } = require("./playerService");

function getMatchupKey(a, b) {
  const sorted = [a, b].sort();
  return sorted.join("___");
}

const getH2HComparison = async (p1, p2) => {
  const k1 = resolvePlayerKey(p1);
  const k2 = resolvePlayerKey(p2);
  
  if (!k1 || !k2) return null;
  if (k1 === k2) return { error: "Cannot compare a player to themselves." };
  
  const pa = await getPlayerProfile(k1);
  const pb = await getPlayerProfile(k2);
  
  if (!pa || !pb) return null;
  
  const matchupKey = getMatchupKey(k1, k2);
  
  let meetings = H2H_MEETINGS[matchupKey];
  let style = H2H_STYLE[matchupKey];
  let matchup = H2H_MATCHUP[matchupKey];
  
  // If no predefined matchup, compute dynamically using Elo and profiles!
  if (!matchup) {
    const eloA = pa.overview.elo;
    const eloB = pb.overview.elo;
    
    // Elo win probability formula
    const winProbA = Math.round((1 / (1 + Math.pow(10, -(eloA - eloB) / 400))) * 100);
    const winProbB = 100 - winProbA;
    
    // Generate dynamic strength bars based on player strength metrics
    const bars = [
      { label: "Serve Advantage", aVal: pa.strengthMeter.serve, bVal: pb.strengthMeter.serve },
      { label: "Return Advantage", aVal: pa.strengthMeter.return, bVal: pb.strengthMeter.return },
      { label: "Rally Tolerance", aVal: pa.strengthMeter.consistency, bVal: pb.strengthMeter.consistency },
      { label: "Clutch Points", aVal: pa.strengthMeter.pressurePoints, bVal: pb.strengthMeter.pressurePoints },
      { label: "Surface Suitability", aVal: pa.surfaces.hard.winPct, bVal: pb.surfaces.hard.winPct }
    ];
    
    matchup = {
      surface: "Hard",
      bars: bars,
      winProb: { a: winProbA, b: winProbB },
      confidence: "Medium",
      reasons: {
        a: [
          `Higher Elo rating (${eloA} vs ${eloB})`,
          `Stronger serve rating (${pa.strengthMeter.serve} vs ${pb.strengthMeter.serve})`
        ],
        b: [
          `Stronger return rating (${pb.strengthMeter.return} vs ${pa.strengthMeter.return})`,
          `Fewer unforced errors on average`
        ]
      },
      betting: {
        overUnder: "Over 2.5 sets — competitive index",
        tiebreakChance: "Medium (45%)",
        upsetProb: `${Math.min(winProbA, winProbB)}% chance of upset`,
        expectedSets: "3 sets",
        bestOdds: "Slight edge for player with higher Elo rating"
      },
      aiSummary: `This is a hypothetical match-up generated dynamically from Elo and strength profiles. ${pa.overview.name} (Elo ${eloA}) holds a ${winProbA}% win probability against ${pb.overview.name} (Elo ${eloB}). ${pa.overview.name} will rely on serve power to open up the court, while ${pb.overview.name} will counter with baseline consistency and defense.`
    };
    
    meetings = {
      record: { a: 0, b: 0 },
      meetings: [],
      note: "No historical meetings on record. Statistics calculated dynamically from Elo and player metrics."
    };
    
    style = {
      aStyle: (pa.aiInsights && pa.aiInsights.tags && pa.aiInsights.tags[0]) || "All-Court",
      bStyle: (pb.aiInsights && pb.aiInsights.tags && pb.aiInsights.tags[0]) || "Baseline",
      clashPoints: [
        { icon: "🎯", title: "Serve vs. Return", text: `${pa.overview.name}'s serve rating is ${pa.strengthMeter.serve} against ${pb.overview.name}'s return rating of ${pb.strengthMeter.return}.` },
        { icon: "🧠", title: "Mental Composure", text: `${pa.overview.name}'s pressure performance is ${pa.strengthMeter.pressurePoints} while ${pb.overview.name}'s is ${pb.strengthMeter.pressurePoints}.` }
      ]
    };
  }
  
  // Format consistent with h2h.js expectations
  return {
    player1: pa,
    player2: pb,
    matchupKey,
    meetings,
    style,
    matchup
  };
};

module.exports = {
  getH2HComparison
};
