const matchService = require("../services/matchService");

const getRecentMatches = async (req, res) => {
  try {
    const { name } = req.params;
    const matches = await matchService.getRecentMatches(name);
    
    if (!matches) {
      return res.status(404).json({ error: "Matches not found for this player.", query: name });
    }
    
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve recent matches.", message: error.message });
  }
};

const getMatchDetails = async (req, res) => {
  try {
    const { name, index } = req.params;
    const details = await matchService.getMatchDetails(name, index);
    
    if (!details) {
      return res.status(404).json({ error: "Match details not found.", query: name, index });
    }
    
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve match details.", message: error.message });
  }
};

module.exports = {
  getRecentMatches,
  getMatchDetails
};
