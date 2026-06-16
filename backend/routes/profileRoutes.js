const express = require("express");
const profileController = require("../controllers/profileController");

const router = express.Router();

router.get("/:playerId", profileController.getPlayerProfile);
router.get("/:playerId/form", profileController.getPlayerForm);
router.get("/:playerId/surfaces", profileController.getSurfaceStats);
router.get("/:playerId/trends", profileController.getTrendStats);

module.exports = router;