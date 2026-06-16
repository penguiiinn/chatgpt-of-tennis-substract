const express = require("express");
const router = express.Router();
const { searchPlayers } = require("../scraper/searchScraper");

/**
 * GET /api/search?name=<query>&limit=<n>
 *
 * Search Tennis Abstract for matching player names.
 * Returns an array of { name, url, tour } objects.
 */
router.get("/", async (req, res, next) => {
  try {
    const { name, limit } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Missing required query parameter: name",
        example: "/api/search?name=novak",
      });
    }

    const maxResults = Math.min(parseInt(limit) || 20, 50);
    const results = await searchPlayers(name, maxResults);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
