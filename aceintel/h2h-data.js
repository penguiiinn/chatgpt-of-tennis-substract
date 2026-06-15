/* ═══════════════════════════════════════════
   H2H COMPARISON DATA — AceIntel
   ═══════════════════════════════════════════ */

// Canonical player key list (must match PROFILE_DB)
const H2H_PLAYERS = [
  "Carlos Alcaraz",
  "Jannik Sinner",
  "Iga Swiatek",
  "Anna Blinkova",
];

// ─── H2H Historical Meetings ──────────────
// Key format: "PlayerA___PlayerB" (alphabetical)
const H2H_MEETINGS = {

  "Carlos Alcaraz___Jannik Sinner": {
    record: { a: 6, b: 4 },   // a = Alcaraz, b = Sinner
    meetings: [
      { winner: "Carlos Alcaraz", score: "6-3 2-6 6-3 6-4", surface: "Clay",  tournament: "Roland Garros F",     date: "Jun 8, 2026" },
      { winner: "Jannik Sinner",  score: "6-4 6-2 6-2",      surface: "Clay",  tournament: "Roland Garros F",     date: "Jun 9, 2025" },
      { winner: "Carlos Alcaraz", score: "6-1 6-3",           surface: "Hard",  tournament: "Miami F",             date: "Mar 31, 2025" },
      { winner: "Jannik Sinner",  score: "7-6 6-2",           surface: "Hard",  tournament: "Australian Open QF",  date: "Jan 22, 2025" },
      { winner: "Carlos Alcaraz", score: "7-6 6-3 6-5",      surface: "Grass", tournament: "Wimbledon F",         date: "Jul 14, 2024" },
      { winner: "Jannik Sinner",  score: "6-3 6-4",           surface: "Clay",  tournament: "Monte Carlo SF",      date: "Apr 13, 2024" },
      { winner: "Carlos Alcaraz", score: "6-1 6-4",           surface: "Hard",  tournament: "Indian Wells QF",     date: "Mar 15, 2024" },
      { winner: "Carlos Alcaraz", score: "6-3 6-7 6-3",      surface: "Grass", tournament: "Wimbledon SF",        date: "Jul 12, 2023" },
      { winner: "Jannik Sinner",  score: "7-5 6-2",           surface: "Hard",  tournament: "US Open QF",          date: "Sep 6, 2022" },
      { winner: "Carlos Alcaraz", score: "6-3 6-4",           surface: "Clay",  tournament: "French Open QF",      date: "Jun 1, 2022" },
    ],
  },

  "Anna Blinkova___Iga Swiatek": {
    record: { a: 3, b: 5 },   // a = Blinkova, b = Świątek
    meetings: [
      { winner: "Iga Swiatek",    score: "6-4 7-5",           surface: "Clay",  tournament: "Roland Garros QF",   date: "Jun 3, 2026" },
      { winner: "Anna Blinkova",  score: "6-3 4-6 7-5",       surface: "Clay",  tournament: "Roland Garros R4",   date: "Jun 2, 2025" },
      { winner: "Iga Swiatek",    score: "6-2 6-1",            surface: "Clay",  tournament: "Rome SF",            date: "May 16, 2025" },
      { winner: "Anna Blinkova",  score: "6-4 6-2",            surface: "Hard",  tournament: "Dubai SF",           date: "Feb 24, 2025" },
      { winner: "Iga Swiatek",    score: "6-3 6-4",            surface: "Hard",  tournament: "Indian Wells R4",    date: "Mar 13, 2025" },
      { winner: "Iga Swiatek",    score: "6-1 6-2",            surface: "Clay",  tournament: "Madrid QF",          date: "May 4, 2024" },
      { winner: "Anna Blinkova",  score: "7-5 6-4",            surface: "Hard",  tournament: "Doha R2",            date: "Feb 14, 2024" },
      { winner: "Iga Swiatek",    score: "6-3 7-5",            surface: "Clay",  tournament: "Rome R4",            date: "May 13, 2023" },
    ],
  },

  "Carlos Alcaraz___Iga Swiatek": {
    record: { a: 0, b: 0 },
    meetings: [],
    note: "Cross-tour — no official meetings"
  },

  "Anna Blinkova___Carlos Alcaraz": {
    record: { a: 0, b: 0 },
    meetings: [],
    note: "Cross-tour — no official meetings"
  },

  "Anna Blinkova___Jannik Sinner": {
    record: { a: 0, b: 0 },
    meetings: [],
    note: "Cross-tour — no official meetings"
  },

  "Iga Swiatek___Jannik Sinner": {
    record: { a: 0, b: 0 },
    meetings: [],
    note: "Cross-tour — no official meetings"
  },
};

