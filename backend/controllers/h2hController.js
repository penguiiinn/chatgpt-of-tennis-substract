const h2hService = require("../services/h2hService");

const getComparison = (req, res) => {
  try {
    const { p1, p2 } = req.query;
    
    if (!p1 || !p2) {
      return res.status(400).json({ error: "Missing required query parameters: p1 and p2 must be provided." });
    }
    
    const comparison = h2hService.getH2HComparison(p1, p2);
    
    if (!comparison) {
      return res.status(404).json({ error: "One or both players could not be found.", p1, p2 });
    }
    
    if (comparison.error) {
      return res.status(400).json({ error: comparison.error });
    }
    
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: "Failed to compare players.", message: error.message });
  }
};

module.exports = {
  getComparison
};
