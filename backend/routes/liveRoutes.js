const express = require("express");
const liveController = require("../controllers/liveController");

const router = express.Router();

// Matches
router.get("/matches/latest", liveController.getLatestMatches);
router.get("/matches/last10", liveController.getLast10Matches);

// Tournaments / Rankings
router.get("/tournaments/current", liveController.getCurrentTournaments);
router.get("/rankings/latest", liveController.getLatestRankings);

// History backfill (public as requested)
router.post("/history/backfill", liveController.backfillPlayerHistory);

module.exports = router;

