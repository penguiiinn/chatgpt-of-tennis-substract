const express = require("express");
const router  = express.Router();
const tournamentController = require("../controllers/tournamentController");

// GET /api/tournament/analyze?player=<slug>&tournament=<name>
router.get("/analyze", tournamentController.getTournamentAnalysis);

module.exports = router;
