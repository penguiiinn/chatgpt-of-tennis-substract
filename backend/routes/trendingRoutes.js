const express = require("express");
const router = express.Router();
const { getTrendingPlayers, clearCache } = require("../services/trendingEngine");

/**
 * GET /api/trending?surface=hard&limit=10
 *
 * Returns top trending players with momentum scores
 */
router.get("/", async (req, res, next) => {
  try {
    const { surface, limit } = req.query;
    const surf = surface || "hard";
    const lim = Math.min(parseInt(limit) || 10, 50);

    const players = await getTrendingPlayers(surf, lim);

    res.json({
      surface: surf,
      count: players.length,
      players,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trending/refresh
 *
 * Force cache refresh
 */
router.post("/refresh", (req, res) => {
  clearCache();
  res.json({ ok: true, message: "Trending cache cleared" });
});

module.exports = router;