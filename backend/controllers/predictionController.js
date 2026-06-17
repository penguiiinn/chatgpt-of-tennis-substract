const predictionService = require("../services/predictionService");
const profileService   = require("../services/profileService");
const { predictMatch: predictMatchEngine } = require("../services/predictionEngine");
const { predictMatch: predictMatchAI } = require("../services/aiPredictorService");

const getPredictions = async (req, res) => {
  try {
    const { name } = req.params;
    const predictions = await predictionService.getPlayerPredictions(name);

    if (!predictions) {
      return res.status(404).json({ error: "Predictions not found for this player.", query: name });
    }

    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve player predictions.", message: error.message });
  }
};

const getMatchPrediction = async (req, res) => {
  try {
    const { name, opponent } = req.params;
    const prediction = await predictionService.getMatchPrediction(name, opponent);

    if (!prediction) {
      return res.status(404).json({ error: "Failed to calculate prediction for this matchup.", query: name, opponent });
    }

    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve match prediction.", message: error.message });
  }
};

/**
 * GET /api/predictions/match?playerA=<id>&playerB=<id>&surface=<surface>
 * AI Match Predictor using weighted intelligence from multiple sources.
 */
const getPrediction = async (req, res) => {
  try {
    const { playerA: idA, playerB: idB, surface, tournament } = req.query;

    if (!idA || !idB) {
      return res.status(400).json({
        error: "Both playerA and playerB query params are required."
      });
    }

    // Use AI Match Predictor (enhanced engine with multi-source data)
    const result = await predictMatchAI(idA, idB, surface || "Hard Court", tournament || null);

    if (result && result.error) {
      return res.status(404).json({
        error: result.error,
        playerA: idA,
        playerB: idB
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "Prediction engine failed.",
      message: err.message
    });
  }
};

module.exports = {
  getPredictions,
  getMatchPrediction,
  getPrediction
};
