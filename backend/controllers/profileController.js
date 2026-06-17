const profileService = require("../services/profileService");

async function getPlayerProfile(req, res) {
    try {
        const { playerId } = req.params;
        const data = await profileService.getPlayerProfile(playerId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getLivePlayerProfile(req, res) {
    try {
        const { playerId } = req.params;
        const data = await profileService.getLiveProfile(playerId);
        if (!data) {
            return res.status(404).json({ error: "Live player profile not found." });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getPlayerForm(req, res) {
    try {
        const { playerId } = req.params;
        const data = await profileService.getPlayerForm(playerId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getSurfaceStats(req, res) {
    try {
        const { playerId } = req.params;
        const data = await profileService.getSurfaceStats(playerId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getTrendStats(req, res) {
    try {
        const { playerId } = req.params;
        const data = await profileService.getTrendStats(playerId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    getPlayerProfile,
    getLivePlayerProfile,
    getPlayerForm,
    getSurfaceStats,
    getTrendStats
};