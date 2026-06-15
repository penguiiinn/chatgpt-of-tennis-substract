/* ═══════════════════════════════════════════
   AceIntel — Player Profile Logic
   ═══════════════════════════════════════════ */

// ─── API Config & State ─────────────────
const API_BASE = "http://localhost:5000/api";
let currentPlayerKey = null;
let playersList = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Init ───────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Get player from URL param
  const params = new URLSearchParams(window.location.search);
  const playerParam = params.get("player") || "Anna Blinkova";

  await fetchPlayersList();

  // Resolve player key
  currentPlayerKey = resolvePlayerKey(playerParam);
  if (!currentPlayerKey) {
    currentPlayerKey = "Anna Blinkova";
  }

  loadProfile(currentPlayerKey);
  initNav();
  initProfileSearch();
  initPredict();
  initScrollReveal();
});

async function fetchPlayersList() {
  try {
    const res = await fetch(`${API_BASE}/players`);
    if (res.ok) {
      playersList = await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch players list from API, using static fallback.", err);
  }
}

function resolvePlayerKey(query) {
  const keys = (playersList && playersList.length > 0)
    ? playersList.map(p => p.name)
    : Object.keys(PROFILE_DB);
  return keys.find(k => k.toLowerCase() === query.toLowerCase())
    || keys.find(k => k.toLowerCase().includes(query.toLowerCase()));
}

// ═══════════════════════════════════════
// NAV
// ═══════════════════════════════════════
function initNav() {
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");

  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    links.classList.toggle("open");
  });

  $$(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      toggle.classList.remove("active");
      links.classList.remove("open");
    });
  });

  // Active link on scroll
  const sections = $$("section[id]");
  const navLinks = $$('.nav-link[href^="#"]');

  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 200) current = s.id;
    });
    navLinks.forEach(l => {
      l.classList.remove("active");
      if (l.getAttribute("href") === "#" + current) l.classList.add("active");
    });
  });

  // Smooth scroll
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });
}

// ═══════════════════════════════════════
// PROFILE SEARCH
// ═══════════════════════════════════════
function initProfileSearch() {
  const input = $("#profile-search");
  const btn = $("#btn-profile-search");

  btn.addEventListener("click", () => switchPlayer(input.value.trim()));
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") switchPlayer(input.value.trim());
  });
}

