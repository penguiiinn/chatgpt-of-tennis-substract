const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");

router.get("/:player", historyController.getPlayerHistory);
router.get("/:player/surfaces", historyController.getPlayerSurfaces);
router.get("/:player/rankings", historyController.getPlayerRankings);
router.get("/:player/h2h/:opponent", historyController.getPlayerH2H);

module.exports = router;
