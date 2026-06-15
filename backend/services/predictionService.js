const { getPlayerProfile } = require("./playerService");

const getPlayerPredictions = (playerName) => {
  const profile = getPlayerProfile(playerName);
  if (!profile) return null;
  return profile.predictions;
};

const getMatchPrediction = (playerName, opponentName) => {
  const profile = getPlayerProfile(playerName);
  if (!profile) return null;
  
  // Try to find predefined prediction
  const pred = profile.predictions[opponentName];
  if (pred) {
    return {
      player: profile.overview.name,
      opponent: opponentName,
      winChance: pred.winChance,
      confidence: pred.confidence,
      surface: pred.surface,
      reasoning: pred.reasoning
    };
  }
  
  // If no predefined prediction, calculate dynamically based on Elo!
  const opponentProfile = getPlayerProfile(opponentName);
  const oppName = opponentProfile ? opponentProfile.overview.name : opponentName;
  const oppElo = opponentProfile ? opponentProfile.overview.elo : 1800; // default opponent Elo if not found
  
  const eloDiff = profile.overview.elo - oppElo;
  const winChance = Math.round((1 / (1 + Math.pow(10, -eloDiff / 400))) * 100);
  
  let confidence = "Medium";
  if (Math.abs(eloDiff) > 250) confidence = "High";
  if (Math.abs(eloDiff) < 80) confidence = "Low";
  
  return {
    player: profile.overview.name,
    opponent: oppName,
    winChance: winChance,
    confidence: confidence,
    surface: profile.bestSurface,
    reasoning: `Hypothetical match prediction. Based on Elo ratings (${profile.overview.elo} vs ${oppElo}), ${profile.overview.name} has a ${winChance}% projected win chance. ${profile.overview.name}'s strong serve and return consistency makes them the favourite on ${profile.bestSurface} courts.`
  };
};

module.exports = {
  getPlayerPredictions,
  getMatchPrediction
};