function switchPlayer(query) {
  if (!query) return;
  const key = resolvePlayerKey(query);
  if (key) {
    currentPlayerKey = key;
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set("player", key);
    window.history.pushState({}, "", url);
    loadProfile(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    const keys = (playersList && playersList.length > 0)
      ? playersList.map(p => p.name)
      : Object.keys(PROFILE_DB);
    showToast(`Player not found. Try: ${keys.join(", ")}`);
  }
}

// ═══════════════════════════════════════
// LOAD FULL PROFILE
// ═══════════════════════════════════════
async function loadProfile(key) {
  let p = null;
  try {
    const res = await fetch(`${API_BASE}/players/${encodeURIComponent(key)}`);
    if (res.ok) {
      p = await res.json();
    } else {
      p = PROFILE_DB[key];
    }
  } catch (err) {
    console.warn("Failed to fetch player profile from API, using fallback.", err);
    p = PROFILE_DB[key];
  }

  if (!p) return;

  document.title = `${p.overview.name} — AceIntel`;
  renderOverview(p);
  renderSurfaces(p);
  renderMatches(p);
  renderServe(p);
  renderReturn(p);
  renderStrength(p);
  renderAISummary(p);
  populatePredictDropdown(p);
  // Hide prediction result when switching
  const pr = $("#predict-result");
  if (pr) pr.classList.add("hidden");
}

// ═══════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════
function renderOverview(p) {
  const o = p.overview;
  const header = $("#profile-header");

  const formDots = o.recentForm.map(r =>
    `<div class="form-dot ${r.toLowerCase()}"></div>`
  ).join("");

  const wins = parseInt(o.careerWinLoss.split("-")[0]);
  const losses = parseInt(o.careerWinLoss.split("-")[1]);

  header.innerHTML = `
      <div class="profile-top">
        <div class="profile-avatar">${getInitials(o.name)}</div>
        <div class="profile-info">
          <div class="profile-name">${o.name}</div>
          <div class="profile-country">${o.flag} ${o.nationality} • ${o.handedness} • ${o.height}</div>
          <div class="profile-tags">
            <span class="profile-tag">🎾 ${o.coach}</span>
            <span class="profile-tag">${o.titlesTotal} Titles</span>
            <span class="profile-tag form-hot">${o.ytdWinPct}% YTD</span>
          </div>
        </div>
      </div>
      <div class="profile-stats-grid">
        <div class="profile-stat-cell">
          <div class="profile-stat-val">#${o.currentRank}</div>
          <div class="profile-stat-lbl">Current Rank</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">#${o.peakRank}</div>
          <div class="profile-stat-lbl">Peak Rank</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">${o.elo}</div>
          <div class="profile-stat-lbl">Elo Rating</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">${o.careerWinLoss}</div>
          <div class="profile-stat-lbl">Career W-L</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">${o.ytdWinLoss}</div>
          <div class="profile-stat-lbl">YTD W-L</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">${o.age}</div>
          <div class="profile-stat-lbl">Age</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-val">${o.prizeMoney}</div>
          <div class="profile-stat-lbl">Prize Money</div>
        </div>
        <div class="profile-stat-cell">
          <div class="profile-stat-lbl" style="margin-bottom:6px">Recent Form</div>
          <div class="form-dots">${formDots}</div>
        </div>
      </div>
    `;
}

// ═══════════════════════════════════════
// SURFACE INTELLIGENCE
// ═══════════════════════════════════════
function renderSurfaces(p) {
  const banner = $("#best-surface-banner");
  banner.innerHTML = `
      <span class="banner-icon">🏆</span>
      <span class="banner-text">Strongest surface: <span class="banner-highlight">${p.bestSurface}</span></span>
    `;

  const surfaceConfig = [
    { key: "grass", label: "Grass", icon: "🌿", cls: "grass" },
    { key: "clay", label: "Clay", icon: "🧱", cls: "clay" },
    { key: "hard", label: "Hard Court", icon: "🏟️", cls: "hard" },
    { key: "indoor", label: "Indoor", icon: "🏢", cls: "indoor" },
  ];

  const grid = $("#surface-deep-grid");
  grid.innerHTML = surfaceConfig.map((sc, idx) => {
    const s = p.surfaces[sc.key];
    const strengthCls = s.strength.toLowerCase();
    return `
        <div class="surface-deep-card ${sc.cls} reveal" style="transition-delay:${idx * 0.1}s">
          <div class="surface-deep-header">
            <div class="surface-deep-name">
              <div class="surface-deep-icon">${sc.icon}</div>
              ${sc.label}
            </div>
            <span class="surface-strength strength-${strengthCls}">${s.strength}</span>
          </div>
          <div class="surface-deep-rows">
            ${surfaceRow("Win %", s.winPct + "%", s.winPct)}
            ${surfaceRow("Hold %", s.holdPct + "%", s.holdPct)}
            ${surfaceRow("Break %", s.breakPct + "%", s.breakPct)}
            ${surfaceRow("Serve Rating", s.serveRating, s.serveRating)}
            ${surfaceRow("Return Rating", s.returnRating, s.returnRating)}
            <div class="surface-deep-row">
              <span class="sdl">Tiebreak Record</span>
              <span class="sdv">${s.tiebreakRecord}</span>
            </div>
          </div>
          <div class="surface-52w">
            <span class="surface-52w-label">Last 52 Weeks</span>
            <span class="surface-52w-value">${s.last52.wins}W - ${s.last52.losses}L (${s.last52.winPct}%)</span>
          </div>
        </div>
      `;
  }).join("");

  refreshReveal();
}

function surfaceRow(label, display, pct) {
  return `
      <div class="surface-deep-row">
        <span class="sdl">${label}</span>
        <span class="sdv">${display}</span>
      </div>
      <div class="surface-mini-bar">
        <div class="surface-mini-bar-fill" style="width:${Math.min(pct, 100)}%"></div>
      </div>
    `;
}

// ═══════════════════════════════════════
// RECENT MATCHES
// ═══════════════════════════════════════
function renderMatches(p) {
  const wrap = $("#matches-table-wrap");

  wrap.innerHTML = `
      <table class="matches-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Opponent</th>
            <th>Score</th>
            <th>Surface</th>
            <th>Tournament</th>
            <th>Date</th>
            <th style="text-align:right">Analysis</th>
          </tr>
        </thead>
        <tbody>
          ${p.recentMatches.map((m, i) => `
            <tr class="match-row reveal" data-index="${i}" style="transition-delay:${i * 0.05}s">
              <td><span class="match-result-badge ${m.result}">${m.result}</span></td>
              <td style="font-weight:600">${m.opponent}</td>
              <td class="match-score-cell">${m.score}</td>
              <td><span class="match-surface-tag ${m.surface.toLowerCase()}">${m.surface}</span></td>
              <td>${m.tournament}</td>
              <td class="match-date">${m.date}</td>
              <td style="text-align:right"><span class="chevron-icon">▼</span></td>
            </tr>
            <tr class="match-details-row" id="match-details-${i}">
              <td colspan="7">
                <div class="match-details-content" id="match-details-content-${i}"></div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

  // Bind click listeners for row expansion
  $$(".match-row").forEach(row => {
    row.addEventListener("click", () => {
      const index = row.dataset.index;
      const detailsRow = $(`#match-details-${index}`);
      const contentDiv = $(`#match-details-content-${index}`);

      if (row.classList.contains("expanded")) {
        // Collapse
        row.classList.remove("expanded");
        contentDiv.style.maxHeight = "0";
        contentDiv.style.opacity = "0";
        setTimeout(() => {
          detailsRow.classList.remove("open");
        }, 350);
      } else {
        // Collapse any other open rows first
        $$(".match-row.expanded").forEach(otherRow => {
          const otherIdx = otherRow.dataset.index;
          otherRow.classList.remove("expanded");
          const otherContent = $(`#match-details-content-${otherIdx}`);
          if (otherContent) {
            otherContent.style.maxHeight = "0";
            otherContent.style.opacity = "0";
          }
          const otherDetails = $(`#match-details-${otherIdx}`);
          if (otherDetails) {
            setTimeout(() => {
              otherDetails.classList.remove("open");
            }, 350);
          }
        });

        // Generate details content if not loaded yet
        if (!contentDiv.innerHTML.trim()) {
          contentDiv.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted)">Loading stats...</div>`;
          fetch(`${API_BASE}/matches/${encodeURIComponent(p.overview.name)}/stats/${index}`)
            .then(res => res.json())
            .then(details => {
              contentDiv.innerHTML = renderMatchDetailsHtmlFromAPI(details);
            })
            .catch(err => {
              console.warn("Match stats fetch failed, using local seeded generator", err);
              contentDiv.innerHTML = buildMatchDetailsHtml(p, p.recentMatches[index], index);
            });
        }

        // Expand
        row.classList.add("expanded");
        detailsRow.classList.add("open");
        // Force reflow
        contentDiv.offsetHeight;
        contentDiv.style.maxHeight = "500px";
        contentDiv.style.opacity = "1";
      }
    });
  });

  refreshReveal();
}

