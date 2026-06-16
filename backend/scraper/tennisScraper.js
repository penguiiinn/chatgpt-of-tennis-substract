const axios = require("axios");
const cheerio = require("cheerio");
const { getPlayerCache } = require("./searchScraper");

// Helper to convert country code to name and flag emoji
function getCountryDetails(code) {
  if (!code) return { name: "N/A", flag: "🏳️" };
  const map = {
    "SRB": { name: "Serbia", flag: "🇷🇸" },
    "ESP": { name: "Spain", flag: "🇪🇸" },
    "POL": { name: "Poland", flag: "🇵🇱" },
    "ITA": { name: "Italy", flag: "🇮🇹" },
    "RUS": { name: "Russia", flag: "🇷🇺" },
    "USA": { name: "USA", flag: "🇺🇸" },
    "FRA": { name: "France", flag: "🇫🇷" },
    "GER": { name: "Germany", flag: "🇩🇪" },
    "GBR": { name: "Great Britain", flag: "🇬🇧" },
    "AUS": { name: "Australia", flag: "🇦🇺" },
    "CAN": { name: "Canada", flag: "🇨🇦" },
    "GRE": { name: "Greece", flag: "🇬🇷" },
    "SUI": { name: "Switzerland", flag: "🇨🇭" },
    "CRO": { name: "Croatia", flag: "🇭🇷" },
    "CZE": { name: "Czechia", flag: "🇨🇿" },
    "DEN": { name: "Denmark", flag: "🇩🇰" },
    "KAZ": { name: "Kazakhstan", flag: "🇰🇿" },
    "JPN": { name: "Japan", flag: "🇯🇵" },
    "CHN": { name: "China", flag: "🇨🇳" },
    "BRA": { name: "Brazil", flag: "🇧🇷" },
    "ARG": { name: "Argentina", flag: "🇦🇷" },
    "NED": { name: "Netherlands", flag: "🇳🇱" },
    "BEL": { name: "Belgium", flag: "🇧🇪" },
    "CHI": { name: "Chile", flag: "🇨🇱" },
    "UKR": { name: "Ukraine", flag: "🇺🇦" },
    "ROU": { name: "Romania", flag: "🇷🇴" },
    "BLR": { name: "Belarus", flag: "🇧🇾" },
    "LAT": { name: "Latvia", flag: "🇱🇻" },
    "TUN": { name: "Tunisia", flag: "🇹🇳" },
    "IND": { name: "India", flag: "🇮🇳" },
    "SWE": { name: "Sweden", flag: "🇸🇪" },
    "NOR": { name: "Norway", flag: "🇳🇴" },
    "AUT": { name: "Austria", flag: "🇦🇹" },
    "CZE": { name: "Czech Republic", flag: "🇨🇿" }
  };
  return map[code.toUpperCase()] || { name: code, flag: "🏳️" };
}

