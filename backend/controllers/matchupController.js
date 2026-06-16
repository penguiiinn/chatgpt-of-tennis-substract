const playerService = require("../services/playerService");
const { analyzeMatchup } = require("../utils/matchupEngine");

const getMatchup = async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const { surface } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({ error: "Both player1 and player2 parameters are required." });
    }

    const p1Profile = await playerService.getPlayerProfile(player1);
    if (!p1Profile) {
      return res.status(404).json({ error: `Player profile not found for: ${player1}` });
    }

    const p2Profile = await playerService.getPlayerProfile(player2);
    if (!p2Profile) {
      return res.status(404).json({ error: `Player profile not found for: ${player2}` });
    }

    const result = analyzeMatchup(p1Profile, p2Profile, surface || "hard");
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate matchup intelligence.", message: error.message });
  }
};

module.exports = {
  getMatchup
};
