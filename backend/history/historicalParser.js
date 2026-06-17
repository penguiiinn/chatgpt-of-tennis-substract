/**
 * Parses a single CSV line taking quotes and commas into account.
 * @param {string} line
 * @returns {string[]} Columns
 */
function parseCsvLine(line) {
  const result = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      let val = line.substring(start, i).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      result.push(val);
      start = i + 1;
    }
  }
  let lastVal = line.substring(start).trim();
  if (lastVal.startsWith('"') && lastVal.endsWith('"')) {
    lastVal = lastVal.substring(1, lastVal.length - 1);
  }
  result.push(lastVal);
  return result;
}

/**
 * Formats YYYYMMDD string to YYYY-MM-DD
 * @param {string} dateStr
 * @returns {string|null}
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  return `${y}-${m}-${d}`;
}

const parseNum = (val) => {
  if (val === "" || val === undefined || val === null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
};

/**
 * Parses match CSV data and updates the in-memory database index.
 * @param {string} csvContent
 * @param {object} db Existing index to add to
 */
function parseMatchesCsv(csvContent, db = {}) {
  if (!csvContent || !csvContent.trim()) return db;

  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return db;

  const headers = parseCsvLine(lines[0]);
  const headerMap = {};
  headers.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const getCol = (cols, name) => {
    const idx = headerMap[name];
    return idx !== undefined ? cols[idx] : "";
  };

  const addPlayerMatch = (playerName, year, match) => {
    if (!playerName) return;
    const name = playerName.trim();
    if (!db[name]) {
      db[name] = {};
    }
    if (!db[name][year]) {
      db[name][year] = [];
    }
    db[name][year].push(match);
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < headers.length) continue;

    const tourneyName = getCol(cols, "tourney_name");
    const surface = getCol(cols, "surface");
    const tourneyDate = getCol(cols, "tourney_date");
    const matchDate = formatDate(tourneyDate);
    const yearStr = tourneyDate ? tourneyDate.substring(0, 4) : null;
    if (!yearStr || !matchDate) continue;

    const winnerName = getCol(cols, "winner_name");
    const loserName = getCol(cols, "loser_name");
    const score = getCol(cols, "score");
    const round = getCol(cols, "round");

    const winnerRank = parseNum(getCol(cols, "winner_rank"));
    const loserRank = parseNum(getCol(cols, "loser_rank"));

    const w_ace = parseNum(getCol(cols, "w_ace"));
    const w_df = parseNum(getCol(cols, "w_df"));
    const w_svpt = parseNum(getCol(cols, "w_svpt"));
    const w_1stIn = parseNum(getCol(cols, "w_1stIn"));
    const w_bpSaved = parseNum(getCol(cols, "w_bpSaved"));
    const w_bpFaced = parseNum(getCol(cols, "w_bpFaced"));

    const l_ace = parseNum(getCol(cols, "l_ace"));
    const l_df = parseNum(getCol(cols, "l_df"));
    const l_svpt = parseNum(getCol(cols, "l_svpt"));
    const l_1stIn = parseNum(getCol(cols, "l_1stIn"));
    const l_bpSaved = parseNum(getCol(cols, "l_bpSaved"));
    const l_bpFaced = parseNum(getCol(cols, "l_bpFaced"));

    // 1st serve won and 2nd serve won if needed in calculations, but first serve % is: 1stIn / svpt
    const w_1stServePct = (w_svpt && w_svpt > 0 && w_1stIn !== null) ? Math.round((w_1stIn / w_svpt) * 100) : null;
    const l_1stServePct = (l_svpt && l_svpt > 0 && l_1stIn !== null) ? Math.round((l_1stIn / l_svpt) * 100) : null;

    // Break points won is: opponent's bpFaced - opponent's bpSaved
    const w_bpWon = (l_bpFaced !== null && l_bpSaved !== null) ? (l_bpFaced - l_bpSaved) : null;
    const l_bpWon = (w_bpFaced !== null && w_bpSaved !== null) ? (w_bpFaced - w_bpSaved) : null;

    // Register Match for Winner
    addPlayerMatch(winnerName, yearStr, {
      matchDate,
      opponent: loserName,
      tournament: tourneyName,
      round,
      surface,
      result: "W",
      score,
      ranking: winnerRank,
      opponentRanking: loserRank,
      aces: w_ace,
      doubleFaults: w_df,
      firstServePct: w_1stServePct,
      breakPointsSaved: w_bpSaved,
      breakPointsWon: w_bpWon
    });

    // Register Match for Loser
    addPlayerMatch(loserName, yearStr, {
      matchDate,
      opponent: winnerName,
      tournament: tourneyName,
      round,
      surface,
      result: "L",
      score,
      ranking: loserRank,
      opponentRanking: winnerRank,
      aces: l_ace,
      doubleFaults: l_df,
      firstServePct: l_1stServePct,
      breakPointsSaved: l_bpSaved,
      breakPointsWon: l_bpWon
    });
  }

  // Sort matches for each player and year chronologically (descending)
  Object.keys(db).forEach(player => {
    Object.keys(db[player]).forEach(year => {
      db[player][year].sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
    });
  });

  return db;
}

module.exports = {
  parseMatchesCsv,
  parseCsvLine
};
