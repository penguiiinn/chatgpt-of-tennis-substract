const liveDb = require("../data/liveDb");
const { fetchLatestRankingsFromTennisAbstract } = require("../scraper/rankingsScraper");

function asTour(t) {
    const v = (t || "ATP").toString().toUpperCase();
    if (v === "WTA" || v === "ATP") return v;
    return "ATP";
}

async function getLatestRankings({ tour, forceRefresh }) {
    const t = asTour(tour);
    const snapshot = liveDb.getLatestRankingsSnapshot({ tour: t });

    if (snapshot && snapshot.rankingJson && !forceRefresh) {
        return {
            tour: t,
            asOfDate: snapshot.asOfDate,
            ranking: snapshot.rankingJson,
            source: "liveDb",
            cached: true,
            updatedAt: snapshot.updatedAt || null,
        };
    }

    const fetched = await fetchLatestRankingsFromTennisAbstract({ tour: t });
    if (!fetched) {
        return {
            tour: t,
            ranking: null,
            source: "tennisabstract",
            cached: false,
        };
    }

    liveDb.upsertRankingsSnapshot({
        tour: t,
        asOfDate: fetched.asOfDate || null,
        rankingJson: fetched.rankingJson,
    });

    return {
        tour: t,
        asOfDate: fetched.asOfDate || null,
        ranking: fetched.rankingJson,
        source: "tennisabstract",
        cached: false,
        updatedAt: new Date().toISOString(),
    };
}

module.exports = {
    getLatestRankings,
};

