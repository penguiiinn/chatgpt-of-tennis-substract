const profileService             = require("../services/profileService");
const { analyzeTournament }      = require("../services/tournamentEngine");

/**
 * GET /api/tournament/analyze
 *   ?player=<slug>
 *   &tournament=<tournament name>   (e.g. "Roland Garros", "Wimbledon")
 */
const getTournamentAnalysis = async (req, res) => {
  try {
    const { player: playerId, tournament } = req.query;

    // ── Validate ───────────────────────────────────────────────────────────
    if (!playerId) {
      return res.status(400).json({ error: "player query param is required." });
    }
    if (!tournament) {
      return res.status(400).json({ error: "tournament query param is required." });
    }

    // ── Fetch all player data in parallel ──────────────────────────────────
    const [profile, form, surfaces, trends] = await Promise.all([
      profileService.getPlayerProfile(playerId),
      profileService.getPlayerForm(playerId),
      profileService.getSurfaceStats(playerId),
      profileService.getTrendStats(playerId)
    ]);

    if (!profile) {
      return res.status(404).json({
        error: "Player not found.",
        player: playerId
      });
    }

    // ── Run tournament engine ──────────────────────────────────────────────
    const analysis = analyzeTournament(
      { profile, form, surfaces, trends },
      tournament
    );

    res.json(analysis);

  } catch (err) {
    res.status(500).json({
      error: "Tournament analysis failed.",
      message: err.message
    });
  }
};

module.exports = { getTournamentAnalysis };
