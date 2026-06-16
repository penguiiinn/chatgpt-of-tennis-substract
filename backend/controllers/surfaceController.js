const surfaceService = require("../services/surfaceService");

const getSurfaceData = async (req, res) => {
  try {
    const { name } = req.params;
    const surfaceData = await surfaceService.getSurfaceIntelligence(name);
    
    if (!surfaceData) {
      return res.status(404).json({ error: "Player surface data not found.", query: name });
    }
    
    res.json(surfaceData);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve surface data.", message: error.message });
  }
};

module.exports = {
  getSurfaceData
};
