const { PROFILE_DB, TRENDING_PLAYERS } = require("../data/db");

function resolvePlayerKey(query) {
  if (!query) return null;
  const keys = Object.keys(PROFILE_DB);
  return keys.find(k => k.toLowerCase() === query.toLowerCase())
      || keys.find(k => k.toLowerCase().includes(query.toLowerCase()));
}

const getTrendingPlayers = () => {
  return TRENDING_PLAYERS;
};

const getAllPlayersList = () => {
  return Object.keys(PROFILE_DB).map(key => {
    const p = PROFILE_DB[key];
    return {
      name: p.overview.name,
      rank: p.overview.currentRank,
      nationality: p.overview.nationality,
      flag: p.overview.flag,
      handedness: p.overview.handedness,
      elo: p.overview.elo,
      bestSurface: p.bestSurface
    };
  });
};

const getPlayerProfile = (name) => {
  const key = resolvePlayerKey(name);
  if (!key) return null;
  return PROFILE_DB[key];
};

module.exports = {
  resolvePlayerKey,
  getTrendingPlayers,
  getAllPlayersList,
  getPlayerProfile
};
