const express = require("express");
const router = express.Router();
const playerController = require("../controllers/playerController");

router.get("/", playerController.getPlayers);
router.get("/:name", playerController.getPlayerByName);

module.exports = router;
