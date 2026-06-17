require("dotenv").config();
const express = require("express");
const cors = require("cors");

const playerRoutes = require("./routes/playerRoutes");
const playerDetailRoutes = require("./routes/playerDetailRoutes");
const surfaceRoutes = require("./routes/surfaceRoutes");
const matchRoutes = require("./routes/matchRoutes");
const h2hRoutes = require("./routes/h2hRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const searchRoutes = require("./routes/searchRoutes");
const matchupRoutes = require("./routes/matchupRoutes");
const { warmCache } = require("./scraper/searchScraper");
const liveRoutes = require("./routes/liveRoutes");
const profileRoutes = require("./routes/profileRoutes");
// Step 6 — new prediction engine route (separate from legacy /api/predictions)
const predictionEngineRoutes = require("./routes/predictionRoutes");
// Step 7 — Betting Intelligence Layer
const bettingRoutes = require("./routes/bettingRoutes");
// Step 8 — Tournament Mode
const tournamentRoutes = require("./routes/tournamentRoutes");
const historyRoutes = require("./routes/historyRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const { initStore } = require("./history/historicalStore");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Base health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date(), service: "AceIntel API" });
});

// Connect Routes (must be registered before any potential fallback routes)
app.use("/api/players", playerRoutes);
app.use("/api/player", playerDetailRoutes);
app.use("/api/surfaces", surfaceRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/h2h", h2hRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/matchup", matchupRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/profile", profileRoutes);
// Step 6 — Prediction Engine (also accessible via existing /api/predictions/match)
app.use("/api/prediction", predictionEngineRoutes);
// Step 7 — Betting Intelligence Layer
app.use("/api/betting", bettingRoutes);
// Step 8 — Tournament Mode
app.use("/api/tournament", tournamentRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/trending", trendingRoutes);


// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred."
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[AceIntel Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} `);
  // Pre-warm the Tennis Abstract player cache
  warmCache();
  // Warm the historical data store index (async, non-blocking)
  initStore().catch(err => {
    console.error("[AceIntel Server] Failed to warm historical database on startup:", err.message);
  });
});
