const playerService = require("../services/playerService");

const getPlayers = (req, res) => {
  try {
    const isTrending = req.query.trending === "true";
    if (isTrending) {
      const trending = playerService.getTrendingPlayers();
      return res.json(trending);
    }
    
    const players = playerService.getAllPlayersList();
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve players list.", message: error.message });
  }
};

const getPlayerByName = (req, res) => {
  try {
    const { name } = req.params;
    const profile = playerService.getPlayerProfile(name);
    
    if (!profile) {
      return res.status(404).json({ error: "Player profile not found.", query: name });
    }
    
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve player profile.", message: error.message });
  }
};

module.exports = {
  getPlayers,
  getPlayerByName
};
