const axios = require("axios");
const cheerio = require("cheerio");

/**
 * In-memory player cache. Scraped from Tennis Abstract Elo rating pages.
 * Structure: { name: string, url: string, tour: "ATP" | "WTA" }[]
 */
let playerCache = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Scrape a Tennis Abstract Elo ratings page and extract all player links.
 * @param {string} url  – Full URL to the Elo page
 * @param {"ATP"|"WTA"} tour
 * @returns {Promise<{name:string, url:string, tour:string}[]>}
 */
async function scrapeEloPage(url, tour) {
  try {
    console.log(`[SearchScraper] Fetching ${tour} player list from ${url}`);
    const res = await axios.get(url, {
      headers: { "User-Agent": UA },
      timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const players = [];

    // Player links follow this pattern:
    //   ATP:  /cgi-bin/player.cgi?p=FirstLast
    //   WTA:  /cgi-bin/wplayer.cgi?p=FirstLast  (or /cgi-bin/wplayer-classic.cgi)
    const linkSelector = tour === "ATP"
      ? 'a[href*="/cgi-bin/player.cgi?p="]'
      : 'a[href*="/cgi-bin/wplayer.cgi?p="], a[href*="/cgi-bin/wplayer-classic.cgi?p="]';

    $(linkSelector).each((_i, el) => {
      const name = $(el).text().trim();
      let href = $(el).attr("href") || "";

      // Skip empty names or non-player links (like "All Men's Elo Ratings")
      if (!name || name.length < 3 || name.includes("...") || name.includes("Elo")) return;

      // Normalise to absolute URL
      if (href.startsWith("/")) {
        href = "https://www.tennisabstract.com" + href;
      }

      // De-dup within this scrape
      if (!players.some(p => p.url === href)) {
        players.push({ name, url: href, tour });
      }
    });

    console.log(`[SearchScraper] Found ${players.length} ${tour} players`);
    return players;
  } catch (err) {
    console.warn(`[SearchScraper] Failed to scrape ${tour} Elo page: ${err.message}`);
    return [];
  }
}

/**
 * Build (or refresh) the full player cache from both tours.
 */
async function refreshCache() {
  const now = Date.now();
  if (playerCache.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return; // cache still fresh
  }

  console.log("[SearchScraper] Refreshing full player cache…");

  const [atp, wta] = await Promise.all([
    scrapeEloPage("https://tennisabstract.com/reports/atp_elo_ratings.html", "ATP"),
    scrapeEloPage("https://tennisabstract.com/reports/wta_elo_ratings.html", "WTA"),
  ]);

  const combined = [...atp, ...wta];

  if (combined.length > 0) {
    playerCache = combined;
    lastCacheTime = Date.now();
    console.log(`[SearchScraper] Cache populated with ${playerCache.length} players`);
  } else {
    console.warn("[SearchScraper] Both scrapes returned empty – keeping old cache");
  }
}

/**
 * Search for players whose name matches the query (case-insensitive substring).
 * @param {string} query
 * @param {number} limit  – Max results to return (default 20)
 * @returns {Promise<{name:string, url:string, tour:string}[]>}
 */
async function searchPlayers(query, limit = 20) {
  await refreshCache();

  if (!query || !query.trim()) return [];

  const q = query.trim().toLowerCase();

  // Score-based ranking: exact match > starts-with > includes
  const results = playerCache
    .map(p => {
      const lower = p.name.toLowerCase();
      let score = 0;
      if (lower === q) score = 100;
      else if (lower.startsWith(q)) score = 80;
      else if (lower.includes(q)) score = 60;
      // Also try matching first-name or last-name individually
      else {
        const parts = q.split(/\s+/);
        const nameParts = lower.split(/\s+/);
        const matchCount = parts.filter(part =>
          nameParts.some(np => np.startsWith(part))
        ).length;
        if (matchCount > 0) score = 40 + matchCount * 10;
      }
      return { ...p, score };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest); // strip internal score

  return results;
}

/**
 * Pre-warm the cache on server boot (non-blocking).
 */
function warmCache() {
  refreshCache().catch(err => {
    console.warn("[SearchScraper] Warm-cache failed:", err.message);
  });
}

module.exports = {
  searchPlayers,
  refreshCache,
  warmCache,
};
