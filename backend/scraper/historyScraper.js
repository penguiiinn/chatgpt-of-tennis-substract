const axios = require("axios");
const cheerio = require("cheerio");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function toIsoDate(d) {
    if (!d) return null;
    const s = d.toString().trim();
    if (!s) return null;

    // Tennis Abstract often uses: "Jun 2, 2026" or "Jan 1, 2025"
    const m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
    if (m) {
        const dt = new Date(`${m[1]} ${m[2]}, ${m[3]}T00:00:00Z`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }

    // Or ISO-like: 2026-06-02
    const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m2) {
        const dt = new Date(`${m2[1]}-${m2[2]}-${m2[3]}T00:00:00Z`);
        return isNaN(dt.getTime()) ? null : dt.toISOString();
    }

    return null;
}

function guessTourFromUrl(url) {
    const u = (url || "").toLowerCase();
    return u.includes("wplayer.cgi") || u.includes("wplayer-classic.cgi") ? "WTA" : "ATP";
}

/**
 * Fetch historical match rows for a player from Tennis Abstract.
 * Best-effort scraper: parses the "recent-results"-like tables for the full list.
 *
 * Returns normalized matches:
 *  - matchDate (ISO)
 *  - opponent
 *  - event (tournament label)
 *  - tournament (same as event if split not available)
 *  - surface (Hard/Clay/Grass/Indoor/Carpet if available)
 *  - result ('win' | 'loss') from perspective of player
 *  - score
 */
async function fetchPlayerHistoryFromTennisAbstract({ slugOrUrl, limitYears = 7 }) {
    const url =
        slugOrUrl && slugOrUrl.startsWith("http")
            ? slugOrUrl
            : `https://www.tennisabstract.com/cgi-bin/player.cgi?p=${encodeURIComponent(slugOrUrl.trim().replace(/[\s\-]+/g, ""))}`;

    const tour = guessTourFromUrl(url);

    const res = await axios.get(url, {
        headers: { "User-Agent": UA },
        timeout: 20000,
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // Tennis Abstract includes match history in a few places; the most reliable is typically:
    // - #recent-results for last 10 only (already used elsewhere)
    // - but full match list can appear in other tables/links.
    // For this data layer we’ll use the first table that looks like a match-results list and then filter by date.

    const matches = [];

    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - (Number(limitYears) || 7));

    // Heuristic: any table row that includes a date and an opponent link.
    $("table tbody tr").each((_i, tr) => {
        const tds = $(tr).find("td");
        if (!tds || tds.length < 4) return;

        const possibleDate = $(tds[0]).text().trim();
        const iso = toIsoDate(possibleDate);
        if (!iso) return;

        const dt = new Date(iso);
        if (dt.getTime() < cutoff.getTime()) return;

        // opponent might be somewhere near middle columns; try to find the first player link
        let opponent = null;
        let opponentText = null;
        $(tr)
            .find("a")
            .each((_j, a) => {
                const href = $(a).attr("href") || "";
                if (href.includes("player.cgi") || href.includes("wplayer.cgi")) {
                    opponentText = $(a).text().trim();
                }
            });
        opponent = opponentText;

        // Surface: attempt from third td or by searching row text
        const rowText = $(tr).text().toLowerCase();
        let surface = null;
        if (rowText.includes("grass")) surface = "Grass";
        else if (rowText.includes("clay")) surface = "Clay";
        else if (rowText.includes("hard")) surface = "Hard";
        else if (rowText.includes("indoor")) surface = "Indoor";
        else if (rowText.includes("carpet")) surface = "Indoor";

        // Event/tournament: try a td
        let event = null;
        for (let i = 1; i < Math.min(tds.length, 6); i++) {
            const txt = $(tds[i]).text().trim();
            if (txt && txt.length >= 3 && !/^(win|loss|w|l)$/i.test(txt)) {
                event = txt;
                break;
            }
        }

        // Score: attempt to find a cell with score-like patterns
        let score = null;
        for (let i = 0; i < tds.length; i++) {
            const txt = $(tds[i]).text().trim();
            if (txt && txt.match(/\d+-\d+/) && txt.includes(" ") === false) {
                score = txt;
                break;
            }
        }

        // Result: Tennis Abstract often marks win/loss with "d." and player name.
        // Best-effort: if row contains "d." treat as win for perspective player, else loss.
        let result = null;
        const cellHtml = $(tr).html() || "";
        if (cellHtml.includes(" d. ")) result = "win";
        else result = "loss";

        if (!opponent) return;

        matches.push({
            matchDate: iso,
            opponent,
            event: event || null,
            tournament: event || null,
            surface: surface || null,
            score: score || null,
            result,
            tour,
        });
    });

    // De-dup by (matchDate+opponent+event)
    const seen = new Set();
    const deduped = [];
    for (const m of matches) {
        const key = `${m.matchDate || ""}|${m.opponent}|${m.event || ""}|${m.score || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(m);
    }

    // sort by date desc
    deduped.sort((a, b) => (b.matchDate ? new Date(b.matchDate).getTime() : 0) - (a.matchDate ? new Date(a.matchDate).getTime() : 0));

    // return up to a practical cap (history can be large)
    return deduped.slice(0, 5000);
}

module.exports = {
    fetchPlayerHistoryFromTennisAbstract,
};

