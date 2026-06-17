const playerService = require("./playerService");
const liveMatchService = require("./liveMatchService");
const { getLivePlayerProfile } = require("../scraper/multiSourceScraper");

async function getPlayerProfile(playerId) {
    const player = await playerService.getPlayerProfile(playerId);
    if (!player || !player.overview) return null;

    return {
        id: playerId,
        name: player.overview.name,
        rank: player.overview.currentRank || null,
        country: player.overview.nationality || null,
        age: player.overview.age || null,
        hand: player.overview.handedness || null,
        height: player.overview.height || null
    };
}

async function getLiveProfile(playerId) {
    return await getLivePlayerProfile(playerId);
}

async function getPlayerForm(playerId) {
    const player = await playerService.getPlayerProfile(playerId);
    if (!player || !player.overview) return { matches: 0, wins: 0, losses: 0, winRate: "0.0" };

    const { matches } = await liveMatchService.fetchAndGetLatestMatches({ name: player.overview.name, limit: 100 });
    const last10 = (matches || []).slice(0, 10);
    const wins = last10.filter(match => match.result?.toLowerCase().startsWith("w")).length;

    return {
        matches: last10.length,
        wins,
        losses: last10.length - wins,
        winRate: last10.length ? ((wins / last10.length) * 100).toFixed(1) : "0.0"
    };
}

async function getSurfaceStats(playerId) {
    const player = await playerService.getPlayerProfile(playerId);
    if (!player || !player.overview) return { hard: 0, clay: 0, grass: 0 };

    const { matches } = await liveMatchService.fetchAndGetLatestMatches({ name: player.overview.name, limit: 100 });

    const surfaces = {
        hard: 0,
        clay: 0,
        grass: 0
    };

    (matches || []).forEach(match => {
        if (match.surface && surfaces[match.surface.toLowerCase()] !== undefined) {
            surfaces[match.surface.toLowerCase()]++;
        }
    });

    return surfaces;
}

async function getTrendStats(playerId) {
    const player = await playerService.getPlayerProfile(playerId);
    if (!player || !player.overview) return { recentMatches: [], streak: 0, momentum: "normal" };

    const { matches } = await liveMatchService.fetchAndGetLatestMatches({ name: player.overview.name, limit: 100 });
    const recent = (matches || []).slice(0, 5);
    const streak = recent.filter(m => m.result?.toLowerCase().startsWith("w")).length;

    return {
        recentMatches: recent,
        streak,
        momentum: streak >= 3 ? "high" : "normal"
    };
}

module.exports = {
    getPlayerProfile,
    getLiveProfile,
    getPlayerForm,
    getSurfaceStats,
    getTrendStats
};