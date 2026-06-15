const predictionService = require("../services/predictionService");

const getPredictions = (req, res) => {
  try {
    const { name } = req.params;
    const predictions = predictionService.getPlayerPredictions(name);
    
    if (!predictions) {
      return res.status(404).json({ error: "Predictions not found for this player.", query: name });
    }
    
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve player predictions.", message: error.message });
  }
};

const getMatchPrediction = (req, res) => {
  try {
    const { name, opponent } = req.params;
    const prediction = predictionService.getMatchPrediction(name, opponent);
    
    if (!prediction) {
      return res.status(404).json({ error: "Failed to calculate prediction for this matchup.", query: name, opponent });
    }
    
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve match prediction.", message: error.message });
  }
};

module.exports = {
  getPredictions,
  getMatchPrediction
};