// ─── Style Clash ───────────────────────────
const H2H_STYLE = {

  "Carlos Alcaraz___Jannik Sinner": {
    aStyle: "All-Court Magician",
    bStyle: "Precision Baseliner",
    clashPoints: [
      {
        icon: "🎯",
        title: "Drop Shot vs. Speed",
        text: "Alcaraz's drop shots are the best weapon against Sinner's deep positioning, but Sinner's court speed (fastest on tour) often neutralises them. This creates a chess match: Alcaraz tries to pull Sinner forward, Sinner tries to stay back and redirect.",
      },
      {
        icon: "💥",
        title: "Power vs. Consistency",
        text: "Alcaraz hits bigger and creates more winners, but Sinner makes far fewer unforced errors. Sinner essentially waits for Alcaraz's mistakes to mount, while Alcaraz tries to end points before Sinner's wall of consistency kicks in.",
      },
      {
        icon: "🧠",
        title: "Clutch Serve vs. Return",
        text: "Sinner has the highest break-points-saved rate on tour (70%), while Alcaraz converts break points at 46%. This creates explosive tension on every break point — both players raise their level precisely when it matters most.",
      },
      {
        icon: "🏟️",
        title: "Surface Swing",
        text: "Alcaraz dominates on clay (85% win rate) while Sinner is king on hard courts (88%). Grass is close to even. The surface chosen for any given match could swing the contest by 10+ percentage points.",
      },
    ],
  },

  "Anna Blinkova___Iga Swiatek": {
    aStyle: "Aggressive Serve-Baseliner",
    bStyle: "Relentless Counter-Puncher",
    clashPoints: [
      {
        icon: "🎯",
        title: "Big Serve vs. Elite Return",
        text: "Blinkova's serve (8.2% ace rate) is her primary weapon, but Świątek's return game (92 rating, best in women's tennis) neutralises it better than any other player on tour. On hard courts Blinkova can steal free points; on clay the advantage evaporates entirely.",
      },
      {
        icon: "💥",
        title: "Aggressor vs. Wall",
        text: "Blinkova attacks early and tries to end points within 5 shots. Świątek's consistency (94 rating) means she simply absorbs pressure and redirects it. The longer rallies go, the worse it gets for Blinkova.",
      },
      {
        icon: "🧠",
        title: "Pressure Points",
        text: "Blinkova's pressure rating (71) vs Świątek's (86). In tiebreaks and deciding sets, Świątek's mental edge is significant — she converts break points at 52% while Blinkova saves just 62% of break points faced.",
      },
      {
        icon: "🏟️",
        title: "Surface Dependency",
        text: "Blinkova's best realistic win chance is on fast hard courts, where her serve generates more free points and rallies are shorter. On clay, Świątek's 92% win rate makes an upset nearly impossible.",
      },
    ],
  },

  // Fallback for cross-tour matchups
  "Anna Blinkova___Carlos Alcaraz": {
    aStyle: "Aggressive Serve-Baseliner",
    bStyle: "All-Court Magician",
    clashPoints: [
      { icon: "ℹ️", title: "Cross-Tour Matchup", text: "These players compete on different tours and have never met. The comparison is hypothetical, based purely on statistical ratings." },
    ],
  },

  "Anna Blinkova___Jannik Sinner": {
    aStyle: "Aggressive Serve-Baseliner",
    bStyle: "Precision Baseliner",
    clashPoints: [
      { icon: "ℹ️", title: "Cross-Tour Matchup", text: "These players compete on different tours and have never met. The comparison is hypothetical, based purely on statistical ratings." },
    ],
  },

  "Carlos Alcaraz___Iga Swiatek": {
    aStyle: "All-Court Magician",
    bStyle: "Relentless Counter-Puncher",
    clashPoints: [
      { icon: "ℹ️", title: "Cross-Tour Matchup", text: "These players compete on different tours and have never met. The comparison is hypothetical, based purely on statistical ratings." },
    ],
  },

  "Iga Swiatek___Jannik Sinner": {
    aStyle: "Relentless Counter-Puncher",
    bStyle: "Precision Baseliner",
    clashPoints: [
      { icon: "ℹ️", title: "Cross-Tour Matchup", text: "These players compete on different tours and have never met. The comparison is hypothetical, based purely on statistical ratings." },
    ],
  },
};

