const axios = require("axios");
const cheerio = require("cheerio");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseDateLoose(str) {
    if (!str) return null;
    const s = str.toString().trim();
    // try: "Jun 10, 2026"
    const m1 = s.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (m1) {
        const dt = new Date(`${m1[1]} ${m1[2]}, ${m1[3]}`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    // try: "2026-06-10"
    const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) {
        const dt = new Date(`${m2[1]}-${m2[2]}-${m2[3]}T00:00:00Z`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }
    return null;
}

function normalizeTour(tour) {
    const t = (tour || "ATP").toString().toUpperCase();
    return t === "WTA" ? "WTA" : "ATP";
}

/**
 * Fetch current tournaments page and normalize into array.
 * Note: Tennis Abstract pages vary; this scraper uses heuristics for a "current tournaments" feed.
 */
async function fetchCurrentTournamentsFromTennisAbstract({ tour } = {}) {
    const url = "https://tennisabstract.com/";
    try {
        console.log(`[TournamentScraper] Fetching current tournaments list from ${url}`);
        const res = await axios.get(url, {
            headers: { "User-Agent": UA },
            timeout: 20000,
        });

        const $ = cheerio.load(res.data);
        const tournaments = [];

        $("a[href*='/current/']").each((_i, a) => {
            const href = $(a).attr("href") || "";
            let name = $(a).prevAll("b").first().text().trim();
            if (!name) {
                name = $(a).parent().find("b").first().text().trim();
            }

            if (!name) {
                // Fallback to URL parsing if <b> tag not found
                const match = href.match(/\/current\/\d{4}([A-Za-z0-9]+)\.html/);
                name = match ? match[1].replace(/([A-Z])/g, " $1").trim() : "Unknown Tournament";
            }

            const isWta = name.toLowerCase().includes("wta") || href.toLowerCase().includes("wta");
            if (tour && tour.toUpperCase() === "WTA" && !isWta) return;
            if (tour && tour.toUpperCase() === "ATP" && isWta) return;

            // Extract category
            const category = isWta ? "WTA" : name.toLowerCase().includes("challenger") ? "Challenger" : "ATP";

            // Extract favorite and startDate (year)
            let favorite = null;
            let nextNode = a.nextSibling;
            let textContent = "";
            while (nextNode) {
                if (nextNode.name === "b") {
                    break;
                }
                if (nextNode.type === "text") {
                    textContent += nextNode.data;
                } else if (nextNode.name === "a") {
                    textContent += $(nextNode).text();
                }
                nextNode = nextNode.nextSibling;
            }

            const favMatch = textContent.replace(/\s+/g, " ").match(/Favorite:\s*([^,]+),\s*([\d\.]+%)/i);
            if (favMatch) {
                favorite = `${favMatch[1].trim()} (${favMatch[2]})`;
            }

            const yearMatch = href.match(/\/current\/(\d{4})/);
            const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
            const startDate = `${year}-01-01T00:00:00.000Z`; // default to start of year if exact date not parsed

            tournaments.push({
                tournamentName: name,
                category,
                startDate,
                endDate: null,
                status: favorite ? `Favorite: ${favorite}` : "Ongoing",
                stage: null,
                source: "tennisabstract",
                sourceUrl: href.startsWith("http") ? href : `https://www.tennisabstract.com${href}`,
                scrapedAt: new Date().toISOString(),
            });
        });

        // De-dup by tournamentName
        const seen = new Set();
        const unique = [];
        for (const tmt of tournaments) {
            const key = tmt.tournamentName;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(tmt);
        }

        console.log(`[TournamentScraper] Successfully parsed ${unique.length} active tournaments.`);
        return unique.slice(0, 50);
    } catch (err) {
        console.warn(`[TournamentScraper] Failed to fetch current tournaments: ${err.message}`);
        return [];
    }
}

module.exports = {
    fetchCurrentTournamentsFromTennisAbstract,
};
