const express = require("express");
const router = express.Router();
const predictionController = require("../controllers/predictionController");

// Step 6: Prediction Engine — must be declared BEFORE /:name wildcard
// GET /api/predictions/match?playerA=<id>&playerB=<id>&surface=<surface>
router.get("/match", predictionController.getPrediction);

// Existing prediction routes (declared after /match so /:name doesn't capture it)
router.get("/:name", predictionController.getPredictions);
router.get("/:name/:opponent", predictionController.getMatchPrediction);

module.exports = router;