function renderMatchDetailsHtmlFromAPI(details) {
  const p = details.stats.player;
  const o = details.stats.opponent;
  return `
      <div class="match-details-grid">
        <!-- Stats -->
        <div>
          <h4 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:6px">Match Statistics</h4>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${renderMatchStatRow("Aces", p.aces, o.aces, true)}
            ${renderMatchStatRow("Double Faults", p.doubleFaults, o.doubleFaults, false)}
            ${renderMatchStatRow("1st Serve %", p.firstServeInPct, o.firstServeInPct, true, "%")}
            ${renderMatchStatRow("1st Serve Won %", p.firstServeWonPct, o.firstServeWonPct, true, "%")}
            ${renderMatchStatRow("2nd Serve Won %", p.secondServeWonPct, o.secondServeWonPct, true, "%")}
            ${renderMatchStatRow("Break Points", `${p.breakPointsConverted}/${p.breakPointsFaced}`, `${o.breakPointsConverted}/${o.breakPointsFaced}`, true, "", p.breakPointsFaced ? (p.breakPointsConverted / p.breakPointsFaced) * 100 : 0, o.breakPointsFaced ? (o.breakPointsConverted / o.breakPointsFaced) * 100 : 0)}
            ${renderMatchStatRow("Winners", p.winners, o.winners, true)}
            ${renderMatchStatRow("Unforced Errors", p.unforcedErrors, o.unforcedErrors, false)}
          </div>
        </div>
        
        <!-- AI Card -->
        <div class="match-ai-card">
          <div class="match-ai-header">
            <span class="match-ai-icon">🤖</span>
            <span class="match-ai-title">AI Tactical Summary</span>
          </div>
          <p class="match-ai-text">${details.aiRecap}</p>
          <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--text-muted)">
             <span>Tournament: <strong>${details.tournament}</strong></span>
             <span>Surface: <strong style="color:var(--accent-hover)">${details.surface}</strong></span>
          </div>
        </div>
      </div>
    `;
}

