const express = require("express");
const router = express.Router();
const predictionController = require("../controllers/predictionController");

router.get("/:name", predictionController.getPredictions);
router.get("/:name/:opponent", predictionController.getMatchPrediction);

module.exports = router;
