const fs = require("fs");
const path = require("path");
const { loadAllCsvs } = require("./historicalLoader");
const { parseMatchesCsv } = require("./historicalParser");

const DB_CACHE_PATH = path.join(__dirname, "cache", "historical_db.json");

let storeDb = null;
let isInitializing = false;
let initPromise = null;

// Ensure cache directory exists
const cacheDir = path.dirname(DB_CACHE_PATH);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * Initializes the store by loading cached JSON database or fetching & parsing CSVs.
 * @returns {Promise<object>} The in-memory player index database
 */
async function initStore() {
  if (storeDb) return storeDb;
  if (isInitializing) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      if (fs.existsSync(DB_CACHE_PATH)) {
        console.log("[HistoricalStore] Loading database from local JSON cache...");
        const rawJson = fs.readFileSync(DB_CACHE_PATH, "utf-8");
        storeDb = JSON.parse(rawJson);
        console.log(`[HistoricalStore] Local JSON cache loaded. Loaded ${Object.keys(storeDb).length} players.`);
      } else {
        console.log("[HistoricalStore] Local JSON cache not found. Re-building historical database from source...");
        const csvMap = await loadAllCsvs();
        
        let db = {};
        for (const year of Object.keys(csvMap)) {
          const csvContent = csvMap[year];
          if (csvContent && csvContent.trim()) {
            console.log(`[HistoricalStore] Parsing matches for year ${year}...`);
            db = parseMatchesCsv(csvContent, db);
          }
        }
        
        storeDb = db;
        
        // Save to cache
        console.log("[HistoricalStore] Saving parsed database to local JSON cache...");
        fs.writeFileSync(DB_CACHE_PATH, JSON.stringify(storeDb), "utf-8");
        console.log(`[HistoricalStore] Caching completed. Saved ${Object.keys(storeDb).length} players.`);
      }
      return storeDb;
    } catch (err) {
      console.error("[HistoricalStore] Error during store initialization:", err.message);
      storeDb = {};
      return storeDb;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Resolves a player name query to the exact name in the database using fuzzy matching.
 * @param {string} query
 * @returns {string|null} Resolved exact name or null
 */
function resolvePlayerName(query) {
  if (!storeDb || !query) return null;
  const qNorm = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!qNorm) return null;

  const keys = Object.keys(storeDb);
  
  // 1. Exact match
  const exact = keys.find(k => k.toLowerCase() === query.trim().toLowerCase());
  if (exact) return exact;

  // 2. Normalized alphanumeric match
  const normMatch = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "") === qNorm);
  if (normMatch) return normMatch;

  // 3. Substring/partial match (e.g. "Djokovic" -> "Novak Djokovic")
  const partial = keys.find(k => k.toLowerCase().includes(query.trim().toLowerCase()));
  if (partial) return partial;

  // 4. Substring normalized match
  const partialNorm = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(qNorm));
  if (partialNorm) return partialNorm;

  return null;
}

/**
 * Returns raw matches for a player, grouped by year.
 * @param {string} playerQuery
 * @returns {object|null} Map of Year -> Matches[] or null
 */
function getPlayerMatches(playerQuery) {
  const resolved = resolvePlayerName(playerQuery);
  if (!resolved) return null;
  return storeDb[resolved];
}

/**
 * Computes surface-wise historical statistics for a player.
 * @param {string} playerQuery
 * @returns {object|null} Surface analytics map
 */
