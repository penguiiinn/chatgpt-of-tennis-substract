const express = require("express");
const router = express.Router();
const matchupController = require("../controllers/matchupController");

router.get("/:player1/:player2", matchupController.getMatchup);

module.exports = router;
