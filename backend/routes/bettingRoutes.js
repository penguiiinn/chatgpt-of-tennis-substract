const express = require("express");
const router  = express.Router();
const bettingController = require("../controllers/bettingController");

// GET /api/betting/analyze?playerA=<slug>&playerB=<slug>&oddsA=<decimal>&oddsB=<decimal>&surface=<surface>
router.get("/analyze", bettingController.getBettingAnalysis);

module.exports = router;
