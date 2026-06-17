const { PROFILE_DB, TRENDING_PLAYERS } = require("../data/db");
const { scrapePlayerProfile } = require("../scraper/tennisScraper");

// In-memory profiles cache (6 hours TTL)
const profileCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function resolvePlayerKey(query) {
  if (!query) return null;
  const keys = Object.keys(PROFILE_DB);
  
  // Normalize both by removing whitespace and converting to lowercase
  const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normQuery = normalize(query);
  
  const matched = keys.find(k => normalize(k) === normQuery)
      || keys.find(k => k.toLowerCase() === query.toLowerCase())
      || keys.find(k => k.toLowerCase().includes(query.toLowerCase()));
      
  if (matched) return matched;
  // Fallback to the trimmed query itself for dynamic lookup
  return query.trim();
}

const getTrendingPlayers = () => {
  return TRENDING_PLAYERS;
};

const getAllPlayersList = () => {
  return Object.keys(PROFILE_DB).map(key => {
    const p = PROFILE_DB[key];
    return {
      name: p.overview.name,
      rank: p.overview.currentRank,
      nationality: p.overview.nationality,
      flag: p.overview.flag,
      handedness: p.overview.handedness,
      elo: p.overview.elo,
      bestSurface: p.bestSurface
    };
  });
};

/**
 * Retrieve a player profile.
 * First checks static PROFILE_DB, then checks cache, and scrapes if not found.
 * @param {string} nameOrSlug
 */
const getPlayerProfile = async (nameOrSlug) => {
  if (!nameOrSlug) return null;

  // 1. Check if name matches a static profile in the database
  const key = resolvePlayerKey(nameOrSlug);
  if (key && PROFILE_DB[key]) {
    return PROFILE_DB[key];
  }

  // 2. Normalize query to construct cache key
  let cacheKey = nameOrSlug.trim();
  if (nameOrSlug.startsWith("http://") || nameOrSlug.startsWith("https://")) {
    try {
      const u = new URL(nameOrSlug);
      cacheKey = u.searchParams.get("p") || nameOrSlug;
    } catch (e) {}
  }
  cacheKey = cacheKey.toLowerCase();

  // Check in-memory cache
  const now = Date.now();
  if (profileCache.has(cacheKey)) {
    const cached = profileCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache Hit] Serving profile for: ${cacheKey}`);
      return cached.data;
    }
  }

  // 3. Scrape the profile dynamically
  console.log(`[Cache Miss] Scraping profile for: ${nameOrSlug}`);
  const profile = await scrapePlayerProfile(nameOrSlug);
  if (!profile) return null;

  // Merge missing fields from Multi-Source Scraper if CGI bio fetching failed
  const needsFallback = (
    profile.overview.currentRank === "Unknown" || 
    profile.overview.nationality === "N/A" || 
    !profile.overview.age || 
    profile.overview.age === "N/A"
  );

  if (needsFallback) {
    console.log(`[playerService] Primary biography scrape has missing critical fields for "${nameOrSlug}". Merging fields from Multi-Source Scraper...`);
    try {
      const { getLivePlayerProfile } = require("../scraper/multiSourceScraper");
      const liveData = await getLivePlayerProfile(nameOrSlug);
      if (liveData && liveData.player) {
        const lp = liveData.player;
        if (profile.overview.currentRank === "Unknown" && lp.rank !== "Unknown") {
          profile.overview.currentRank = lp.rank;
        }
        if (profile.overview.peakRank === "Unknown" && lp.peakRank !== "Unknown") {
          profile.overview.peakRank = lp.peakRank;
        }
        if ((!profile.overview.age || profile.overview.age === "N/A" || profile.overview.age === "Unknown") && lp.age !== "Unknown") {
          profile.overview.age = lp.age;
        }
        if ((profile.overview.nationality === "N/A" || profile.overview.nationality === "Unknown") && lp.country !== "Unknown") {
          profile.overview.nationality = lp.country;
        }
        if ((!profile.overview.handedness || profile.overview.handedness.includes("Unknown")) && lp.handedness !== "Unknown") {
          profile.overview.handedness = lp.handedness;
        }
        if (profile.overview.elo === "Unknown" && lp.elo !== "Unknown") {
          profile.overview.elo = lp.elo;
        }
        if ((profile.overview.ytdWinLoss === "0-0" || profile.overview.ytdWinLoss === "Unknown") && lp.ytdRecord !== "Unknown") {
          profile.overview.ytdWinLoss = lp.ytdRecord;
        }
      }
    } catch (e) {
      console.warn(`[playerService] Failed to merge fields from Multi-Source Scraper:`, e.message);
    }
  }

  // 4. Pre-populate predictions against the 4 static players for frontend compatibility
  profile.predictions = {};
  const staticOpponents = ["Carlos Alcaraz", "Jannik Sinner", "Iga Swiatek", "Anna Blinkova"];
  staticOpponents.forEach(oppName => {
    // Skip predicting against oneself
    if (profile.overview.name.toLowerCase() === oppName.toLowerCase()) return;

    const oppProfile = PROFILE_DB[oppName];
    if (oppProfile) {
      const playerElo = profile.overview.elo;
      const oppElo = oppProfile.overview.elo;

      // Handle Unknown elo values in predictions
      if (playerElo === "Unknown" || oppElo === "Unknown") {
        profile.predictions[oppName] = {
          winChance: 50,
          confidence: "Unknown",
          surface: profile.bestSurface,
          reasoning: `Insufficient data to generate prediction. Player or opponent Elo rating is unknown.`
        };
        return;
      }

      const eloDiff = playerElo - oppElo;
      const winChance = Math.round((1 / (1 + Math.pow(10, -eloDiff / 400))) * 100);

      let confidence = "Medium";
      if (Math.abs(eloDiff) > 250) confidence = "High";
      if (Math.abs(eloDiff) < 80) confidence = "Low";

      profile.predictions[oppName] = {
        winChance,
        confidence,
        surface: profile.bestSurface,
        reasoning: `Projected matchup analysis based on Elo ratings: ${profile.overview.name} (${playerElo}) vs ${oppName} (${oppElo}). ${winChance >= 50 ? profile.overview.name + ' has the advantage.' : oppName + ' is favored to win.'}`
      };
    }
  });

  // Store in cache
  profileCache.set(cacheKey, { timestamp: now, data: profile });
  return profile;
};

module.exports = {
  resolvePlayerKey,
  getTrendingPlayers,
  getAllPlayersList,
  getPlayerProfile
};