// Seeded random helper for deterministic mock data
function createSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = (h + 0x9e3779b9) | 0;
    let z = h;
    z ^= z >>> 16;
    z = Math.imul(z, 0x21f0aa7c);
    z ^= z >>> 15;
    z = Math.imul(z, 0x735a2d97);
    z ^= z >>> 15;
    return (z >>> 0) / 4294967296;
  };
}

// Build the detailed comparison stats and AI summary for the expanded drawer
function buildMatchDetailsHtml(player, m, index) {
  const seed = player.overview.name + m.opponent + m.date;
  const rng = createSeededRandom(seed);

  const pServe = player.strengthMeter.serve;
  const pReturn = player.strengthMeter.return;
  const isWin = m.result === "win";

  // Seeded random opponent rating
  const oppServe = Math.floor(rng() * 15) + 75;
  const oppReturn = Math.floor(rng() * 15) + 75;

  // Aces
  const pAces = Math.round((pServe / 10) * (rng() * 0.8 + 0.6) + (m.surface === "Grass" ? 3 : 0));
  const oAces = Math.round((oppServe / 10) * (rng() * 0.8 + 0.6) + (m.surface === "Grass" ? 3 : 0));

  // Double faults
  const pDF = Math.floor(rng() * 3) + 1;
  const oDF = Math.floor(rng() * 3) + 1;

  // 1st serve %
  const pFirstPct = Math.round(55 + rng() * 15);
  const oFirstPct = Math.round(55 + rng() * 15);

  // 1st serve won %
  const pFirstWon = Math.round(isWin ? (68 + rng() * 12) : (58 + rng() * 10));
  const oFirstWon = Math.round(isWin ? (58 + rng() * 10) : (68 + rng() * 12));

  // 2nd serve won %
  const pSecondWon = Math.round(isWin ? (48 + rng() * 12) : (38 + rng() * 10));
  const oSecondWon = Math.round(isWin ? (38 + rng() * 10) : (48 + rng() * 12));

  // Break Points Won / Faced
  const pBPOpp = Math.floor(rng() * 6) + (isWin ? 3 : 1);
  const pBPConv = Math.floor(isWin ? (pBPOpp * (0.4 + rng() * 0.4)) : (pBPOpp * (0.1 + rng() * 0.3)));

  const oBPOpp = Math.floor(rng() * 6) + (isWin ? 1 : 3);
  const oBPConv = Math.floor(isWin ? (oBPOpp * (0.1 + rng() * 0.3)) : (oBPOpp * (0.4 + rng() * 0.4)));

  // Winners / UEs
  const pWinners = Math.round((pServe / 3.2) * (rng() * 0.6 + 0.7));
  const oWinners = Math.round((oppServe / 3.2) * (rng() * 0.6 + 0.7));
  const pUE = Math.round(14 + rng() * 14 - (isWin ? 3 : 0));
  const oUE = Math.round(14 + rng() * 14 - (isWin ? 0 : 3));

  // AI Recap wording
  let recapText = "";
  if (isWin) {
    if (pAces > 6 || pFirstWon > 74) {
      recapText = `A dominant serving display from ${player.overview.name}. Winning ${pFirstWon}% of points on her first serve and firing ${pAces} aces allowed her to control the match tempo. ${m.opponent} struggled to establish rhythm on return, faced ${pBPOpp} break points, and was eventually worn down by the continuous service pressure.`;
    } else if (pReturn > 80 || pBPConv > 2) {
      recapText = `Excellent returning and baseline depth from ${player.overview.name}. Breaking ${m.opponent} ${pBPConv} times, she seized control of rallies early by exploiting second serves. Her baseline consistency kept ${m.opponent} pinned and forced a high error count.`;
    } else {
      recapText = `A gritty, mentally resilient performance from ${player.overview.name}. Despite some unforced errors, she stepped up her intensity on critical points, saving ${oBPOpp - oBPConv} of the ${oBPOpp} break points faced and capitalizing on rare counter-attacking opportunities.`;
    }
  } else {
    if (oFirstWon > 74 || oAces > 6) {
      recapText = `${player.overview.name} struggled to make an impact on ${m.opponent}'s serve, which operated at a very high level. ${m.opponent} won ${oFirstWon}% of first-serve points, limiting break back opportunities. The quick court conditions heavily favored the aggressive serve placement.`;
    } else {
      recapText = `A close, point-by-point battle decided by unforced errors at crucial margins. ${player.overview.name} showed moments of brilliance but was held back by ${pUE} unforced errors. ${m.opponent} displayed stronger rally tolerance from the back of the court to secure the win.`;
    }
  }

  return `
      <div class="match-details-grid">
        <!-- Stats -->
        <div>
          <h4 style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:6px">Match Statistics</h4>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${renderMatchStatRow("Aces", pAces, oAces, true)}
            ${renderMatchStatRow("Double Faults", pDF, oDF, false)}
            ${renderMatchStatRow("1st Serve %", pFirstPct, oFirstPct, true, "%")}
            ${renderMatchStatRow("1st Serve Won %", pFirstWon, oFirstWon, true, "%")}
            ${renderMatchStatRow("2nd Serve Won %", pSecondWon, oSecondWon, true, "%")}
            ${renderMatchStatRow("Break Points", `${pBPConv}/${pBPOpp}`, `${oBPConv}/${oBPOpp}`, true, "", pBPOpp ? (pBPConv / pBPOpp) * 100 : 0, oBPOpp ? (oBPConv / oBPOpp) * 100 : 0)}
            ${renderMatchStatRow("Winners", pWinners, oWinners, true)}
            ${renderMatchStatRow("Unforced Errors", pUE, oUE, false)}
          </div>
        </div>
        
        <!-- AI Card -->
        <div class="match-ai-card">
          <div class="match-ai-header">
            <span class="match-ai-icon">🤖</span>
            <span class="match-ai-title">AI Tactical Summary</span>
          </div>
          <p class="match-ai-text">${recapText}</p>
          <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;color:var(--text-muted)">
            <span>Tournament: <strong>${m.tournament}</strong></span>
            <span>Surface: <strong style="color:var(--accent-hover)">${m.surface}</strong></span>
          </div>
        </div>
      </div>
    `;
}