// ─── Matchup Bars ─────────────────────────
// Values are % advantage for player A on each axis (50 = even)
const H2H_MATCHUP = {

  "Carlos Alcaraz___Jannik Sinner": {
    surface: "Clay",   // assumed surface for bars
    bars: [
      { label: "Serve Advantage",      aVal: 91, bVal: 89 },
      { label: "Return Advantage",     aVal: 88, bVal: 90 },
      { label: "Rally Tolerance",      aVal: 80, bVal: 94 },
      { label: "Clutch Points",        aVal: 89, bVal: 92 },
      { label: "Surface Suitability",  aVal: 92, bVal: 78 },
    ],
    winProb: { a: 58, b: 42 },
    confidence: "Medium",
    reasons: {
      a: ["Clay-court mastery (85% win rate)", "Superior drop-shot disruption", "Greater variety and unpredictability", "Won 6 of 10 H2H meetings"],
      b: ["Fewer unforced errors (21 vs 28)", "Elite clutch performance (92 pressure rating)", "Better tiebreak record (20-5 on hard)", "More consistent serve mechanics"],
    },
    betting: {
      overUnder: "Over 3.5 sets — Both players go deep",
      tiebreakChance: "High (72%) — Matches are often tight",
      upsetProb: "30% for Sinner upset on clay",
      expectedSets: "4–5 sets",
      bestOdds: "Alcaraz slight favourite on clay",
    },
    aiSummary: "Alcaraz holds the H2H edge 6-4 and is the clay-court specialist with an 85% win rate on the surface. His drop shots and lateral speed create problems Sinner's linear game struggles to solve. However, Sinner's unmatched consistency and clutch performance (92 pressure rating, 20-5 tiebreak record on hard) mean he's rarely out of any match. Expect a 4-5 set battle with Alcaraz edging it through his variety, but Sinner's relentless retrieving will push it deep.",
  },

  "Anna Blinkova___Iga Swiatek": {
    surface: "Hard",
    bars: [
      { label: "Serve Advantage",      aVal: 82, bVal: 84 },
      { label: "Return Advantage",     aVal: 76, bVal: 92 },
      { label: "Rally Tolerance",      aVal: 68, bVal: 94 },
      { label: "Clutch Points",        aVal: 71, bVal: 86 },
      { label: "Surface Suitability",  aVal: 80, bVal: 78 },
    ],
    winProb: { a: 32, b: 68 },
    confidence: "Medium",
    reasons: {
      a: ["Hard court advantage (68% win rate)", "Dangerous serve (8.2% ace rate)", "Aggressive return style disrupts rhythm", "Won their last hard-court meeting"],
      b: ["Dominates H2H record 5-3", "Return game neutralises big servers", "Unmatched consistency (94 rating)", "Break conversion (52%) is devastating"],
    },
    betting: {
      overUnder: "Under 2.5 sets — Świątek tends to dominate",
      tiebreakChance: "Low (28%) — Świątek usually breaks through",
      upsetProb: "22% for Blinkova upset on hard court",
      expectedSets: "2–3 sets",
      bestOdds: "Świątek heavy favourite on all surfaces",
    },
    aiSummary: "Świątek's return game (92 rating) is the great neutraliser of Blinkova's serve weapon. On hard courts, Blinkova's 8.2% ace rate can steal free points early, but Świątek's consistency (94) and break conversion (52%) mean she erodes any advantage quickly. Blinkova's best bet is a fast hard court where rallies stay short — she won their last hard-court encounter and has shown she can take a set from Świątek. However, over a full match, Świątek's consistency and pressure rating (86) make her the heavy favourite.",
  },

  "Carlos Alcaraz___Iga Swiatek": {
    surface: "Hard",
    bars: [
      { label: "Serve Advantage",      aVal: 91, bVal: 84 },
      { label: "Return Advantage",     aVal: 88, bVal: 92 },
      { label: "Rally Tolerance",      aVal: 82, bVal: 94 },
      { label: "Clutch Points",        aVal: 89, bVal: 86 },
      { label: "Surface Suitability",  aVal: 91, bVal: 87 },
    ],
    winProb: { a: 55, b: 45 },
    confidence: "Low",
    reasons: {
      a: ["Higher Elo (2150 vs 2210)", "Greater serve power and ace rate", "Drop shot variety disrupts any opponent", "Elite pressure performance (89)"],
      b: ["Best return game in any tour (92)", "Unmatched consistency (94)", "Superior break conversion (52% vs 46%)", "Dominant H2H on paper metrics"],
    },
    betting: {
      overUnder: "Hypothetical — cross-tour",
      tiebreakChance: "High (60%) — two elite players",
      upsetProb: "N/A — cross-tour comparison",
      expectedSets: "3 sets (Best of 3)",
      bestOdds: "Marginal edge for Alcaraz on power metrics",
    },
    aiSummary: "This is a fascinating hypothetical cross-tour matchup. Alcaraz's serve (91 rating) and drop-shot variety give him tools Świątek rarely faces, but Świątek's return game (92) and consistency (94) are arguably the best combined defensive metrics in tennis. On hard courts the metrics are nearly identical, making this a coin flip. Alcaraz's extra serve power and drop-shot disruption give him a marginal edge — but Świątek's consistency means any slight advantage would be relentlessly tested.",
  },

  "Anna Blinkova___Carlos Alcaraz": {
    surface: "Hard",
    bars: [
      { label: "Serve Advantage",      aVal: 82, bVal: 91 },
      { label: "Return Advantage",     aVal: 76, bVal: 88 },
      { label: "Rally Tolerance",      aVal: 68, bVal: 82 },
      { label: "Clutch Points",        aVal: 71, bVal: 89 },
      { label: "Surface Suitability",  aVal: 80, bVal: 91 },
    ],
    winProb: { a: 14, b: 86 },
    confidence: "High",
    reasons: {
      a: ["Hard court specialist (68% win rate)", "Dangerous serve can create free points", "Aggressive style could pressure Alcaraz early"],
      b: ["Elite across all metrics", "Win rate 80%+ on every surface", "Pressure performance (89) far superior", "H2H would be 0-10 hypothetically"],
    },
    betting: {
      overUnder: "Hypothetical — cross-tour",
      tiebreakChance: "Medium (45%)",
      upsetProb: "Very low — massive quality gap",
      expectedSets: "2–3 sets",
      bestOdds: "Alcaraz overwhelming favourite",
    },
    aiSummary: "This cross-tour matchup would be heavily lopsided. Alcaraz dominates every statistical category — his serve (91 vs 82), return (88 vs 76), consistency (82 vs 68), pressure (89 vs 71), and surface adaptability (95 vs 64) are all superior. Blinkova's serve could create a few free points, but Alcaraz's return game would neutralise her advantage quickly. This is the textbook definition of a power gap in tennis analytics.",
  },

  "Anna Blinkova___Jannik Sinner": {
    surface: "Hard",
    bars: [
      { label: "Serve Advantage",      aVal: 82, bVal: 89 },
      { label: "Return Advantage",     aVal: 76, bVal: 90 },
      { label: "Rally Tolerance",      aVal: 68, bVal: 92 },
      { label: "Clutch Points",        aVal: 71, bVal: 92 },
      { label: "Surface Suitability",  aVal: 80, bVal: 96 },
    ],
    winProb: { a: 15, b: 85 },
    confidence: "High",
    reasons: {
      a: ["Aggressive serve style creates early pressure", "Hard court specialist"],
      b: ["Elite hard court metrics (88% win rate)", "Pressure rating (92) — highest on any tour", "Return game (90) smothers big servers", "Tiebreak record 20-5 on hard courts"],
    },
    betting: {
      overUnder: "Hypothetical — cross-tour",
      tiebreakChance: "Low (30%) — Sinner dominates",
      upsetProb: "Very low — cross-tour quality gap",
      expectedSets: "2–3 sets",
      bestOdds: "Sinner heavy favourite",
    },
    aiSummary: "Sinner's hard-court dominance (88% win rate, 96 surface rating) creates an overwhelming advantage in this hypothetical matchup. His pressure performance (92) and tiebreak record (20-5) mean Blinkova's best scenarios — tight tiebreaks — are actually Sinner's strongest moments. Blinkova's serve would generate some aces, but Sinner's return game (90 rating) is world-class and would quickly suppress her serve advantage.",
  },

  "Iga Swiatek___Jannik Sinner": {
    surface: "Hard",
    bars: [
      { label: "Serve Advantage",      aVal: 84, bVal: 89 },
      { label: "Return Advantage",     aVal: 92, bVal: 90 },
      { label: "Rally Tolerance",      aVal: 94, bVal: 92 },
      { label: "Clutch Points",        aVal: 86, bVal: 92 },
      { label: "Surface Suitability",  aVal: 87, bVal: 96 },
    ],
    winProb: { a: 42, b: 58 },
    confidence: "Low",
    reasons: {
      a: ["Best return game (92) vs Sinner's elite serve", "Unmatched consistency (94) matches Sinner's", "Clay dominance (92% win rate) unparalleled", "Break conversion (52%) is extraordinary"],
      b: ["Hard court supremacy (88% win rate)", "Pressure rating (92) — highest on any tour", "Tiebreak record 20-5 on hard courts", "Superior surface adaptability (85 vs 78)"],
    },
    betting: {
      overUnder: "Hypothetical — cross-tour",
      tiebreakChance: "High (65%) — two elite baseliners",
      upsetProb: "N/A — cross-tour comparison",
      expectedSets: "3 sets",
      bestOdds: "Sinner narrow favourite on hard courts",
    },
    aiSummary: "The most statistically compelling cross-tour matchup in modern tennis. Sinner holds a narrow edge on hard courts where his serve (89 vs 84) and surface suitability (96 vs 87) give him a marginal advantage. But Świątek's return game (92 — virtually matching Sinner's serve dominance) and consistency (94 — actually higher than Sinner's 92) make this nearly even. The deciding factor would likely be Sinner's clutch performance (92 vs Świątek's 86) in tiebreaks. On clay, Świątek would be the clear favourite.",
  },
};