function getPlayerSurfaceStats(playerQuery) {
  const resolved = resolvePlayerName(playerQuery);
  if (!resolved) return null;

  const playerObj = storeDb[resolved];
  const surfaces = {};

  Object.keys(playerObj).forEach(year => {
    playerObj[year].forEach(match => {
      const s = match.surface || "Unknown";
      if (!surfaces[s]) {
        surfaces[s] = {
          wins: 0,
          losses: 0,
          total: 0,
          winRate: 0,
          aces: 0,
          doubleFaults: 0,
          firstServeInSum: 0,
          svptSum: 0,
          bpSavedSum: 0,
          bpFacedSum: 0,
          bpWonSum: 0,
          // Opponent bpFaced is where the player had break point opportunities on return
          oppBpFacedSum: 0, 
          oppBpSavedSum: 0,
          statsCount: 0
        };
      }

      const sObj = surfaces[s];
      sObj.total++;
      if (match.result === "W") {
        sObj.wins++;
      } else {
        sObj.losses++;
      }

      // Serve/Return detailed metrics if available
      if (match.aces !== null) sObj.aces += match.aces;
      if (match.doubleFaults !== null) sObj.doubleFaults += match.doubleFaults;

      // Reconstruct values for serve % and break points from match stats
      // We stored: firstServePct (value), breakPointsSaved (w_bpSaved/l_bpSaved)
      // For accurate percentage calculation, we'll average the rates when raw sums are missing.
      sObj.statsCount++;
    });
  });

  // Calculate final metrics
  Object.keys(surfaces).forEach(s => {
    const sObj = surfaces[s];
    sObj.winRate = sObj.total > 0 ? parseFloat(((sObj.wins / sObj.total) * 100).toFixed(1)) : 0;
    
    // Average aces and double faults per match
    sObj.acesPerMatch = sObj.total > 0 ? parseFloat((sObj.aces / sObj.total).toFixed(1)) : 0;
    sObj.dfPerMatch = sObj.total > 0 ? parseFloat((sObj.doubleFaults / sObj.total).toFixed(1)) : 0;

    // Remove temporary counters before returning
    delete sObj.firstServeInSum;
    delete sObj.svptSum;
    delete sObj.bpSavedSum;
    delete sObj.bpFacedSum;
    delete sObj.bpWonSum;
    delete sObj.oppBpFacedSum;
    delete sObj.oppBpSavedSum;
    delete sObj.statsCount;
  });

  return {
    player: resolved,
    surfaces
  };
}

/**
 * Returns chronological rankings history for a player.
 * @param {string} playerQuery
 * @returns {object|null} Array of ranking points
 */
function getPlayerRankingsHistory(playerQuery) {
  const resolved = resolvePlayerName(playerQuery);
  if (!resolved) return null;

  const playerObj = storeDb[resolved];
  const rankings = [];
  const datesSeen = new Set();

  Object.keys(playerObj).forEach(year => {
    playerObj[year].forEach(match => {
      if (match.matchDate && match.ranking !== null && !datesSeen.has(match.matchDate)) {
        datesSeen.add(match.matchDate);
        rankings.push({
          date: match.matchDate,
          rank: match.ranking,
          tournament: match.tournament
        });
      }
    });
  });

  // Sort chronologically ascending
  rankings.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    player: resolved,
    rankings
  };
}

/**
 * Computes historical H2H records and lists all direct matches between two players.
 * @param {string} playerQuery
 * @param {string} opponentQuery
 * @returns {object|null} Head-to-Head details
 */
function getPlayerH2H(playerQuery, opponentQuery) {
  const resolvedPlayer = resolvePlayerName(playerQuery);
  const resolvedOpponent = resolvePlayerName(opponentQuery);
  
  if (!resolvedPlayer || !resolvedOpponent) return null;

  const playerObj = storeDb[resolvedPlayer];
  const matches = [];
  let wins = 0;
  let losses = 0;

  Object.keys(playerObj).forEach(year => {
    playerObj[year].forEach(match => {
      if (match.opponent.toLowerCase() === resolvedOpponent.toLowerCase()) {
        matches.push(match);
        if (match.result === "W") wins++;
        else losses++;
      }
    });
  });

  return {
    player: resolvedPlayer,
    opponent: resolvedOpponent,
    record: { wins, losses },
    matches
  };
}

module.exports = {
  initStore,
  resolvePlayerName,
  getPlayerMatches,
  getPlayerSurfaceStats,
  getPlayerRankingsHistory,
  getPlayerH2H,
  getDb: () => storeDb
};