function renderMatchStatRow(label, valL, valR, higherIsBetter, unit = "", barValL = null, barValR = null) {
  let pVal = typeof valL === "number" ? valL : parseInt(valL) || 0;
  let oVal = typeof valR === "number" ? valR : parseInt(valR) || 0;

  let advL = false, advR = false;
  if (higherIsBetter) {
    if (pVal > oVal) advL = true;
    else if (oVal > pVal) advR = true;
  } else {
    if (pVal < oVal) advL = true;
    else if (oVal < pVal) advR = true;
  }

  const maxVal = Math.max(pVal, oVal, 1);
  const fillL = barValL !== null ? barValL : (pVal / maxVal) * 50;
  const fillR = barValR !== null ? barValR : (oVal / maxVal) * 50;

  return `
      <div class="match-stat-bar-container">
        <span class="match-stat-val-l ${advL ? 'adv' : ''}">${valL}${unit}</span>
        <div class="match-stat-bar-track">
          <div class="match-stat-bar-fill-l" style="width:${Math.min(fillL, 50)}%"></div>
          <div class="match-stat-bar-fill-r" style="width:${Math.min(fillR, 50)}%"></div>
        </div>
        <span class="match-stat-val-r ${advR ? 'adv' : ''}">${valR}${unit}</span>
      </div>
      <div class="match-stats-row" style="margin-top:-6px;padding:0 4px">
        <span style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">${label}</span>
      </div>
    `;
}

