const liveDb = require("../data/liveDb");
const { fetchCurrentTournamentsFromTennisAbstract } = require("../scraper/tournamentScraper");

async function getCurrentTournaments({ forceRefresh }) {
    // We store tournaments in liveDb under the state.tournaments collection,
    // but liveDb is keyed by playerKey for participation. For "current tournaments"
    // we can store a pseudo playerKey like "__GLOBAL__".
    const globalPlayerKey = "__GLOBAL__";

    const state = liveDb.getState();
    const cached = (state.tournaments || []).filter(t => t.playerKey === globalPlayerKey);

    if (cached.length && !forceRefresh) {
        // latest by startDate desc
        cached.sort((a, b) => {
            const sa = a.startDate ? new Date(a.startDate).getTime() : 0;
            const sb = b.startDate ? new Date(b.startDate).getTime() : 0;
            return sb - sa;
        });

        return {
            tournaments: cached.map(t => ({
                name: t.tournamentName,
                category: t.category,
                startDate: t.startDate,
                endDate: t.endDate,
                status: t.status,
                stage: t.stage,
                sourceUrl: t.sourceUrl,
            })),
            cached: true,
            updatedAt: state.meta?.updatedAt || null,
            source: "liveDb",
        };
    }

    const fetched = await fetchCurrentTournamentsFromTennisAbstract();
    liveDb.upsertTournaments({
        playerKey: globalPlayerKey,
        tournaments: fetched || [],
    });

    const state2 = liveDb.getState();
    const after = (state2.tournaments || []).filter(t => t.playerKey === globalPlayerKey);

    return {
        tournaments: after.map(t => ({
            name: t.tournamentName,
            category: t.category,
            startDate: t.startDate,
            endDate: t.endDate,
            status: t.status,
            stage: t.stage,
            sourceUrl: t.sourceUrl,
        })),
        cached: false,
        updatedAt: state2.meta?.updatedAt || null,
        source: "tennisabstract",
    };
}

module.exports = {
    getCurrentTournaments,
};

