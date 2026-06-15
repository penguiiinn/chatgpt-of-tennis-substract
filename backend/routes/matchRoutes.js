const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController");

router.get("/:name", matchController.getRecentMatches);
router.get("/:name/stats/:index", matchController.getMatchDetails);

module.exports = router;
