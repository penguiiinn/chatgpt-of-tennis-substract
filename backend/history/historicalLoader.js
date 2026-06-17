const fs = require("fs");
const path = require("path");
const axios = require("axios");

const CACHE_DIR = path.join(__dirname, "cache", "csv");
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const BASE_URL = "https://raw.githubusercontent.com/KutayKoray/ATP-Tennis-Prediction-Using-ANN/main/datas";

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generates synthetic tennis matches in Sackmann CSV format for a given year.
 * @param {number} year
 * @returns {string} CSV content
 */
function generateSyntheticCsv(year) {
  console.log(`[HistoricalLoader] Generating synthetic CSV data for year ${year}`);
  const headers = [
    "tourney_id", "tourney_name", "surface", "draw_size", "tourney_level", "tourney_date", "match_num",
    "winner_id", "winner_seed", "winner_entry", "winner_name", "winner_hand", "winner_ht", "winner_ioc", "winner_age",
    "loser_id", "loser_seed", "loser_entry", "loser_name", "loser_hand", "loser_ht", "loser_ioc", "loser_age",
    "score", "best_of", "round", "minutes", "w_ace", "w_df", "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_SvGms", "w_bpSaved", "w_bpFaced",
    "l_ace", "l_df", "l_svpt", "l_1stIn", "l_1stWon", "l_2ndWon", "l_SvGms", "l_bpSaved", "l_bpFaced",
    "winner_rank", "winner_rank_points", "loser_rank", "loser_rank_points"
  ];

  const players = [
    { name: "Novak Djokovic", rank: 4, age: 37, id: 104925, hand: "R", ht: 188, ioc: "SRB" },
    { name: "Jannik Sinner", rank: 1, age: 23, id: 206173, hand: "R", ht: 188, ioc: "ITA" },
    { name: "Carlos Alcaraz", rank: 2, age: 21, id: 207385, hand: "R", ht: 185, ioc: "ESP" },
    { name: "Daniil Medvedev", rank: 5, age: 28, id: 106421, hand: "R", ht: 198, ioc: "RUS" },
    { name: "Alexander Zverev", rank: 3, age: 27, id: 100644, hand: "R", ht: 198, ioc: "GER" },
    { name: "Taylor Fritz", rank: 6, age: 26, id: 126207, hand: "R", ht: 196, ioc: "USA" }
  ];

  const tournaments = [
    { name: "Australian Open", surface: "Hard", level: "G", date: `${year}0115` },
    { name: "Indian Wells Masters", surface: "Hard", level: "M", date: `${year}0310` },
    { name: "Miami Masters", surface: "Hard", level: "M", date: `${year}0322` },
    { name: "Monte Carlo Masters", surface: "Clay", level: "M", date: `${year}0412` },
    { name: "Madrid Masters", surface: "Clay", level: "M", date: `${year}0502` },
    { name: "Rome Masters", surface: "Clay", level: "M", date: `${year}0510` },
    { name: "Roland Garros", surface: "Clay", level: "G", date: `${year}0525` },
    { name: "Wimbledon", surface: "Grass", level: "G", date: `${year}0630` },
    { name: "Canada Masters", surface: "Hard", level: "M", date: `${year}0805` },
    { name: "Cincinnati Masters", surface: "Hard", level: "M", date: `${year}0812` },
    { name: "US Open", surface: "Hard", level: "G", date: `${year}0825` },
    { name: "Shanghai Masters", surface: "Hard", level: "M", date: `${year}1005` },
    { name: "Paris Masters", surface: "Hard", level: "M", date: `${year}1102` },
    { name: "ATP Finals", surface: "Hard", level: "F", date: `${year}1110` }
  ];

  const rows = [];
  let matchCounter = 1;

  tournaments.forEach(t => {
    // 1. Earlier rounds: generate wins for all top players against mock opponents
    players.forEach(p => {
      const mockOpponent = {
        name: `${t.name.replace(/\s+/g, "")} Qualifier`,
        rank: 50 + Math.floor(Math.random() * 50),
        id: 99999 + matchCounter,
        age: 24,
        hand: "R",
        ht: 185,
        ioc: "USA"
      };
      rows.push(createMatchRow(t, "R32", p, mockOpponent, "W"));
      rows.push(createMatchRow(t, "R16", p, mockOpponent, "W"));
    });

    // 2. QF matches (let's set up matchups)
    // Djokovic vs Fritz, Sinner vs Zverev, Alcaraz vs Medvedev
    rows.push(createMatchRow(t, "QF", players[0], players[5], Math.random() > 0.3 ? "W" : "L")); // Djokovic vs Fritz
    rows.push(createMatchRow(t, "QF", players[1], players[4], Math.random() > 0.3 ? "W" : "L")); // Sinner vs Zverev
    rows.push(createMatchRow(t, "QF", players[2], players[3], Math.random() > 0.4 ? "W" : "L")); // Alcaraz vs Medvedev

    // 3. SF matches
    // Djokovic vs Medvedev
    rows.push(createMatchRow(t, "SF", players[0], players[3], Math.random() > 0.5 ? "W" : "L"));
    // Sinner vs Alcaraz
    rows.push(createMatchRow(t, "SF", players[1], players[2], Math.random() > 0.5 ? "W" : "L"));

    // 4. Finals (always between two target players, e.g., Djokovic vs Sinner)
    rows.push(createMatchRow(t, "F", players[1], players[0], Math.random() > 0.5 ? "W" : "L"));
  });

  function createMatchRow(tourney, round, p1, p2, outcome) {
    const winner = outcome === "W" ? p1 : p2;
    const loser = outcome === "W" ? p2 : p1;
    
    const w_ace = Math.floor(Math.random() * 15) + 3;
    const w_df = Math.floor(Math.random() * 5);
    const w_svpt = Math.floor(Math.random() * 40) + 50;
    const w_1stIn = Math.floor(w_svpt * (0.55 + Math.random() * 0.15));
    const w_bpFaced = Math.floor(Math.random() * 8);
    const w_bpSaved = Math.max(0, w_bpFaced - Math.floor(Math.random() * 3));

    const l_ace = Math.floor(Math.random() * 12) + 2;
    const l_df = Math.floor(Math.random() * 6);
    const l_svpt = Math.floor(Math.random() * 40) + 50;
    const l_1stIn = Math.floor(l_svpt * (0.50 + Math.random() * 0.15));
    const l_bpFaced = Math.floor(Math.random() * 10);
    const l_bpSaved = Math.max(0, l_bpFaced - Math.floor(Math.random() * 4));

    const scores = ["6-4 6-3", "7-6(5) 6-4", "6-3 4-6 6-2", "7-5 6-7(4) 6-3", "6-2 6-4"];
    const score = scores[Math.floor(Math.random() * scores.length)];

    const match_num = matchCounter++;
    
    const rowData = [
      `${year}-${tourney.name.replace(/\s+/g, "")}`,
      tourney.name,
      tourney.surface,
      32,
      tourney.level,
      tourney.date,
      match_num,
      winner.id,
      "",
      "",
      winner.name,
      winner.hand,
      winner.ht,
      winner.ioc,
      winner.age,
      loser.id,
      "",
      "",
      loser.name,
      loser.hand,
      loser.ht,
      loser.ioc,
      loser.age,
      score,
      3,
      round,
      120,
      w_ace,
      w_df,
      w_svpt,
      w_1stIn,
      Math.floor(w_1stIn * 0.7),
      Math.floor((w_svpt - w_1stIn) * 0.5),
      10,
      w_bpSaved,
      w_bpFaced,
      l_ace,
      l_df,
      l_svpt,
      l_1stIn,
      Math.floor(l_1stIn * 0.65),
      Math.floor((l_svpt - l_1stIn) * 0.45),
      10,
      l_bpSaved,
      l_bpFaced,
      winner.rank,
      2000,
      loser.rank,
      1500
    ];

    return rowData.map(val => {
      const str = String(val);
      if (str.includes(",") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  }

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Downloads a single match CSV file for a given year if it doesn't already exist in the cache.
 * @param {number} year
 * @returns {Promise<string>} Content of the CSV file
 */
async function loadYearCsv(year) {
  const localPath = path.join(CACHE_DIR, `atp_matches_${year}.csv`);
  
  if (fs.existsSync(localPath)) {
    console.log(`[HistoricalLoader] Loading cached CSV for year ${year}`);
    return fs.readFileSync(localPath, "utf-8");
  }

  // Years 2025 and 2026 are synthetic fallbacks
  if (year >= 2025) {
    const content = generateSyntheticCsv(year);
    fs.writeFileSync(localPath, content, "utf-8");
    console.log(`[HistoricalLoader] Generated and cached synthetic CSV for year ${year}.`);
    return content;
  }

  const url = `${BASE_URL}/atp_matches_${year}.csv`;
  console.log(`[HistoricalLoader] Downloading CSV for year ${year} from ${url}`);
  
  try {
    const res = await axios.get(url, { timeout: 30000 });
    const content = res.data;
    
    // Save to cache
    fs.writeFileSync(localPath, content, "utf-8");
    console.log(`[HistoricalLoader] Cached CSV for year ${year} successfully.`);
    return content;
  } catch (err) {
    console.error(`[HistoricalLoader] Failed to download CSV for year ${year}: ${err.message}. Falling back to synthetic generation.`);
    const content = generateSyntheticCsv(year);
    fs.writeFileSync(localPath, content, "utf-8");
    return content;
  }
}

/**
 * Loads all ATP matches CSV files for 2019-2026.
 * @returns {Promise<{ [year: number]: string }>} Map of year to CSV content
 */
async function loadAllCsvs() {
  const result = {};
  for (const year of YEARS) {
    result[year] = await loadYearCsv(year);
  }
  return result;
}

module.exports = {
  loadAllCsvs,
  loadYearCsv,
  YEARS
};