// ═══════════════════════════════════════
// SERVE ANALYTICS
// ═══════════════════════════════════════
function renderServe(p) {
  const grid = $("#serve-grid");
  const stats = [
    { key: "firstServePct", label: "First Serve %", emoji: "🎯", unit: "%" },
    { key: "firstServeWonPct", label: "First Serve Won %", emoji: "⚡", unit: "%" },
    { key: "secondServeWonPct", label: "Second Serve Won %", emoji: "🛡️", unit: "%" },
    { key: "acesPct", label: "Aces %", emoji: "🔥", unit: "%" },
    { key: "doubleFaultsPct", label: "Double Faults %", emoji: "❌", unit: "%", invertColor: true },
    { key: "breakPointsSavedPct", label: "Break Points Saved %", emoji: "💪", unit: "%" },
  ];

  grid.innerHTML = stats.map((s, i) => renderAnalyticsCard(s, p.serve[s.key], i)).join("");
  refreshReveal();
}

// ═══════════════════════════════════════
// RETURN ANALYTICS
// ═══════════════════════════════════════
function renderReturn(p) {
  const grid = $("#return-grid");
  const stats = [
    { key: "returnPointsWon", label: "Return Points Won %", emoji: "🎯", unit: "%" },
    { key: "breakConversion", label: "Break Conversion %", emoji: "💥", unit: "%" },
    { key: "returnGamesWon", label: "Return Games Won %", emoji: "🏆", unit: "%" },
  ];

  grid.innerHTML = stats.map((s, i) => renderAnalyticsCard(s, p.returnAnalytics[s.key], i)).join("");
  refreshReveal();
}

