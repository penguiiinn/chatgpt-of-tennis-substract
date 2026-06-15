require("dotenv").config();
const express = require("express");
const cors = require("cors");

const playerRoutes = require("./routes/playerRoutes");
const surfaceRoutes = require("./routes/surfaceRoutes");
const matchRoutes = require("./routes/matchRoutes");
const h2hRoutes = require("./routes/h2hRoutes");
const predictionRoutes = require("./routes/predictionRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Base health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date(), service: "AceIntel API" });
});

// Connect Routes
app.use("/api/players", playerRoutes);
app.use("/api/surfaces", surfaceRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/h2h", h2hRoutes);
app.use("/api/predictions", predictionRoutes);

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
  console.log(`[AceIntel Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
