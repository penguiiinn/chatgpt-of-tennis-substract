const { getPlayerProfile } = require("./playerService");

// Seeded random helper for deterministic mock data
function createSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = (h + 0x9e3779b9) | 0;
    let z = h;
    z ^= z >>> 16;
    z = Math.imul(z, 0x21f0aa7c);
    z ^= z >>> 15;
    z = Math.imul(z, 0x735a2d97);
    z ^= z >>> 15;
    return (z >>> 0) / 4294967296;
  };
}

const getRecentMatches = (playerName) => {
  const profile = getPlayerProfile(playerName);
  if (!profile) return null;
  return profile.recentMatches;
};

const getMatchDetails = (playerName, matchIndex) => {
  const profile = getPlayerProfile(playerName);
  if (!profile) return null;
  
  const mIndex = parseInt(matchIndex);
  if (isNaN(mIndex) || mIndex < 0 || mIndex >= profile.recentMatches.length) {
    return null;
  }
  
  const m = profile.recentMatches[mIndex];
  const seed = profile.overview.name + m.opponent + m.date;
  const rng = createSeededRandom(seed);

  const pServe = profile.strengthMeter.serve;
  const pReturn = profile.strengthMeter.return;
  const isWin = m.result === "win";

  // Seeded random opponent rating
  const oppServe = Math.floor(rng() * 15) + 75;
  const oppReturn = Math.floor(rng() * 15) + 75;

  // Aces
  const pAces = Math.round((pServe / 10) * (rng() * 0.8 + 0.6) + (m.surface === "Grass" ? 3 : 0));
  const oAces = Math.round((oppServe / 10) * (rng() * 0.8 + 0.6) + (m.surface === "Grass" ? 3 : 0));

  // Double faults
  const pDF = Math.floor(rng() * 3) + 1;
  const oDF = Math.floor(rng() * 3) + 1;

  // 1st serve %
  const pFirstPct = Math.round(55 + rng() * 15);
  const oFirstPct = Math.round(55 + rng() * 15);

  // 1st serve won %
  const pFirstWon = Math.round(isWin ? (68 + rng() * 12) : (58 + rng() * 10));
  const oFirstWon = Math.round(isWin ? (58 + rng() * 10) : (68 + rng() * 12));

  // 2nd serve won %
  const pSecondWon = Math.round(isWin ? (48 + rng() * 12) : (38 + rng() * 10));
  const oSecondWon = Math.round(isWin ? (38 + rng() * 10) : (48 + rng() * 12));

  // Break Points Won / Faced
  const pBPOpp = Math.floor(rng() * 6) + (isWin ? 3 : 1);
  const pBPConv = Math.floor(isWin ? (pBPOpp * (0.4 + rng() * 0.4)) : (pBPOpp * (0.1 + rng() * 0.3)));

  const oBPOpp = Math.floor(rng() * 6) + (isWin ? 1 : 3);
  const oBPConv = Math.floor(isWin ? (oBPOpp * (0.1 + rng() * 0.3)) : (oBPOpp * (0.4 + rng() * 0.4)));

  // Winners / UEs
  const pWinners = Math.round((pServe / 3.2) * (rng() * 0.6 + 0.7));
  const oWinners = Math.round((oppServe / 3.2) * (rng() * 0.6 + 0.7));
  const pUE = Math.round(14 + rng() * 14 - (isWin ? 3 : 0));
  const oUE = Math.round(14 + rng() * 14 - (isWin ? 0 : 3));

  // AI Recap wording
  let recapText = "";
  if (isWin) {
    if (pAces > 6 || pFirstWon > 74) {
      recapText = `A dominant serving display from ${profile.overview.name}. Winning ${pFirstWon}% of points on her first serve and firing ${pAces} aces allowed her to control the match tempo. ${m.opponent} struggled to establish rhythm on return, faced ${pBPOpp} break points, and was eventually worn down by the continuous service pressure.`;
    } else if (pReturn > 80 || pBPConv > 2) {
      recapText = `Excellent returning and baseline depth from ${profile.overview.name}. Breaking ${m.opponent} ${pBPConv} times, she seized control of rallies early by exploiting second serves. Her baseline consistency kept ${m.opponent} pinned and forced a high error count.`;
    } else {
      recapText = `A gritty, mentally resilient performance from ${profile.overview.name}. Despite some unforced errors, she stepped up her intensity on critical points, saving ${oBPOpp - oBPConv} of the ${oBPOpp} break points faced and capitalizing on rare counter-attacking opportunities.`;
    }
  } else {
    if (oFirstWon > 74 || oAces > 6) {
      recapText = `${profile.overview.name} struggled to make an impact on ${m.opponent}'s serve, which operated at a very high level. ${m.opponent} won ${oFirstWon}% of first-serve points, limiting break back opportunities. The quick court conditions heavily favored the aggressive serve placement.`;
    } else {
      recapText = `A close, point-by-point battle decided by unforced errors at crucial margins. ${profile.overview.name} showed moments of brilliance but was held back by ${pUE} unforced errors. ${m.opponent} displayed stronger rally tolerance from the back of the court to secure the win.`;
    }
  }

  return {
    player: profile.overview.name,
    opponent: m.opponent,
    result: m.result,
    score: m.score,
    tournament: m.tournament,
    surface: m.surface,
    date: m.date,
    stats: {
      player: {
        aces: pAces,
        doubleFaults: pDF,
        firstServeInPct: pFirstPct,
        firstServeWonPct: pFirstWon,
        secondServeWonPct: pSecondWon,
        breakPointsConverted: pBPConv,
        breakPointsFaced: pBPOpp,
        winners: pWinners,
        unforcedErrors: pUE
      },
      opponent: {
        aces: oAces,
        doubleFaults: oDF,
        firstServeInPct: oFirstPct,
        firstServeWonPct: oFirstWon,
        secondServeWonPct: oSecondWon,
        breakPointsConverted: oBPConv,
        breakPointsFaced: oBPOpp,
        winners: oWinners,
        unforcedErrors: oUE
      }
    },
    aiRecap: recapText
  };
};

module.exports = {
  getRecentMatches,
  getMatchDetails
};
