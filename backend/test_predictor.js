const aiPredictorService = require("./services/aiPredictorService");

async function runTests() {
  console.log("=== AceIntel Predictor Test Suite ===");
  
  try {
    // Test Matchup 1: Djokovic vs Alcaraz on Clay
    console.log("\nCalculating prediction: Novak Djokovic vs Carlos Alcaraz (Clay)...");
    const res1 = await aiPredictorService.predictMatch("Novak Djokovic", "Carlos Alcaraz", "clay");
    console.log("Result:", JSON.stringify(res1, null, 2));

    // Test Matchup 2: Sinner vs Medvedev on Hard
    console.log("\nCalculating prediction: Jannik Sinner vs Daniil Medvedev (Hard)...");
    const res2 = await aiPredictorService.predictMatch("Jannik Sinner", "Daniil Medvedev", "hard");
    console.log("Result:", JSON.stringify(res2, null, 2));
    
    // Assert check
    console.log("\n=== Quality Validation Checks ===");
    const assertValid = (res, title) => {
      console.log(`Checking ${title}:`);
      console.log(`  - Winner: ${res.winner}`);
      console.log(`  - Win Probability: ${res.winProbability}% (expected 50% - 95%)`);
      console.log(`  - Confidence: ${res.confidence} (${res.confidencePct}%)`);
      console.log(`  - Surface Edge: ${res.edges.surfaceEdge}`);
      console.log(`  - Recent Form Edge: ${res.edges.recentFormEdge}`);
      console.log(`  - Historical Edge: ${res.edges.historicalEdge}`);
      console.log(`  - H2H Edge: ${res.edges.h2hEdge}`);
      
      const hasInvalidValue = Object.values(res.edges).some(v => v.includes("#999") || v.includes("Unknown") || v.includes("N/A"));
      if (hasInvalidValue) {
        console.error("  [FAIL] Detected fallbacks or missing fields!");
      } else {
        console.log("  [PASS] No fallback placeholders detected.");
      }
    };
    
    assertValid(res1, "Djokovic vs Alcaraz");
    assertValid(res2, "Sinner vs Medvedev");

  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
