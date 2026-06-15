const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Parses a player statistics overview page (e.g., from Tennis Abstract).
 * If the request fails or formatting mismatches, returns a fallback structure.
 */
const scrapePlayerProfile = async (playerUrl) => {
  try {
    console.log(`[Scraper] Attempting to scrape: ${playerUrl}`);
    const response = await axios.get(playerUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    const result = {
      name: "",
      rank: null,
      elo: null,
      source: playerUrl,
      scrapedAt: new Date()
    };
    
    // Parse name from heading (usually h1 or title)
    result.name = $("h1").first().text().trim() || $("title").text().split(" - ")[0].trim();
    
    // Attempt to parse Rank & Elo from tables (mock parsing logic representing standard layout)
    $("td, th").each((i, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("current rank") || text.includes("ranking:")) {
        const val = $(el).next().text().trim();
        result.rank = parseInt(val.replace(/\D/g, ""), 10) || null;
      }
      if (text.includes("elo rating") || text.includes("elo:")) {
        const val = $(el).next().text().trim();
        result.elo = parseInt(val.replace(/\D/g, ""), 10) || null;
      }
    });

    return result;
  } catch (error) {
    console.warn(`[Scraper Warning] Failed to scrape profile from ${playerUrl}: ${error.message}. Returning fallback.`);
    return {
      error: true,
      message: error.message,
      scrapedAt: new Date(),
      fallbackData: {
        name: "Mock Scraped Player",
        rank: 10,
        elo: 2000
      }
    };
  }
};

/**
 * Parses match tables from an HTML string.
 */
const scrapeMatchHistory = async (historyUrl) => {
  try {
    console.log(`[Scraper] Fetching match history: ${historyUrl}`);
    const response = await axios.get(historyUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000
    });
    
    const $ = cheerio.load(response.data);
    const matches = [];
    
    // Standard table parsing selector (generic search for table rows)
    $("table tr").each((i, row) => {
      if (i === 0) return; // skip header row
      
      const cells = $(row).find("td");
      if (cells.length >= 4) {
        matches.push({
          opponent: $(cells[1]).text().trim(),
          score: $(cells[2]).text().trim(),
          surface: $(cells[3]).text().trim(),
          result: $(cells[0]).text().trim().toLowerCase().includes("w") ? "win" : "loss"
        });
      }
    });
    
    return {
      matches: matches.slice(0, 10), // Limit to last 10
      scrapedAt: new Date(),
      totalScraped: matches.length
    };
  } catch (error) {
    console.warn(`[Scraper Warning] Failed to scrape match history from ${historyUrl}: ${error.message}. Returning fallback.`);
    return {
      error: true,
      message: error.message,
      scrapedAt: new Date(),
      fallbackMatches: [
        { opponent: "Scrape Fallback Rival A", score: "6-4 6-3", surface: "Hard", result: "win" },
        { opponent: "Scrape Fallback Rival B", score: "3-6 4-6", surface: "Clay", result: "loss" }
      ]
    };
  }
};

module.exports = {
  scrapePlayerProfile,
  scrapeMatchHistory
};
