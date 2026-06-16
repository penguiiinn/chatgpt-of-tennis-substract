// =========================================================================
// AceIntel Live Data Store (file-backed JSON)
// =========================================================================
// This is intentionally lightweight (no extra npm deps). It supports:
// - normalized inserts/updates
// - TTL-driven read helpers
// - reusable services for future prediction engine

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data", "live");

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function fileFor(name) {
    ensureDir();
    return path.join(DATA_DIR, `${name}.json`);
}

function readJson(name, fallback) {
    const f = fileFor(name);
    try {
        if (!fs.existsSync(f)) return fallback;
        const raw = fs.readFileSync(f, "utf8");
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function writeJson(name, value) {
    const f = fileFor(name);
    fs.writeFileSync(f, JSON.stringify(value, null, 2), "utf8");
}

function nowMs() {
    return Date.now();
}

// =======================
// Collections
// =======================

function getState() {
    return readJson("state", {
        meta: {
            updatedAt: null,
        },
        players: {},
        matches: [],
        tournaments: [],
        rankings: [],
        caches: {
            playerLatestMatches: {}, // { [playerKey]: { updatedAt, matches: [] } }
        },
    });
}

function saveState(state) {
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    writeJson("state", state);
}

// =======================
// Player identity
// =======================

function upsertPlayer({ playerKey, displayName, tour, slugUrl, createdAtIso }) {
    const state = getState();
    state.players = state.players || {};

    const existing = state.players[playerKey];
    if (existing) {
        state.players[playerKey] = {
            ...existing,
            displayName: displayName || existing.displayName,
            tour: tour || existing.tour,
            slugUrl: slugUrl || existing.slugUrl,
            lastSeenAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    } else {
        state.players[playerKey] = {
            playerKey,
            displayName,
            tour: tour || null,
            slugUrl: slugUrl || null,
            createdAt: createdAtIso || new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    saveState(state);
    return state.players[playerKey];
}

// =======================
// Matches
// =======================

function matchIdentity({ playerKey, matchDate, opponent, event }) {
    return [playerKey, matchDate || "", opponent || "", event || ""].join("|");
}

function upsertMatches({ playerKey, matches }) {
    const state = getState();
    state.matches = Array.isArray(state.matches) ? state.matches : [];

    const byIdentity = new Map();
    for (const m of state.matches) {
        const id = m.identity;
        if (id) byIdentity.set(id, m);
    }

    for (const m of matches || []) {
        const identity = matchIdentity({
            playerKey,
            matchDate: m.matchDate,
            opponent: m.opponent,
            event: m.event,
        });

        const existing = byIdentity.get(identity);
        const record = {
            identity,
            playerKey,
            matchDate: m.matchDate || null,
            opponent: m.opponent || null,
            event: m.event || null,
            tournament: m.tournament || m.event || null,
            surface: m.surface || null,
            score: m.score || null,
            result: m.result || null,
            stage: m.stage || null,
            source: m.source || "tennisabstract",
            sourceUrl: m.sourceUrl || null,
            scrapedAt: m.scrapedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Optional extra fields for future prediction features:
            meta: m.meta || {},
        };

        if (existing) {
            Object.assign(existing, record);
        } else {
            state.matches.push(record);
        }
    }

    saveState(state);
    return true;
}

function getLastMatchesForPlayer({ playerKey, limit }) {
    const state = getState();
    const matches = (state.matches || [])
        .filter(m => m.playerKey === playerKey)
        .sort((a, b) => {
            const da = a.matchDate ? new Date(a.matchDate).getTime() : 0;
            const db = b.matchDate ? new Date(b.matchDate).getTime() : 0;
            return db - da;
        });

    return matches.slice(0, limit || 10);
}

function getPlayerTournamentParticipation({ playerKey }) {
    const state = getState();
    const tournaments = (state.tournaments || []).filter(t => t.playerKey === playerKey);
    // Sort by start date desc
    tournaments.sort((a, b) => {
        const sa = a.startDate ? new Date(a.startDate).getTime() : 0;
        const sb = b.startDate ? new Date(b.startDate).getTime() : 0;
        return sb - sa;
    });
    return tournaments;
}

function upsertTournaments({ playerKey, tournaments }) {
    const state = getState();
    state.tournaments = Array.isArray(state.tournaments) ? state.tournaments : [];

    const existingKey = new Set(state.tournaments.map(t => t.identity).filter(Boolean));
    for (const t of tournaments || []) {
        const identity = [playerKey, t.tournamentName, t.startDate].join("|");
        if (existingKey.has(identity)) continue;

        state.tournaments.push({
            identity,
            playerKey,
            tournamentName: t.tournamentName || null,
            category: t.category || null,
            startDate: t.startDate || null,
            endDate: t.endDate || null,
            status: t.status || null,
            stage: t.stage || null,
            source: t.source || "tennisabstract",
            sourceUrl: t.sourceUrl || null,
            scrapedAt: t.scrapedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    saveState(state);
    return true;
}

function upsertRankingsSnapshot({ tour, asOfDate, rankingJson }) {
    const state = getState();
    state.rankings = Array.isArray(state.rankings) ? state.rankings : [];

    const identity = [tour || "", asOfDate || ""].join("|");
    const existing = state.rankings.find(r => r.identity === identity);
    if (existing) {
        existing.rankingJson = rankingJson;
        existing.updatedAt = new Date().toISOString();
    } else {
        state.rankings.push({
            identity,
            tour: tour || null,
            asOfDate: asOfDate || null,
            rankingJson: rankingJson || null,
            source: "tennisabstract",
            scrapedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    saveState(state);
    return true;
}

function getLatestRankingsSnapshot({ tour }) {
    const state = getState();
    const list = (state.rankings || [])
        .filter(r => (tour ? r.tour === tour : true))
        .sort((a, b) => {
            const da = a.asOfDate ? new Date(a.asOfDate).getTime() : 0;
            const db = b.asOfDate ? new Date(b.asOfDate).getTime() : 0;
            return db - da;
        });
    return list[0] || null;
}

// =======================
// Cache helpers
// =======================

function getPlayerLatestMatchesCache({ playerKey }) {
    const state = getState();
    const entry = state.caches?.playerLatestMatches?.[playerKey];
    return entry || null;
}

function setPlayerLatestMatchesCache({ playerKey, matches }) {
    const state = getState();
    state.caches = state.caches || {};
    state.caches.playerLatestMatches = state.caches.playerLatestMatches || {};
    state.caches.playerLatestMatches[playerKey] = {
        updatedAt: new Date().toISOString(),
        matches: matches || [],
    };
    saveState(state);
}

module.exports = {
    getState,
    upsertPlayer,
    upsertMatches,
    getLastMatchesForPlayer,
    upsertTournaments,
    getPlayerTournamentParticipation,
    upsertRankingsSnapshot,
    getLatestRankingsSnapshot,
    getPlayerLatestMatchesCache,
    setPlayerLatestMatchesCache,
    matchIdentity,
    nowMs,
};

