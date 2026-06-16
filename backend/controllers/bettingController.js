const profileService   = require("../services/profileService");
const { predictMatch } = require("../services/predictionEngine");
const { analyzeBet }   = require("../services/bettingEngine");

/**
 * GET /api/betting/analyze
 *   ?playerA=<slug>
 *   &playerB=<slug>
 *   &oddsA=<decimal>     (e.g. 1.65)
 *   &oddsB=<decimal>     (e.g. 2.30)
 *   &surface=<hard|clay|grass>   (optional, default hard)
 */
const getBettingAnalysis = async (req, res) => {
  try {
    const { playerA: idA, playerB: idB, oddsA, oddsB, surface } = req.query;

    // ── Validate inputs ────────────────────────────────────────────────────
    if (!idA || !idB) {
      return res.status(400).json({
        error: "playerA and playerB query params are required."
      });
    }

    const parsedOddsA = parseFloat(oddsA);
    const parsedOddsB = parseFloat(oddsB);

    if (!oddsA || !oddsB || isNaN(parsedOddsA) || isNaN(parsedOddsB) ||
        parsedOddsA <= 1 || parsedOddsB <= 1) {
      return res.status(400).json({
        error: "oddsA and oddsB must be valid decimal odds greater than 1.0 (e.g. 1.65)."
      });
    }

    // ── Fetch player data in parallel ──────────────────────────────────────
    const [profileA, formA, surfacesA, trendsA,
           profileB, formB, surfacesB, trendsB] = await Promise.all([
      profileService.getPlayerProfile(idA),
      profileService.getPlayerForm(idA),
      profileService.getSurfaceStats(idA),
      profileService.getTrendStats(idA),
      profileService.getPlayerProfile(idB),
      profileService.getPlayerForm(idB),
      profileService.getSurfaceStats(idB),
      profileService.getTrendStats(idB)
    ]);

    if (!profileA || !profileB) {
      return res.status(404).json({
        error: "One or both players could not be found.",
        playerA: idA,
        playerB: idB
      });
    }

    // ── Run prediction engine ──────────────────────────────────────────────
    const prediction = predictMatch(
      { profile: profileA, form: formA, surfaces: surfacesA, trends: trendsA, h2h: null },
      { profile: profileB, form: formB, surfaces: surfacesB, trends: trendsB, h2h: null },
      surface || "hard"
    );

    // ── Run betting engine ─────────────────────────────────────────────────
    const bettingAnalysis = analyzeBet(prediction, {
      playerA: parsedOddsA,
      playerB: parsedOddsB
    });

    // ── Return combined response ───────────────────────────────────────────
    res.json({
      match: {
        playerA: profileA.name,
        playerB: profileB.name,
        surface: surface || "hard",
        oddsA: parsedOddsA,
        oddsB: parsedOddsB
      },
      prediction,
      betting: bettingAnalysis
    });

  } catch (err) {
    res.status(500).json({
      error: "Betting analysis failed.",
      message: err.message
    });
  }
};

module.exports = { getBettingAnalysis };
