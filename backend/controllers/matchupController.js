const aiPredictorService = require("../services/aiPredictorService");

const getMatchup = async (req, res) => {
  try {
    const { player1, player2 } = req.params;
    const { surface } = req.query;

    if (!player1 || !player2) {
      return res.status(400).json({ error: "Both player1 and player2 parameters are required." });
    }

    console.log(`[matchupController] Computing AI Prediction for: ${player1} vs ${player2} on ${surface || "hard"}`);
    const result = await aiPredictorService.predictMatch(player1, player2, surface || "hard");
    res.json(result);
  } catch (error) {
    console.error("[matchupController] Error predicting matchup:", error);
    res.status(500).json({ error: "Failed to generate matchup intelligence.", message: error.message });
  }
};

module.exports = {
  getMatchup
};

