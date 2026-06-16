const express = require("express");
const router = express.Router();
const playerController = require("../controllers/playerController");

/**
 * GET /api/player/:slug
 *
 * Retrieve scraped player profile by Tennis Abstract URL or slug.
 */
router.get("/:slug", playerController.getPlayerBySlug);

module.exports = router;
