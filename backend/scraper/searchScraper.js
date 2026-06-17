const axios = require("axios");
const cheerio = require("cheerio");

/**
 * In-memory player cache. Scraped from Tennis Abstract Elo rating pages.
 * Structure: { name: string, url: string, tour: "ATP" | "WTA" }[]
 */
let playerCache = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Fallback static players when external scraping fails
const STATIC_PLAYERS = [
  { name: "Novak Djokovic", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=NovakDjokovic", tour: "ATP" },
  { name: "Carlos Alcaraz", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=CarlosAlcaraz", tour: "ATP" },
  { name: "Jannik Sinner", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=JannikSinner", tour: "ATP" },
  { name: "Daniil Medvedev", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=DaniilMedvedev", tour: "ATP" },
  { name: "Alexander Zverev", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=AlexanderZverev", tour: "ATP" },
  { name: "Taylor Fritz", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=TaylorFritz", tour: "ATP" },
  { name: "Holger Rune", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=HolgerRune", tour: "ATP" },
  { name: "Casper Ruud", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=CasperRuud", tour: "ATP" },
  { name: "Andrey Rublev", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=AndreyRublev", tour: "ATP" },
  { name: "Grigor Dimitrov", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=GrigorDimitrov", tour: "ATP" },
  { name: "Iga Świątek", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=IgaSwiatek", tour: "WTA" },
  { name: "Coco Gauff", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=CocoGauff", tour: "WTA" },
  { name: "Aryna Sabalenka", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=ArynaSabalenka", tour: "WTA" },
  { name: "Elena Rybakina", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=ElenaRybakina", tour: "WTA" },
  { name: "Jessica Pegula", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=JessicaPegula", tour: "WTA" },
  { name: "Jasmine Paolini", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=JasminePaolini", tour: "WTA" },
  { name: "Marketa Vondrousova", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=MarketaVondrousova", tour: "WTA" },
  { name: "Maria Sakkari", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=MariaSakkari", tour: "WTA" },
  { name: "Anna Blinkova", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=AnnaBlinkova", tour: "WTA" },
  { name: " Qinwen Zheng", url: "https://www.tennisabstract.com/cgi-bin/player.cgi?p=ZhengQinwen", tour: "WTA" }
];

// ── Browser-realistic headers + cookie-ish handling ─────────────────────────
// Rotate through multiple UAs to avoid bot detection on cloud hosts (Render etc.)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

const ACCEPTS = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
];

const LANGS = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "en-US,en;q=0.8,es;q=0.3",
];

const REFERRERS = [
  "https://www.tennisabstract.com/",
  "https://tennisabstract.com/",
  "https://www.tennisabstract.com/reports/",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Minimal cookie jar: store Set-Cookie values and send Cookie back next request.
// (No tough-cookie dependency in this repo.)
let cookieJar = "";

function buildHeaders(url) {
  const referer = rand(REFERRERS);
  return {
    "User-Agent": randomUA(),
    Accept: rand(ACCEPTS),
    "Accept-Language": rand(LANGS),
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    Referer: referer,
    ...(cookieJar ? { Cookie: cookieJar } : {}),
    // Sometimes helps reduce bot heuristics
    ...(url && url.includes("atp") ? { "Sec-Fetch-Site": "same-origin" } : {}),
  };
}

function updateCookieJar(setCookie) {
  // axios flattens Set-Cookie as an array sometimes, but not always.
  if (!setCookie) return;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  // Keep only name=value parts; strip attributes.
  const cookies = arr
    .map(c => (c || "").split(";")[0]?.trim())
    .filter(Boolean);
  if (!cookies.length) return;
  // Merge with existing jar by overwriting by cookie name.
  const jarParts = cookieJar
    ? cookieJar.split(";").map(s => s.trim()).filter(Boolean)
    : [];
  const jarMap = new Map(jarParts.map(p => {
    const [k, ...rest] = p.split("=");
    return [k, rest.join("=")];
  }));

  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k) jarMap.set(k, rest.join("="));
  }
  cookieJar = Array.from(jarMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelayBetweenRetries(attempt) {
  // 0.8s..1.6s base plus small jitter scaled by attempt
  const base = 800 + Math.random() * 800;
  const extra = (attempt - 1) * (400 + Math.random() * 400);
  return Math.round(base + extra);
}

function truncateForLog(s, max = 1200) {
  if (!s) return "";
  const str = typeof s === "string" ? s : JSON.stringify(s);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/**
 * Fetch a URL with automatic retry on failure.
 * Also captures/debugs blocked HTML bodies (Render often gets 403).
 * @param {string} url
 * @param {number} retries
 * @param {string=} context
 * @returns {Promise<AxiosResponse>}
 */
async function fetchWithRetry(url, retries = 4, context = "") {
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const headers = buildHeaders(url);
    try {
      const res = await axios.get(url, {
        headers,
        timeout: 25000,
        maxRedirects: 5,
        // axios follows redirects; keep cookies via our jar
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Capture cookies
      try {
        const setCookie = res.headers && (res.headers["set-cookie"] || res.headers["Set-Cookie"]);
        if (setCookie) updateCookieJar(setCookie);
      } catch (_) { }

      return res;
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const data = err?.response?.data;

      const bodyPreview = truncateForLog(data && (typeof data === "string" ? data : data?.toString?.()), 1500);

      console.warn(
        `[SearchScraper] Attempt ${attempt}/${retries} failed${context ? ` (${context})` : ""} for ${url}: ${err.message} (HTTP ${status || "N/A"})`
      );

      if (status === 403 || status === 429 || bodyPreview) {
        console.warn(`[SearchScraper] Failure body preview (truncated): ${bodyPreview}`);
      }

      // rotate cookies a bit on hard blocks
      if (status === 403 || status === 429) {
        cookieJar = cookieJar ? cookieJar.split("; ").slice(0, 2).join("; ") : "";
      }

      if (attempt < retries) {
        await sleep(randomDelayBetweenRetries(attempt));
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
async function scrapeEloPage(url, tour, opts = {}) {
  try {
    const context = opts.context || tour;
    console.log(`[SearchScraper] Fetching ${tour} player list from ${url}`);
    const res = await fetchWithRetry(url, 4, context);


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
      const tr = $(el).closest("tr");
      // Normalize player name (replace non-breaking spaces and other redundant whitespace)
      const name = $(el).text().replace(/\s+/g, " ").trim();
      let href = $(el).attr("href") || "";

      // Skip empty names or non-player links (like "All Men's Elo Ratings")
      if (!name || name.length < 3 || name.includes("...") || name.includes("Elo")) return;

      // Normalise to absolute URL
      if (href.startsWith("/")) {
        href = "https://www.tennisabstract.com" + href;
      }

      let age = null;
      let elo = null;
      let rank = null;

      if (tr.length) {
        const tds = tr.find("td");
        if (tds.length >= 16) {
          // Col 2: Age
          const ageText = tds.eq(2).text().trim();
          if (ageText) {
            age = Math.floor(parseFloat(ageText)) || null;
          }
          // Col 3: Elo
          const eloText = tds.eq(3).text().trim();
          if (eloText) {
            elo = Math.round(parseFloat(eloText)) || null;
          }
          // Col 15: ATP/WTA Rank
          const rankText = tds.eq(15).text().trim();
          if (rankText) {
            rank = parseInt(rankText, 10) || null;
          }
        }
      }

      // De-dup within this scrape
      if (!players.some(p => p.url === href)) {
        players.push({ name, url: href, tour, age, elo, rank });
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

  let atp = [];
  let wta = [];

  // Preserve stale cache independently: if ATP fails due to 403 but WTA works,
  // we still want to return partial results rather than clearing everything.
  try {
    atp = await scrapeEloPage(
      "https://tennisabstract.com/reports/atp_elo_ratings.html",
      "ATP",
      { context: "ATP" }
    );
  } catch (e) {
    atp = [];
  }

  try {
    wta = await scrapeEloPage(
      "https://tennisabstract.com/reports/wta_elo_ratings.html",
      "WTA",
      { context: "WTA" }
    );
  } catch (e) {
    wta = [];
  }

  const combined = [...atp, ...wta];

  if (combined.length > 0) {
    playerCache = combined;
    lastCacheTime = Date.now();
    console.log(`[SearchScraper] Cache populated with ${playerCache.length} players (ATP=${atp.length}, WTA=${wta.length})`);
  } else {
    // Keep the stale cache rather than wiping it — better to serve old data than nothing.
    if (playerCache.length > 0) {
      console.warn(
        `[SearchScraper] Refresh failed — keeping stale cache of ${playerCache.length} players (ATP=${atp.length}, WTA=${wta.length}).`
      );
      // Reset lastCacheTime so we retry on next request (don't serve stale data forever)
      lastCacheTime = now - CACHE_TTL_MS + 60_000; // retry in 1 minute
    } else {
      console.error("[SearchScraper] Refresh failed and cache is empty. Search will return no results.");
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

  // Always supplement cache with static players to ensure top players are included
  const combinedCache = [...(playerCache || []), ...STATIC_PLAYERS];
  if (!playerCache || playerCache.length === 0) {
    console.warn("[SearchScraper] Cache empty — using static fallback players");
  }

  // Deduplicate by name+tour, keeping record with most complete data
  const dedupedMap = new Map();
  for (const p of combinedCache) {
    const key = `${p.name}|${p.tour}`;
    const existing = dedupedMap.get(key);
    // Prefer record with more populated fields (elo, rank, age indicate more complete data)
    const scoreA = existing ? (existing.elo ? 1 : 0) + (existing.rank ? 1 : 0) + (existing.age ? 1 : 0) : 0;
    const scoreB = (p.elo ? 1 : 0) + (p.rank ? 1 : 0) + (p.age ? 1 : 0);
    if (!existing || scoreB > scoreA) {
      dedupedMap.set(key, p);
    }
  }
  const dedupedCache = Array.from(dedupedMap.values());

  const q = query.trim().toLowerCase();
  console.log(`[SearchScraper] Searching for: "${query}" in ${dedupedCache.length} cached players`);

  // Score-based ranking: exact match > starts-with > includes
  const resultsWithScore = dedupedCache
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

