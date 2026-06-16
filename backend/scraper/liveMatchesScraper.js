const axios = require("axios");
const cheerio = require("cheerio");
const { getPlayerCache } = require("./searchScraper");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function resolvePlayerSlug(slugOrUrl) {
    if (!slugOrUrl) return null;

    if (slugOrUrl.startsWith("http://") || slugOrUrl.startsWith("https://")) {
        const u = new URL(slugOrUrl);
        return u.searchParams.get("p") || null;
    }

    const cache = getPlayerCache() || [];
    const slugNorm = slugOrUrl.trim().toLowerCase().replace(/[\s\-]+/g, "");
    const cached = cache.find(p => {
        if (!p.url) return false;
        const u = new URL(p.url);
        return (u.searchParams.get("p") || "").toLowerCase() === slugNorm;
    });
    if (cached) {
        const cachedUrlObj = new URL(cached.url);
        return cachedUrlObj.searchParams.get("p") || null;
    }

    // fallback
    return slugOrUrl.trim().replace(/[\s\-]+/g, "");
}

function parseRecentResultsFromPlayerFrag($, { limit }) {
    const out = [];
    const rows = $("#recent-results tbody tr").toArray().slice(0, limit || 10);

    for (const tr of rows) {
        const tds = $(tr).find("td");
        if (!tds || tds.length < 8) continue;

        const date = tds.eq(0).text().trim();
        const tournament = tds.eq(1).text().trim();
        const surface = tds.eq(2).text().trim();

        const matchDetailsCell = tds.eq(6);
        const score = tds.eq(7).text().trim();

        // Result detection is heuristic based on the scraped cell HTML.
        let result = "win";
        const cellHtml = matchDetailsCell?.html?.() || "";
        const cellText = matchDetailsCell?.text?.() || "";
        if (cellText.includes(" d. ")) {
            const parts = cellHtml.split(" d. ");
            if (parts[1] && parts[1].includes("<b>")) result = "loss";
        }

        let opponent = "Unknown Rival";
        matchDetailsCell
            ?.find("a")
            ?.each?.((_j, a) => {
                const href = $(a).attr("href") || "";
                if (href.includes("player.cgi") || href.includes("wplayer.cgi")) {
                    opponent = $(a).text().trim() || opponent;
                }
            });

        out.push({
            opponent,
            surface: surface || "Hard",
            result,
            score: score || null,
            tournament: tournament || null,
            event: tournament || null,
            stage: null,
            matchDate: date || null,
            source: "tennisabstract",
            sourceUrl: null,
        });
    }

    return out;
}

async function fetchLatestMatchesFromTennisAbstract({ nameOrSlug, limit }) {
    const slug = resolvePlayerSlug(nameOrSlug);
    if (!slug) return null;

    const fragUrl = `https://www.tennisabstract.com/jsfrags/${slug}.js`;
    const res = await axios.get(fragUrl, {
        headers: { "User-Agent": UA },
        timeout: 15000,
    });

    const fragMatch = res.data.match(/var\s+player_frag\s*=\s*`([\s\S]*?)`;/);
    if (!fragMatch) throw new Error(`Failed to extract player_frag from Tennis Abstract for ${slug}`);

    const player_frag = fragMatch[1];
    const $ = cheerio.load(player_frag);

    const matches = parseRecentResultsFromPlayerFrag($, { limit });
    return matches;
}

module.exports = {
    fetchLatestMatchesFromTennisAbstract,
};

