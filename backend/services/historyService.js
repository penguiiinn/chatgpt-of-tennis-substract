const { backfillPlayerHistoryFromTennisAbstract } = require("../scraper/historyScraper");
const liveDb = require("../data/liveDb");

async function backfillPlayerHistory({ nameOrSlug, yearsBack }) {
    const result = await backfillPlayerHistoryFromTennisAbstract({ nameOrSlug, yearsBack: yearsBack || 7 });
    // historyScraper is expected to already upsert into liveDb.
    return result || { ok: false };
}

module.exports = {
    backfillPlayerHistory,
};