function renderAnalyticsCard(stat, data, idx) {
  const diff = data.value - data.tourAvg;
  const diffAbs = Math.abs(diff).toFixed(1);
  let diffClass, diffLabel;

  if (stat.invertColor) {
    // Lower is better (like double faults)
    if (diff < 0) { diffClass = "above"; diffLabel = `${diffAbs} better than avg`; }
    else if (diff > 0) { diffClass = "below"; diffLabel = `${diffAbs} worse than avg`; }
    else { diffClass = "equal"; diffLabel = "Tour average"; }
  } else {
    if (diff > 0) { diffClass = "above"; diffLabel = `+${diffAbs} above avg`; }
    else if (diff < 0) { diffClass = "below"; diffLabel = `${diffAbs} below avg`; }
    else { diffClass = "equal"; diffLabel = "Tour average"; }
  }

  const maxBar = stat.key === "acesPct" || stat.key === "doubleFaultsPct" ? 15 : 100;
  const barPct = Math.min((data.value / maxBar) * 100, 100);
  const avgMarkerPct = Math.min((data.tourAvg / maxBar) * 100, 100);

  return `
      <div class="analytics-card reveal" style="transition-delay:${idx * 0.08}s">
        <div class="analytics-card-top">
          <div>
            <div class="analytics-stat-name">${stat.label}</div>
          </div>
          <div class="analytics-stat-emoji">${stat.emoji}</div>
        </div>
        <div class="analytics-values">
          <div class="analytics-main-val">${data.value}${stat.unit}</div>
          <div class="analytics-vs-avg">
            Tour avg: ${data.tourAvg}${stat.unit}
            <br/><span class="${diffClass}">${diffLabel}</span>
          </div>
        </div>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${barPct}%"></div>
          <div class="analytics-bar-avg-marker" style="left:${avgMarkerPct}%" title="Tour Average"></div>
        </div>
        <div class="analytics-explanation">${data.explanation}</div>
      </div>
    `;
}

// ═══════════════════════════════════════
// STRENGTH METER
// ═══════════════════════════════════════
function renderStrength(p) {
  const card = $("#strength-card");
  const meters = [
    { key: "serve", label: "Serve", icon: "🎯" },
    { key: "return", label: "Return", icon: "🛡️" },
    { key: "consistency", label: "Consistency", icon: "📊" },
    { key: "pressurePoints", label: "Pressure Points", icon: "🧠" },
    { key: "surfaceAdaptability", label: "Surface Adaptability", icon: "🌍" },
  ];

  card.innerHTML = `
      <div class="strength-bars">
        ${meters.map(m => {
    const val = p.strengthMeter[m.key];
    const { cls, label } = getStrengthLabel(val);
    return `
            <div class="strength-row reveal">
              <div class="strength-label">
                <span class="strength-label-icon">${m.icon}</span>
                ${m.label}
              </div>
              <div class="strength-track">
                <div class="strength-fill ${cls}" style="width:${val}%"></div>
              </div>
              <div class="strength-val">${val}</div>
              <div class="strength-rating">
                <span class="strength-rating-badge strength-${cls}">${label}</span>
              </div>
            </div>
          `;
  }).join("")}
      </div>
    `;

  refreshReveal();
}

function getStrengthLabel(val) {
  if (val >= 90) return { cls: "elite", label: "Elite" };
  if (val >= 80) return { cls: "strong", label: "Strong" };
  if (val >= 70) return { cls: "good", label: "Good" };
  if (val >= 55) return { cls: "average", label: "Average" };
  return { cls: "weak", label: "Weak" };
}

// ═══════════════════════════════════════
// AI SUMMARY
// ═══════════════════════════════════════
function renderAISummary(p) {
  const card = $("#ai-summary-card");
  card.innerHTML = `
      <div class="ai-summary-header">
        <div class="ai-summary-icon">🤖</div>
        <div class="ai-summary-label">
          <h3>AI Analysis — ${p.overview.name}</h3>
          <p>Plain-language breakdown of this player's game</p>
        </div>
      </div>
      <p class="ai-summary-text">${p.aiSummary}</p>
    `;
}

// ═══════════════════════════════════════
// PREDICTION ENGINE
// ═══════════════════════════════════════
function populatePredictDropdown(p) {
  const select = $("#predict-opponent");
  select.innerHTML = '<option value="">Choose opponent...</option>';

  Object.keys(p.predictions).forEach(opp => {
    const opt = document.createElement("option");
    opt.value = opp;
    // Display friendly name from profile DB if available
    const oppProfile = PROFILE_DB[opp];
    opt.textContent = oppProfile ? oppProfile.overview.name : opp;
    select.appendChild(opt);
  });
}

function initPredict() {
  $("#btn-predict").addEventListener("click", () => {
    const opp = $("#predict-opponent").value;
    if (!opp) {
      showToast("Please select an opponent.");
      return;
    }
    renderPrediction(opp);
  });
}

