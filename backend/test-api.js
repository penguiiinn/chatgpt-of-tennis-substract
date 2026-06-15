const { spawn } = require("child_process");
const axios = require("axios");
const path = require("path");

const API_BASE = "http://localhost:5000/api";

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log("[Test API] Starting Express server...");
  
  // Start server process
  const server = spawn("node", ["server.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });
  
  // Wait for server to bind to port 5000
  await sleep(3000);
  
  let success = true;
  
  const testEndpoints = [
    {
      name: "Health Check",
      url: `${API_BASE}/health`,
      validate: (data) => data.status === "OK" && data.service === "AceIntel API"
    },
    {
      name: "Players List",
      url: `${API_BASE}/players`,
      validate: (data) => Array.isArray(data) && data.length > 0 && data.some(p => p.name === "Anna Blinkova")
    },
    {
      name: "Trending Players",
      url: `${API_BASE}/players?trending=true`,
      validate: (data) => Array.isArray(data) && data.length > 0 && data[0].form !== undefined
    },
    {
      name: "Player Profile",
      url: `${API_BASE}/players/Anna%20Blinkova`,
      validate: (data) => data.overview.name === "Anna Blinkova" && data.bestSurface === "Hard Court"
    },
    {
      name: "Surface Intelligence",
      url: `${API_BASE}/surfaces/Anna%20Blinkova`,
      validate: (data) => data.playerName === "Anna Blinkova" && data.surfaces.hard.strength === "Elite"
    },
    {
      name: "Matches List",
      url: `${API_BASE}/matches/Anna%20Blinkova`,
      validate: (data) => Array.isArray(data) && data.length === 10 && data[0].opponent !== undefined
    },
    {
      name: "Match Detail Stats & AI Summary",
      url: `${API_BASE}/matches/Anna%20Blinkova/stats/0`,
      validate: (data) => data.player === "Anna Blinkova" && data.stats.player.aces !== undefined && data.aiRecap !== undefined
    },
    {
      name: "H2H Comparison",
      url: `${API_BASE}/h2h?p1=Carlos+Alcaraz&p2=Jannik+Sinner`,
      validate: (data) => data.player1.overview.name === "Carlos Alcaraz" && data.meetings.record.a === 6 && data.matchup.confidence === "Medium"
    },
    {
      name: "Predictions List",
      url: `${API_BASE}/predictions/Anna%20Blinkova`,
      validate: (data) => data["Iga Swiatek"] !== undefined && data["Carlos Alcaraz"] !== undefined
    },
    {
      name: "Match Win Prediction Details",
      url: `${API_BASE}/predictions/Anna%20Blinkova/Coco%20Gauff`,
      validate: (data) => data.player === "Anna Blinkova" && data.opponent === "Coco Gauff" && data.winChance !== undefined && data.reasoning !== undefined
    }
  ];

  console.log("\n==================================================");
  console.log("             RUNNING BACKEND API TESTS            ");
  console.log("==================================================\n");

  for (const t of testEndpoints) {
    try {
      console.log(`[Test] Requesting: ${t.name} (${t.url})...`);
      const response = await axios.get(t.url);
      
      if (response.status === 200 && t.validate(response.data)) {
        console.log(`\x1b[32m✔ PASS\x1b[0m - ${t.name}\n`);
      } else {
        console.error(`\x1b[31m✘ FAIL\x1b[0m - ${t.name} (Response validation failed)\n`);
        console.log("Received Data:", JSON.stringify(response.data, null, 2));
        success = false;
      }
    } catch (error) {
      console.error(`\x1b[31m✘ FAIL\x1b[0m - ${t.name} (Error: ${error.message})\n`);
      if (error.response) {
        console.log("Error status:", error.response.status);
        console.log("Error response:", error.response.data);
      }
      success = false;
    }
  }

  console.log("==================================================");
  if (success) {
    console.log("\x1b[32mALL API ENDPOINTS TESTED SUCCESSFULLY! [PASS]\x1b[0m");
  } else {
    console.error("\x1b[31mSOME API ENDPOINTS FAILED VALIDATION! [FAIL]\x1b[0m");
  }
  console.log("==================================================\n");

  console.log("[Test API] Stopping Express server...");
  server.kill("SIGTERM");
  process.exit(success ? 0 : 1);
}

runTests();