function calculateAge(dobString) {
  if (!dobString || dobString.length < 8) return "N/A";
  const year = parseInt(dobString.substring(0, 4), 10);
  const month = parseInt(dobString.substring(4, 6), 10) - 1;
  const day = parseInt(dobString.substring(6, 8), 10);
  const birthDate = new Date(year, month, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear = (
    today.getMonth() > birthDate.getMonth() || 
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  );
  if (!hasHadBirthdayThisYear) {
    age--;
  }
  return age;
}

function formatHeight(cm) {
  if (!cm || isNaN(cm)) return "N/A";
  const inchesTotal = Math.round(cm / 2.54);
  const feet = Math.floor(inchesTotal / 12);
  const inches = inchesTotal % 12;
  return `${feet}'${inches}" (${cm} cm)`;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Scrape all available Tennis Abstract data for a player based on a slug or URL.
 * @param {string} slugOrUrl
 */
const scrapePlayerProfile = async (slugOrUrl) => {
  try {
    let slug = "";
    let isWta = false;
    let url = "";

    // Normalize slug or url
    if (slugOrUrl.startsWith("http://") || slugOrUrl.startsWith("https://")) {
      url = slugOrUrl;
      const urlObj = new URL(slugOrUrl);
      slug = urlObj.searchParams.get("p") || "";
      isWta = slugOrUrl.includes("wplayer.cgi") || slugOrUrl.includes("wplayer-classic.cgi");
    } else {
      slug = slugOrUrl.trim().replace(/[\s\-]+/g, "");
      // Query player search cache
      const cache = getPlayerCache() || [];
      const cachedPlayer = cache.find(p => {
        if (!p.url) return false;
        const u = new URL(p.url);
        return (u.searchParams.get("p") || "").toLowerCase() === slug.toLowerCase();
      });

      if (cachedPlayer) {
        url = cachedPlayer.url;
        isWta = cachedPlayer.tour === "WTA";
        // Extract exact case-sensitive slug from cached URL if possible
        const cachedUrlObj = new URL(cachedPlayer.url);
        slug = cachedUrlObj.searchParams.get("p") || slug;
      } else {
        // Fallback guess: default ATP URL, check WTA if it fails or returns empty
        url = `https://www.tennisabstract.com/cgi-bin/player.cgi?p=${slug}`;
        isWta = false;
      }
    }

    if (!slug) {
      throw new Error(`Could not extract player slug from parameter: ${slugOrUrl}`);
    }

    console.log(`[Scraper] Scraping player ${slug} (Tour: ${isWta ? 'WTA' : 'ATP'}, URL: ${url})`);
    
    let html = "";
    let htmlFetchError = null;

    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": UA },
        timeout: 10000
      });
      html = res.data;
    } catch (err) {
      htmlFetchError = err;
    }

    // Double check if player biography data exists in the HTML page.
    // If we guessed ATP but it failed or Biography fullname variable is missing, try WTA page
    const hasFullnameVar = html && html.includes("var fullname =");
    if ((!hasFullnameVar || htmlFetchError) && !slugOrUrl.startsWith("http")) {
      isWta = !isWta;
      const fallbackUrl = isWta
        ? `https://www.tennisabstract.com/cgi-bin/wplayer.cgi?p=${slug}`
        : `https://www.tennisabstract.com/cgi-bin/player.cgi?p=${slug}`;
      
      console.log(`[Scraper] ATP check failed or empty. Trying alternative tour URL: ${fallbackUrl}`);
      try {
        const res = await axios.get(fallbackUrl, {
          headers: { "User-Agent": UA },
          timeout: 10000
        });
        html = res.data;
        url = fallbackUrl;
      } catch (err) {
        console.warn(`[Scraper] Alternative tour URL fetch also failed: ${err.message}`);
      }
    }

    // Parse CGI variables from the page HTML
    const getValue = (varName, isString = true) => {
      const regex = new RegExp(`var\\s+${varName}\\s*=\\s*['"]?([^'";\\r\\n]+)['"]?`, "i");
      const match = html.match(regex);
      return match ? (isString ? match[1].trim() : parseFloat(match[1])) : null;
    };

    const fullname = getValue("fullname") || slug.replace(/([A-Z])/g, ' $1').trim();
    const dob = getValue("dob");
    const ht = getValue("ht", false);
    const hand = getValue("hand") || "R";
    const backhand = getValue("backhand") || "2";
    const countryCode = getValue("country") || "USA";
    const currentrank = getValue("currentrank", false) || 999;
    const peakrank = getValue("peakrank", false) || 999;
    const eloRating = getValue("elo_rating", false) || 1500;

    // Fetch the JS Match History / Splits fragment
    const fragUrl = `https://www.tennisabstract.com/jsfrags/${slug}.js`;
    console.log(`[Scraper] Fetching JS stats fragment from: ${fragUrl}`);
    const fragRes = await axios.get(fragUrl, {
      headers: { "User-Agent": UA },
      timeout: 10000
    });

    // Extract player_frag string using safe regex parsing instead of eval
    const fragMatch = fragRes.data.match(/var\s+player_frag\s*=\s*`([\s\S]*?)`;/);
    if (!fragMatch) {
      throw new Error(`Failed to extract player_frag from JS fragment for ${slug}`);
    }
    const player_frag = fragMatch[1];
    
    const $ = cheerio.load(player_frag);

    // 1. Surface Elos from year-end-rankings table
    let hardElo = eloRating;
    let clayElo = eloRating;
    let grassElo = eloRating;

    $("#year-end-rankings tbody tr").first().each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 11) {
        hardElo = parseInt(tds.eq(6).text().trim(), 10) || eloRating;
        clayElo = parseInt(tds.eq(8).text().trim(), 10) || eloRating;
        grassElo = parseInt(tds.eq(10).text().trim(), 10) || eloRating;
      }
    });

    // 2. Season (YTD) & Career general records
    let careerWL = "0-0";
    let careerWinPct = 50.0;
    let ytdWL = "0-0";
    let ytdWinPct = 50.0;

    let careerHoldPct = 75;
    let careerBreakPct = 20;
    let acesPct = 5.0;
    let doubleFaultsPct = 4.0;
    let firstServePct = 60;
    let firstServeWonPct = 65;
    let secondServeWonPct = 48;
    let returnPointsWon = 40;
    let careerTbPct = 50.0;

    $("#tour-years tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const year = tds.first().text().trim();
      if (year === "Career") {
        careerWL = `${tds.eq(2).text().trim()}-${tds.eq(3).text().trim()}`;
        careerWinPct = parseFloat(tds.eq(4).text().trim()) || 50.0;
        careerHoldPct = parseFloat(tds.eq(12).text().trim()) || 75;
        careerBreakPct = parseFloat(tds.eq(13).text().trim()) || 20;
        acesPct = parseFloat(tds.eq(14).text().trim()) || 5.0;
        doubleFaultsPct = parseFloat(tds.eq(15).text().trim()) || 4.0;
        firstServePct = parseFloat(tds.eq(16).text().trim()) || 60;
        firstServeWonPct = parseFloat(tds.eq(17).text().trim()) || 65;
        secondServeWonPct = parseFloat(tds.eq(18).text().trim()) || 48;
        returnPointsWon = parseFloat(tds.eq(20).text().trim()) || 40;
        careerTbPct = parseFloat(tds.eq(10).text().trim()) || 50.0;
      } else if (i === 0) {
        ytdWL = `${tds.eq(2).text().trim()}-${tds.eq(3).text().trim()}`;
        ytdWinPct = parseFloat(tds.eq(4).text().trim()) || 50.0;
      }
    });

    // 3. Recent 10 Matches
    const recentMatches = [];
    $("#recent-results tbody tr").slice(0, 10).each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 8) {
        const date = tds.eq(0).text().trim();
        const tournament = tds.eq(1).text().trim();
        const surface = tds.eq(2).text().trim();
        const matchDetailsCell = tds.eq(6);
        const score = tds.eq(7).text().trim();

        let result = "win";
        const cellHtml = matchDetailsCell.html() || "";
        const cellText = matchDetailsCell.text().trim();
        if (cellText.includes(" d. ")) {
          const parts = cellHtml.split(" d. ");
          if (parts[1] && parts[1].includes("<b>")) {
            result = "loss";
          }
        }

        let opponent = "";
        matchDetailsCell.find("a").each((j, a) => {
          const href = $(a).attr("href") || "";
          if (href.includes("player.cgi") || href.includes("wplayer.cgi")) {
            opponent = $(a).text().trim();
          }
        });

        recentMatches.push({
          opponent: opponent || "Unknown Rival",
          surface: surface || "Hard",
          result,
          score,
          tournament,
          date
        });
      }
    });

    // 4. Surface splits parsing
    const parseSurfaceRow = (tableSelector, splitName) => {
      let splitRow = null;
      $(tableSelector + " tbody tr").each((i, tr) => {
        const split = $(tr).find("td").first().text().trim();
        if (split.toLowerCase() === splitName.toLowerCase()) {
          splitRow = tr;
        }
      });

      if (!splitRow) return null;

      const tds = $(splitRow).find("td");
      const wins = parseInt(tds.eq(2).text().trim(), 10) || 0;
      const losses = parseInt(tds.eq(3).text().trim(), 10) || 0;
      const winPct = parseFloat(tds.eq(4).text().trim()) || 0;
      const holdPct = parseFloat(tds.eq(12).text().trim()) || 75;
      const breakPct = parseFloat(tds.eq(13).text().trim()) || 20;
      const tiebreakRecord = tds.eq(9).text().trim() || "0-0";

      return {
        winPct,
        holdPct,
        breakPct,
        serveRating: Math.round(holdPct),
        returnRating: Math.round(breakPct * 2),
        tiebreakRecord,
        last52: { wins, losses, winPct }
      };
    };

    const surfaces = {};
    const surfaceNames = ["hard", "clay", "grass", "carpet"];

    surfaceNames.forEach(sName => {
      const careerData = parseSurfaceRow("#career-splits", sName);
      const last52Data = parseSurfaceRow("#last52-splits", sName);

      const winPct = careerData ? careerData.winPct : careerWinPct;
      const holdPct = careerData ? careerData.holdPct : careerHoldPct;
      const breakPct = careerData ? careerData.breakPct : careerBreakPct;
      const tiebreakRecord = careerData ? careerData.tiebreakRecord : "0-0";
      const wins = last52Data ? last52Data.last52.wins : 0;
      const losses = last52Data ? last52Data.last52.losses : 0;
      const last52WinPct = last52Data ? last52Data.last52.winPct : 0;

      let strength = "Average";
      if (winPct >= 80) strength = "Elite";
      else if (winPct >= 65) strength = "Strong";
      else if (winPct >= 50) strength = "Average";
      else strength = "Weak";

      const mappedName = sName === "carpet" ? "indoor" : sName;

      let eloVal = eloRating;
      if (mappedName === "hard" || mappedName === "indoor") eloVal = hardElo;
      else if (mappedName === "clay") eloVal = clayElo;
      else if (mappedName === "grass") eloVal = grassElo;

      surfaces[mappedName] = {
        winPct,
        holdPct,
        breakPct,
        serveRating: Math.round(holdPct),
        returnRating: Math.round(breakPct * 2),
        tiebreakRecord,
        last52: { wins, losses, winPct: last52WinPct },
        strength,
        elo: eloVal
      };
    });

    // If indoor was mapped from carpet and has no data, default to copy hard
    if (surfaces.indoor.winPct === careerWinPct && surfaces.indoor.last52.wins === 0) {
      surfaces.indoor = {
        ...surfaces.hard,
        strength: surfaces.hard.winPct >= 78 ? "Strong" : "Average"
      };
    }

    // Determine Best Surface
    let bestSurface = "Hard Court";
    let maxWinPct = -1;
    ["hard", "clay", "grass", "indoor"].forEach(sKey => {
      if (surfaces[sKey].winPct > maxWinPct) {
        maxWinPct = surfaces[sKey].winPct;
        bestSurface = sKey === "hard" ? "Hard Court" : sKey === "clay" ? "Clay Court" : sKey === "grass" ? "Grass Court" : "Indoor Court";
      }
    });

    // 5. Estimate BP Stats from recent events
    let bpSavedPct = 60;
    let bpConvertedPct = 40;
    let bpSavedSum = 0;
    let bpSavedCount = 0;
    let bpConvSum = 0;
    let bpConvCount = 0;

    $("#recent-events tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 25) {
        const saved = parseFloat(tds.eq(23).text().trim());
        const conv = parseFloat(tds.eq(24).text().trim());
        const matches = parseInt(tds.eq(3).text().trim(), 10) || 0;

        if (!isNaN(saved)) {
          bpSavedSum += saved * matches;
          bpSavedCount += matches;
        }
        if (!isNaN(conv)) {
          bpConvSum += conv * matches;
          bpConvCount += matches;
        }
      }
    });

    if (bpSavedCount > 0) bpSavedPct = Math.round(bpSavedSum / bpSavedCount);
    else bpSavedPct = Math.round(55 + (careerHoldPct - 70) * 0.5);

    if (bpConvCount > 0) bpConvertedPct = Math.round(bpConvSum / bpConvCount);
    else bpConvertedPct = Math.round(38 + (careerBreakPct - 20) * 0.4);

    // 6. Count total career titles
    let titlesTotal = 0;
    $("#tour-years tbody tr").each((i, tr) => {
      const best = $(tr).find("td").last().text().trim();
      if (best.startsWith("W")) {
        const match = best.match(/(\d+)x/);
        titlesTotal += match ? parseInt(match[1], 10) : 1;
      }
    });

    const top10Data = parseSurfaceRow("#career-splits", "vs Top 10");
    const top10WinPct = top10Data ? top10Data.winPct : 0.0;

    const countryDetails = getCountryDetails(countryCode);
    const handedness = hand === "L" ? "Left-Handed" : "Right-Handed";
    const backhandType = backhand === "1" ? "One-Handed" : "Two-Handed";

    // Build the dynamic bio summary text
    const bioSummary = `${fullname} is a ${handedness} player from ${countryDetails.name} currently ranked #${currentrank} with a peak rank of #${peakrank}. ${fullname} has an overall win rate of ${careerWinPct}% with an Elo rating of ${eloRating}. Strongest on ${bestSurface}.`;

    const profile = {
      overview: {
        name: fullname,
        age: calculateAge(dob),
        nationality: countryDetails.name,
        flag: countryDetails.flag,
        handedness: `${handedness} (${backhandType} Backhand)`,
        backhand: backhandType,
        height: formatHeight(ht),
        coach: "Coaching Team",
        currentRank: currentrank,
        peakRank: peakrank,
        elo: eloRating,
        recentForm: recentMatches.map(m => m.result === "win" ? "W" : "L"),
        careerWinLoss: careerWL,
        careerWinPct,
        ytdWinLoss: ytdWL,
        ytdWinPct,
        prizeMoney: "N/A",
        titlesTotal,
        tiebreakPct: careerTbPct,
        top10WinPct
      },
      surfaces,
      bestSurface,
      recentMatches,
      serve: {
        firstServePct: { value: firstServePct, tourAvg: 60, explanation: "Percentage of first serves that land in the service box." },
        firstServeWonPct: { value: firstServeWonPct, tourAvg: isWta ? 65 : 70, explanation: "Percentage of points won when the first serve lands in." },
        secondServeWonPct: { value: secondServeWonPct, tourAvg: isWta ? 48 : 50, explanation: "Percentage of points won on second serve." },
        acesPct: { value: acesPct, tourAvg: isWta ? 4.0 : 7.0, explanation: "Percentage of service points that are aces." },
        doubleFaultsPct: { value: doubleFaultsPct, tourAvg: 4.5, explanation: "Percentage of service points that are double faults." },
        breakPointsSavedPct: { value: bpSavedPct, tourAvg: isWta ? 58 : 60, explanation: "Percentage of break points faced that were saved." }
      },
      returnAnalytics: {
        returnPointsWon: { value: returnPointsWon, tourAvg: isWta ? 40 : 38, explanation: "Percentage of return points won." },
        breakConversion: { value: bpConvertedPct, tourAvg: isWta ? 42 : 40, explanation: "Percentage of break points converted into breaks." },
        returnGamesWon: { value: careerBreakPct, tourAvg: isWta ? 25 : 24, explanation: "Percentage of return games won (broke opponent's serve)." }
      },
      strengthMeter: {
        serve: Math.round(careerHoldPct),
        return: Math.round(careerBreakPct * 2),
        consistency: Math.round(careerWinPct),
        pressurePoints: Math.round((careerWinPct + bpSavedPct) / 2),
        surfaceAdaptability: Math.round(92 - Math.abs(surfaces.hard.winPct - surfaces.clay.winPct) * 0.4)
      },
      aiSummary: bioSummary,
      predictions: {} // Populated dynamically in playerService
    };

    return profile;
  } catch (error) {
    console.error(`[Scraper Error] Failed to scrape full profile from ${slugOrUrl}:`, error.message);
    throw error;
  }
};

module.exports = {
  scrapePlayerProfile
};
