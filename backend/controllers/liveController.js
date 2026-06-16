const liveMatchService = require("../services/liveMatchService");
const tournamentService = require("../services/tournamentService");
const rankingService = require("../services/rankingService");
const historyService = require("../services/historyService");

function getQueryName(req) {
    const name = req.query?.name || req.params?.name;
    return name;
}

async function getLatestMatches(req, res, next) {
    try {
        const name = getQueryName(req);
        const limit = Number(req.query?.limit || 10);
        const data = await liveMatchService.fetchAndGetLatestMatches({ name, limit });
        res.json(data);
    } catch (err) {
        next(err);
    }
}

async function getLast10Matches(req, res, next) {
    try {
        const name = getQueryName(req);
        const data = await liveMatchService.getLastNMatches({ name, n: 10 });
        res.json(data);
    } catch (err) {
        next(err);
    }
}

async function getCurrentTournaments(req, res, next) {
    try {
        const data = await tournamentService.getCurrentTournaments({ forceRefresh: req.query?.refresh === "true" });
        res.json(data);
    } catch (err) {
        next(err);
    }
}

async function getLatestRankings(req, res, next) {
    try {
        const tour = (req.query?.tour || "ATP").toUpperCase();
        const data = await rankingService.getLatestRankings({ tour, forceRefresh: req.query?.refresh === "true" });
        res.json(data);
    } catch (err) {
        next(err);
    }
}

async function backfillPlayerHistory(req, res, next) {
    try {
        const nameOrSlug = req.body?.name || req.body?.slug || req.query?.name || req.query?.slug;
        const years = Number(req.body?.years || req.query?.years || 7);

        if (!nameOrSlug || !String(nameOrSlug).trim()) {
            return res.status(400).json({ error: "Missing required field: name (player name or slug)" });
        }

        const result = await historyService.backfillPlayerHistory({ nameOrSlug, yearsBack: years });
        res.json(result);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getLatestMatches,
    getLast10Matches,
    getCurrentTournaments,
    getLatestRankings,
    backfillPlayerHistory,
};

