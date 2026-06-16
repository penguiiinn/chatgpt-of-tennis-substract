const axios = require("axios");
const cheerio = require("cheerio");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function normalizeTour(tour) {
    const t = (tour || "ATP").toString().toUpperCase();
    return t === "WTA" ? "WTA" : "ATP";
}

function extractAsOfDate($) {
    const text = $("body").text();
    const m = text.match(/As of\s*[:\-]?\s*([A-Za-z]+\.\s*\d{1,2},?\s*\d{4})/i);
    return m?.[1] || null;
}

function pickBestTable($) {
    let best = null;
    $("table").each((_i, el) => {
        const headerText = $(el)
            .find("th")
            .toArray()
            .map((th) => $(th).text().toLowerCase())
            .join(" ");
        const score =
            (headerText.includes("rank") ? 3 : 0) +
            (headerText.includes("player") ? 3 : 0) +
            (headerText.includes("points") || headerText.includes("pts") ? 1 : 0);
        if (!best || score > best.score) best = { el, score };
    });
    return best?.el ? $(best.el) : null;
}

function parseRankingTable(table, $) {
    if (!table) return [];
    const rows = table.find("tbody tr");
    const out = [];

    rows.each((_i, tr) => {
        const tds = $(tr).find("td");
        if (!tds || tds.length < 10) return; // Skip non-player rows

        const rankRaw = $(tds[0]).text().trim();
        const rank = parseInt(rankRaw, 10);
        if (isNaN(rank)) return; // Skip rows without a valid numeric rank

        const player = $(tds[1]).text().trim();
        const points = tds.length >= 4 ? $(tds[3]).text().trim() : null; // Index 3 is Elo rating

        let url = null;

        $(tds[1])
            .find("a")
            .each((_j, a) => {
                const href = $(a).attr("href") || "";
                if (href.includes("player.cgi") || href.includes("wplayer.cgi")) {
                    url = href.startsWith("http")
                        ? href
                        : `https://www.tennisabstract.com${href}`;
                }
            });

        if (player) {
            out.push({
                rank: Number.isFinite(rank) ? rank : null,
                player,
                points: points || null,
                url,
            });
        }
    });

    return out;
}

async function fetchLatestRankingsFromTennisAbstract({ tour }) {
    const t = normalizeTour(tour);
    const url =
        t === "WTA"
            ? "https://tennisabstract.com/reports/wta_elo_ratings.html"
            : "https://tennisabstract.com/reports/atp_elo_ratings.html";

    const res = await axios.get(url, {
        headers: { "User-Agent": UA },
        timeout: 15000,
    });

    const $ = cheerio.load(res.data);
    const asOfDate = extractAsOfDate($);
    const table = pickBestTable($);

    return {
        asOfDate,
        rankingJson: {
            tour: t,
            asOfDate,
            players: parseRankingTable(table, $),
            sourceUrl: url,
        },
    };
}

module.exports = {
    fetchLatestRankingsFromTennisAbstract,
};
