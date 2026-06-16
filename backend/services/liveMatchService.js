const liveDb = require("../data/liveDb");
const { resolvePlayerKey, getPlayerProfile } = require("./playerService");

const { fetchLatestMatchesFromTennisAbstract } = require("../scraper/liveMatchesScraper");

function normalizeName(name) {
    return (name || "").trim();
}

async function ensurePlayerInDb({ nameOrSlug }) {
    const key = resolvePlayerKey(nameOrSlug);
    const profile = await getPlayerProfile(key || nameOrSlug);
    if (!profile?.overview?.name) return null;

    const playerKey = profile.overview.name;
    liveDb.upsertPlayer({
        playerKey,
        displayName: profile.overview.name,
        tour: null,
        slugUrl: null,
    });

    return { playerKey, profile };
}

async function fetchAndStoreLatestMatches({ name, limit }) {
    const playerName = normalizeName(name);
    if (!playerName) {
        return { matches: [], source: "live" };
    }

    const key = resolvePlayerKey(playerName) || playerName;

    // Cache read first (latest matches)
    const cache = liveDb.getPlayerLatestMatchesCache({ playerKey: key });
    if (cache?.matches?.length) {
        return {
            playerKey: key,
            matches: (cache.matches || []).slice(0, limit || 10),
            cached: true,
            updatedAt: cache.updatedAt || null,
            source: "liveDb-cache",
        };
    }

    await ensurePlayerInDb({ nameOrSlug: key });

    const latestMatches = await fetchLatestMatchesFromTennisAbstract({
        nameOrSlug: key,
        limit: limit || 10,
    });

    liveDb.upsertMatches({ playerKey: key, matches: latestMatches || [] });
    liveDb.setPlayerLatestMatchesCache({
        playerKey: key,
        matches: (latestMatches || []).slice(0, limit || 10),
    });

    return {
        playerKey: key,
        matches: (latestMatches || []).slice(0, limit || 10),
        cached: false,
        updatedAt: new Date().toISOString(),
        source: "tennisabstract",
    };
}

async function getLastNMatches({ name, n }) {
    const playerName = normalizeName(name);
    if (!playerName) return { playerKey: null, matches: [], source: "liveDb" };

    const key = resolvePlayerKey(playerName) || playerName;
    const matches = liveDb.getLastMatchesForPlayer({ playerKey: key, limit: n || 10 });

    return {
        playerKey: key,
        matches,
        cached: true,
        source: "liveDb",
    };
}

module.exports = {
    fetchAndGetLatestMatches: fetchAndStoreLatestMatches,
    getLastNMatches,
};