async function renderPrediction(oppKey) {
  let pred = null;
  const p = PROFILE_DB[currentPlayerKey] || { overview: { name: currentPlayerKey } };
  const playerName = p.overview.name;

  try {
    const res = await fetch(`${API_BASE}/predictions/${encodeURIComponent(playerName)}/${encodeURIComponent(oppKey)}`);
    if (res.ok) {
      pred = await res.json();
    } else {
      pred = p.predictions ? p.predictions[oppKey] : null;
    }
  } catch (err) {
    console.warn("Prediction fetch failed, using local prediction fallback", err);
    pred = p.predictions ? p.predictions[oppKey] : null;
  }

  if (!pred) return;

  const result = $("#predict-result");
  result.classList.remove("hidden");

  const circumference = 2 * Math.PI * 58;
  const offset = circumference * (1 - pred.winChance / 100);

  const oppProfile = PROFILE_DB[oppKey];
  const oppName = oppProfile ? oppProfile.overview.name : oppKey;

  let ringColor;
  if (pred.winChance >= 60) ringColor = "#22c55e";
  else if (pred.winChance >= 40) ringColor = "#f59e0b";
  else ringColor = "#ef4444";

  result.innerHTML = `
      <div class="predict-matchup">
        <div class="predict-player">
          <div class="player-avatar">${getInitials(playerName)}</div>
          <div class="predict-player-name">${playerName}</div>
        </div>
        <div class="predict-vs">VS</div>
        <div class="predict-player">
          <div class="player-avatar" style="background:linear-gradient(135deg,#06b6d4,#0891b2)">${getInitials(oppName)}</div>
          <div class="predict-player-name">${oppName}</div>
        </div>
      </div>

      <div class="predict-ring-wrap">
        <div class="predict-ring">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle class="predict-ring-bg" cx="70" cy="70" r="58"/>
            <circle class="predict-ring-fill" cx="70" cy="70" r="58"
              stroke="${ringColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"
              style="filter: drop-shadow(0 0 8px ${ringColor}40)"/>
          </svg>
          <div class="predict-ring-center">
            <div class="predict-ring-pct" style="color:${ringColor}">${pred.winChance}%</div>
            <div class="predict-ring-label">Win Chance</div>
          </div>
        </div>
      </div>

      <div class="predict-confidence">
        <span class="predict-confidence-badge confidence-${pred.confidence.toLowerCase()}">${pred.confidence} Confidence</span>
      </div>

      <div class="predict-surface">Best surface for this matchup: <strong>${pred.surface}</strong></div>

      <div class="predict-reasoning">${pred.reasoning}</div>

      <div class="predict-h2h-link" style="text-align:center;margin-top:28px;">
        <a href="h2h.html?p1=${encodeURIComponent(playerName)}&p2=${encodeURIComponent(oppKey)}" class="btn btn-secondary btn-sm" style="background:rgba(255,255,255,0.05);border:1px solid var(--border)">
          <span>Compare Full Head-to-Head</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:4px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    `;

  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ═══════════════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════════════
function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
  );

  $$(".reveal").forEach(el => observer.observe(el));
  window.__revealObserver = observer;
}

function refreshReveal() {
  if (!window.__revealObserver) return;
  $$(".reveal:not(.visible)").forEach(el => {
    window.__revealObserver.observe(el);
  });
}

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════
function showToast(msg) {
  const existing = $(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  toast.style.cssText = `
      position:fixed; bottom:32px; left:50%;
      transform:translateX(-50%) translateY(20px);
      background:#1c2438; color:#f0f2f5;
      padding:14px 28px; border-radius:12px;
      font-size:0.9rem; border:1px solid rgba(99,102,241,0.3);
      box-shadow:0 8px 32px rgba(0,0,0,0.4);
      z-index:9999; opacity:0;
      transition:all 0.4s cubic-bezier(0.4,0,0.2,1);
    `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

