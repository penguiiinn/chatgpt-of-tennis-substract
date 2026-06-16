const express = require("express");
const router = express.Router();
const { searchPlayers, refreshCache, getCacheStatus } = require("../scraper/searchScraper");

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

/**
 * GET /api/search/status
 * Diagnostic: shows cache health (player count, last refresh time, staleness).
 * Useful for debugging empty search results on deployed instances.
 */
router.get("/status", (req, res) => {
  res.json(getCacheStatus());
});

/**
 * POST /api/search/refresh
 * Force a manual cache refresh without redeploying.
 * Useful when Render cold-starts fail to warm the cache.
 */
router.post("/refresh", async (req, res, next) => {
  try {
    // Force expiry so refreshCache() actually re-fetches
    const { forceRefresh } = require("../scraper/searchScraper");
    if (typeof forceRefresh === "function") {
      await forceRefresh();
    } else {
      // Workaround: call refreshCache — it will skip if TTL hasn't expired,
      // so we expose a dedicated forceRefresh below
      await refreshCache();
    }
    res.json({ ok: true, status: getCacheStatus() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
