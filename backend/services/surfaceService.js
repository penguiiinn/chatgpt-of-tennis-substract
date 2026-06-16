const { getPlayerProfile } = require("./playerService");

const getSurfaceIntelligence = async (playerName) => {
  const profile = await getPlayerProfile(playerName);
  if (!profile) return null;
  
  return {
    playerName: profile.overview.name,
    bestSurface: profile.bestSurface,
    surfaces: profile.surfaces
  };
};

module.exports = {
  getSurfaceIntelligence
};
