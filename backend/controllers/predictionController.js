const predictionService = require("../services/predictionService");
const profileService   = require("../services/profileService");
const { predictMatch } = require("../services/predictionEngine");

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
 * Full weighted-engine prediction between two players.
 */
const getPrediction = async (req, res) => {
  try {
    const { playerA: idA, playerB: idB, surface } = req.query;

    if (!idA || !idB) {
      return res.status(400).json({
        error: "Both playerA and playerB query params are required."
      });
    }

    // Fetch all data for both players in parallel
    const [profileA, formA, surfacesA, trendsA, profileB, formB, surfacesB, trendsB] =
      await Promise.all([
        profileService.getPlayerProfile(idA),
        profileService.getPlayerForm(idA),
        profileService.getSurfaceStats(idA),
        profileService.getTrendStats(idA),
        profileService.getPlayerProfile(idB),
        profileService.getPlayerForm(idB),
        profileService.getSurfaceStats(idB),
        profileService.getTrendStats(idB)
      ]);

    if (!profileA || !profileB) {
      return res.status(404).json({
        error: "One or both players could not be found.",
        playerA: idA,
        playerB: idB
      });
    }

    const result = predictMatch(
      { profile: profileA, form: formA, surfaces: surfacesA, trends: trendsA, h2h: null },
      { profile: profileB, form: formB, surfaces: surfacesB, trends: trendsB, h2h: null },
      surface || "hard"
    );

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
