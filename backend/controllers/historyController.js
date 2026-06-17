const historicalStore = require("../history/historicalStore");

async function getPlayerHistory(req, res) {
  try {
    const { player } = req.params;
    const data = historicalStore.getPlayerMatches(player);
    if (!data) {
      return res.status(404).json({ error: `Historical matches not found for player: ${player}` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve player historical matches.", message: err.message });
  }
}

async function getPlayerSurfaces(req, res) {
  try {
    const { player } = req.params;
    const data = historicalStore.getPlayerSurfaceStats(player);
    if (!data) {
      return res.status(404).json({ error: `Historical surface stats not found for player: ${player}` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve player historical surface stats.", message: err.message });
  }
}

async function getPlayerRankings(req, res) {
  try {
    const { player } = req.params;
    const data = historicalStore.getPlayerRankingsHistory(player);
    if (!data) {
      return res.status(404).json({ error: `Historical rankings history not found for player: ${player}` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve player historical rankings history.", message: err.message });
  }
}

async function getPlayerH2H(req, res) {
  try {
    const { player, opponent } = req.params;
    const data = historicalStore.getPlayerH2H(player, opponent);
    if (!data) {
      return res.status(404).json({ error: `Historical H2H matches not found between ${player} and ${opponent}` });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve historical H2H details.", message: err.message });
  }
}

module.exports = {
  getPlayerHistory,
  getPlayerSurfaces,
  getPlayerRankings,
  getPlayerH2H
};
