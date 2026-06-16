const axios = require("axios");
const cheerio = require("cheerio");

/**
 * In-memory player cache. Scraped from Tennis Abstract Elo rating pages.
 * Structure: { name: string, url: string, tour: "ATP" | "WTA" }[]
 */
let playerCache = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Browser-realistic headers ────────────────────────────────────────────────
// Rotate through multiple UAs to avoid bot detection on cloud hosts (Render etc.)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function buildHeaders() {
  return {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Referer": "https://www.tennisabstract.com/",
  };
}

/**
 * Fetch a URL with automatic retry on failure.
 * @param {string} url
 * @param {number} retries
 * @returns {Promise<AxiosResponse>}
 */
async function fetchWithRetry(url, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: buildHeaders(),
        timeout: 20000,
        maxRedirects: 5,
      });
      return res;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      console.warn(`[SearchScraper] Attempt ${attempt}/${retries} failed for ${url}: ${err.message} (HTTP ${status || "N/A"})`);
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Scrape a Tennis Abstract Elo ratings page and extract all player links.
 * @param {string} url  – Full URL to the Elo page
 * @param {"ATP"|"WTA"} tour
 * @returns {Promise<{name:string, url:string, tour:string}[]>}
 */
async function scrapeEloPage(url, tour) {
  try {
    console.log(`[SearchScraper] Fetching ${tour} player list from ${url}`);
    const res = await fetchWithRetry(url);

    // Detect blocked / empty responses (some hosts serve a 200 with empty/error HTML)
    const bodyLen = (res.data || "").length;
    if (bodyLen < 500) {
      console.warn(`[SearchScraper] ${tour} page returned suspiciously short body (${bodyLen} bytes) — likely blocked.`);
      return [];
    }

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
 * Preserves a stale cache if both scrapes fail, to avoid going fully dark.
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
    // Keep the stale cache rather than wiping it — better to serve old data than nothing.
    if (playerCache.length > 0) {
      console.warn("[SearchScraper] Scrape failed — keeping stale cache of " + playerCache.length + " players.");
      // Reset lastCacheTime so we retry on next request (don't serve stale data forever)
      lastCacheTime = now - CACHE_TTL_MS + 60_000; // retry in 1 minute
    } else {
      console.error("[SearchScraper] Scrape failed and cache is empty. Search will return no results.");
      lastCacheTime = now; // avoid tight retry loop
    }
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

  // If cache is still empty after refresh, log a clear diagnostic and return empty
  if (!playerCache || playerCache.length === 0) {
    console.error("[SearchScraper] Player cache is empty — Tennis Abstract may be blocking requests from this host.");
    return [];
  }

  const q = query.trim().toLowerCase();
  console.log(`[SearchScraper] Searching for: "${query}" in ${playerCache.length} cached players`);

  // Score-based ranking: exact match > starts-with > includes
  const resultsWithScore = playerCache
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
    .filter(p => p.score > 0);

  const results = resultsWithScore
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest); // strip internal score

  console.log(`[SearchScraper] Matched ${results.length} players for query "${query}"`);
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

/**
 * Return a cache status snapshot (used by /api/search/status diagnostic endpoint).
 */
function getCacheStatus() {
  return {
    playerCount: playerCache.length,
    lastRefreshedAt: lastCacheTime ? new Date(lastCacheTime).toISOString() : null,
    cacheAgeSeconds: lastCacheTime ? Math.round((Date.now() - lastCacheTime) / 1000) : null,
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    isStale: lastCacheTime ? (Date.now() - lastCacheTime) > CACHE_TTL_MS : true,
  };
}

/**
 * Force an immediate cache re-scrape regardless of TTL.
 * Used by the /api/search/refresh admin endpoint.
 */
async function forceRefresh() {
  lastCacheTime = 0; // expire the cache
  await refreshCache();
}

module.exports = {
  searchPlayers,
  refreshCache,
  forceRefresh,
  warmCache,
  getPlayerCache: () => playerCache,
  getCacheStatus,
};

