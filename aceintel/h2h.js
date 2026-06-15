/* ═══════════════════════════════════════════
   AceIntel — H2H Comparison Logic
   ═══════════════════════════════════════════ */

// ─── API Config & State ─────────────────
const API_BASE = "http://localhost:5000/api";
let p1Key = null, p2Key = null;
let playersList = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Init ───────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await fetchPlayersList();
  populateDropdowns();
  initNav();
  initSelector();

  // Pre-fill from URL params
  const params = new URLSearchParams(window.location.search);
  const ua = params.get("p1");
  const ub = params.get("p2");
  if (ua && ub) {
    const k1 = resolveKey(ua);
    const k2 = resolveKey(ub);
    if (k1 && k2) {
      $("#sel-p1").value = k1;
      $("#sel-p2").value = k2;
      buildReport(k1, k2);
    }
  }
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

function resolveKey(q) {
  const keys = (playersList && playersList.length > 0)
    ? playersList.map(p => p.name)
    : Object.keys(PROFILE_DB);
  return keys.find(k => k.toLowerCase() === q.toLowerCase())
    || keys.find(k => k.toLowerCase().includes(q.toLowerCase()));
}

// ─── Dropdowns ──────────────────────
function populateDropdowns() {
  const players = (playersList && playersList.length > 0)
    ? playersList.map(p => p.name)
    : H2H_PLAYERS;
  ["sel-p1", "sel-p2"].forEach(id => {
    const sel = $(`#${id}`);
    sel.innerHTML = '<option value="">Choose player…</option>';
    players.forEach(name => {
      const p = PROFILE_DB[name] || { overview: { flag: "🎾", name: name } };
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${p.overview.flag} ${p.overview.name}`;
      sel.appendChild(opt);
    });
  });
}

// ─── Nav ────────────────────────────
function initNav() {
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");

  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    links.classList.toggle("open");
  });

  $$(".nav-link").forEach(l => {
    l.addEventListener("click", () => {
      toggle.classList.remove("active");
      links.classList.remove("open");
    });
  });

  const sections = $$("section[id]");
  const navLinks = $$('.nav-link[href^="#"]');
  window.addEventListener("scroll", () => {
    let cur = "";
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 200) cur = s.id; });
    navLinks.forEach(l => {
      l.classList.remove("active");
      if (l.getAttribute("href") === "#" + cur) l.classList.add("active");
    });
  });

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute("href"));
      if (t) t.scrollIntoView({ behavior: "smooth" });
    });
  });
}

// ─── Selector ───────────────────────
function initSelector() {
  $("#btn-compare").addEventListener("click", () => {
    const a = $("#sel-p1").value;
    const b = $("#sel-p2").value;
    if (!a || !b) { showToast("Please select both players."); return; }
    if (a === b) { showToast("Please select two different players."); return; }

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set("p1", a);
    url.searchParams.set("p2", b);
    window.history.pushState({}, "", url);

    buildReport(a, b);
  });
}

// ═══════════════════════════════════════
// BUILD FULL REPORT
// ═══════════════════════════════════════
async function buildReport(a, b) {
  p1Key = a; p2Key = b;

  const report = $("#h2h-report");
  report.classList.remove("hidden");

  let data = null;
  try {
    const res = await fetch(`${API_BASE}/h2h?p1=${encodeURIComponent(a)}&p2=${encodeURIComponent(b)}`);
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch H2H data from API, using fallback data", err);
  }

  let pa, pb, meetings, style, matchup, matchupKey;
  if (data) {
    pa = data.player1;
    pb = data.player2;
    meetings = data.meetings;
    style = data.style;
    matchup = data.matchup;
    matchupKey = data.matchupKey;
  } else {
    pa = PROFILE_DB[a];
    pb = PROFILE_DB[b];
    matchupKey = getMatchupKey(a, b);
    matchup = H2H_MATCHUP[matchupKey];
    meetings = H2H_MEETINGS[matchupKey];
    style = H2H_STYLE[matchupKey];
  }

  if (!pa || !pb) return;

  // Determine which player is "a" in the data (alphabetical)
  const [dataA, dataB] = getDataOrder(a, b);
  const paIsDataA = (a === dataA);

  renderOverview(pa, pb, meetings, paIsDataA);
  renderSurfaces(pa, pb);
  renderHistory(pa, pb, meetings, paIsDataA);
  renderClash(pa, pb, style, paIsDataA);
  renderMatchup(pa, pb, matchup, paIsDataA);
  renderPredict(pa, pb, matchup, paIsDataA);
  renderBetting(matchup);
  renderAISummary(pa, pb, matchup);

  setTimeout(() => {
    const target = document.getElementById("overview");
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }, 100);

  initScrollReveal();
}

// Key always alphabetical
function getMatchupKey(a, b) {
  const sorted = [a, b].sort();
  // Map to h2h-data key format
  const mapped = sorted.map(k => {
    if (k === "Iga Swiatek") return "Iga Swiatek";
    return k;
  });
  return mapped.join("___");
}

function getDataOrder(a, b) {
  return [a, b].sort();
}

// ═══════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════
function renderOverview(pa, pb, meetings, paIsDataA) {
  const oa = pa.overview;
  const ob = pb.overview;

  // H2H record
  let recordA = "—", recordB = "—";
  if (meetings && meetings.record) {
    recordA = paIsDataA ? meetings.record.a : meetings.record.b;
    recordB = paIsDataA ? meetings.record.b : meetings.record.a;
  }

  const formDotsA = oa.recentForm.map(r => `<div class="ov-dot ${r.toLowerCase()}"></div>`).join("");
  const formDotsB = ob.recentForm.map(r => `<div class="ov-dot ${r.toLowerCase()}"></div>`).join("");

  const eloWinnerA = oa.elo > ob.elo;
  const rankWinnerA = oa.currentRank < ob.currentRank;
  const careerWinnerA = oa.careerWinPct > ob.careerWinPct;

  const rows = [
    { label: "Ranking", va: `#${oa.currentRank}`, vb: `#${ob.currentRank}`, winA: rankWinnerA },
    { label: "Peak Rank", va: `#${oa.peakRank}`, vb: `#${ob.peakRank}`, winA: oa.peakRank < ob.peakRank },
    { label: "Age", va: `${oa.age}`, vb: `${ob.age}`, winA: null },
    { label: "Handedness", va: oa.handedness, vb: ob.handedness, winA: null },
    { label: "Elo Rating", va: oa.elo, vb: ob.elo, winA: eloWinnerA },
    { label: "Career W%", va: `${oa.careerWinPct}%`, vb: `${ob.careerWinPct}%`, winA: careerWinnerA },
    { label: "YTD W-L", va: oa.ytdWinLoss, vb: ob.ytdWinLoss, winA: null },
  ];

  const rowsHtml = rows.map(r => `
      <div class="overview-row">
        <span class="ov-label">${r.label}</span>
        <span class="ov-value ${r.winA === true ? 'winner' : ''}">${r.va}</span>
      </div>
    `).join("");

  const rowsHtmlB = rows.map(r => `
      <div class="overview-row">
        <span class="ov-value ${r.winA === false ? 'winner' : ''}">${r.vb}</span>
        <span class="ov-label">${r.label}</span>
      </div>
    `).join("");

  document.title = `${oa.name} vs ${ob.name} — AceIntel`;

  const html = `
      <div class="overview-split reveal">
        <!-- P1 -->
        <div class="overview-player p1">
          <div class="overview-avatar">${getInitials(oa.name)}</div>
          <div class="overview-name">${oa.name}</div>
          <div class="overview-nationality">${oa.flag} ${oa.nationality}</div>
          <div class="overview-rows">
            ${rowsHtml}
            <div class="overview-row">
              <span class="ov-label">Form</span>
              <div class="ov-form-dots">${formDotsA}</div>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px;width:100%">
            <a href="player.html?player=${encodeURIComponent(oa.name)}" class="btn btn-sm btn-secondary" style="display:inline-flex;justify-content:center;width:120px">
              View Profile
            </a>
          </div>
        </div>

        <!-- Center -->
        <div class="overview-center">
          <div>
            <div class="h2h-record-big">${recordA} – ${recordB}</div>
            <div class="h2h-record-label">H2H Record</div>
          </div>
        </div>

        <!-- P2 -->
        <div class="overview-player p2">
          <div class="overview-avatar">${getInitials(ob.name)}</div>
          <div class="overview-name">${ob.name}</div>
          <div class="overview-nationality">${ob.flag} ${ob.nationality}</div>
          <div class="overview-rows">
            ${rowsHtmlB}
            <div class="overview-row">
              <div class="ov-form-dots">${formDotsB}</div>
              <span class="ov-label">Form</span>
            </div>
          </div>
          <div style="text-align:center;margin-top:20px;width:100%">
            <a href="player.html?player=${encodeURIComponent(ob.name)}" class="btn btn-sm btn-secondary" style="display:inline-flex;justify-content:center;width:120px">
              View Profile
            </a>
          </div>
        </div>
      </div>
    `;

  $("#overview-content").innerHTML = html;
  refreshReveal();
}

// ═══════════════════════════════════════
// SURFACES
// ═══════════════════════════════════════
function renderSurfaces(pa, pb) {
  const surfaces = [
    { key: "grass", label: "Grass", icon: "🌿", cls: "grass" },
    { key: "clay", label: "Clay", icon: "🧱", cls: "clay" },
    { key: "hard", label: "Hard Court", icon: "🏟️", cls: "hard" },
    { key: "indoor", label: "Indoor", icon: "🏢", cls: "indoor" },
  ];

  const stats = [
    { key: "winPct", label: "Win %", fmt: v => v + "%" },
    { key: "holdPct", label: "Hold %", fmt: v => v + "%" },
    { key: "breakPct", label: "Break %", fmt: v => v + "%" },
    { key: "serveRating", label: "Serve Rating", fmt: v => v },
    { key: "returnRating", label: "Return Rating", fmt: v => v },
    { key: "tiebreakRecord", label: "Tiebreak", fmt: v => v, noCompare: true },
  ];

  const oa = pa.overview, ob = pb.overview;

  const html = surfaces.map((s, si) => {
    const da = pa.surfaces[s.key];
    const db = pb.surfaces[s.key];

    const statsHtml = stats.map(st => {
      const va = da[st.key];
      const vb = db[st.key];
      let winA = null, winB = null;

      if (!st.noCompare && typeof va === "number") {
        if (va > vb) winA = true;
        else if (vb > va) winB = true;
      }

      return `
          <div class="sc-row">
            <span class="sc-val ${winA ? 'adv' : ''}">${st.fmt(va)}</span>
            <span style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">${st.label}</span>
            <span class="sc-val ${winB ? 'adv' : ''}" style="text-align:right">${st.fmt(vb)}</span>
          </div>
        `;
    }).join("");

    return `
        <div class="surface-compare-block ${s.cls} reveal" style="transition-delay:${si * 0.1}s">
          <div class="surface-compare-header">
            <div class="surface-compare-icon">${s.icon}</div>
            <div class="surface-compare-title">${s.label}</div>
            <span class="surface-strength strength-${da.strength.toLowerCase()}" style="margin-left:auto">${da.strength}</span>
            <span style="margin:0 8px;color:var(--text-muted)">vs</span>
            <span class="surface-strength strength-${db.strength.toLowerCase()}">${db.strength}</span>
          </div>
          <div style="padding:0 24px 4px;display:grid;grid-template-columns:1fr 1fr;gap:0;">
            <div style="font-size:0.7rem;font-weight:700;color:var(--accent-hover);padding:10px 0 4px;text-transform:uppercase;letter-spacing:.06em">${oa.name}</div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--cyan);padding:10px 0 4px;text-transform:uppercase;letter-spacing:.06em;text-align:right">${ob.name}</div>
          </div>
          <div style="padding:0 24px 20px;display:flex;flex-direction:column;gap:10px">
            ${statsHtml}
          </div>
        </div>
      `;
  }).join("");

  $("#surfaces-content").innerHTML = `<div class="surface-compare-grid">${html}</div>`;
  refreshReveal();
}

// ═══════════════════════════════════════
// HISTORICAL MEETINGS
// ═══════════════════════════════════════
function renderHistory(pa, pb, meetings, paIsDataA) {
  const oa = pa.overview, ob = pb.overview;
  const el = $("#history-content");

  if (!meetings || meetings.meetings.length === 0) {
    el.innerHTML = `
        <div class="no-meetings-note">
          <div class="note-icon">🤷</div>
          <p><strong>No official meetings on record.</strong><br/>${meetings && meetings.note ? meetings.note : "These players have never faced each other in an official match."}</p>
        </div>
      `;
    return;
  }

  const recA = paIsDataA ? meetings.record.a : meetings.record.b;
  const recB = paIsDataA ? meetings.record.b : meetings.record.a;

  const recordBanner = `
      <div class="h2h-record-banner reveal">
        <div class="h2h-record-player">
          <div class="player-avatar" style="margin:0 auto 8px">${getInitials(oa.name)}</div>
          <div class="h2h-record-name">${oa.name}</div>
          <div class="h2h-record-wins p1c">${recA}</div>
        </div>
        <div class="h2h-record-divider">–</div>
        <div class="h2h-record-player">
          <div class="player-avatar" style="margin:0 auto 8px;background:linear-gradient(135deg,#06b6d4,#0891b2)">${getInitials(ob.name)}</div>
          <div class="h2h-record-name">${ob.name}</div>
          <div class="h2h-record-wins p2c">${recB}</div>
        </div>
      </div>
    `;

  const tableRows = meetings.meetings.map((m, i) => {
    // Determine if winner is p1 or p2 (fuzzy match on name)
    const winnerIsA = oa.name.toLowerCase().includes(m.winner.toLowerCase().split(" ")[0].toLowerCase())
      || m.winner.toLowerCase().includes(oa.name.toLowerCase().split(" ")[0].toLowerCase());
    return `
        <tr class="reveal" style="transition-delay:${i * 0.04}s">
          <td class="${winnerIsA ? 'history-winner-p1' : 'history-winner-p2'}">${m.winner}</td>
          <td class="history-score">${m.score}</td>
          <td><span class="surface-pill ${m.surface.toLowerCase()}">${m.surface}</span></td>
          <td>${m.tournament}</td>
          <td style="color:var(--text-muted);font-size:.82rem">${m.date}</td>
        </tr>
      `;
  }).join("");

  el.innerHTML = `
      ${recordBanner}
      <div class="history-table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th>Winner</th>
              <th>Score</th>
              <th>Surface</th>
              <th>Tournament</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

  refreshReveal();
}

// ═══════════════════════════════════════
// STYLE CLASH
// ═══════════════════════════════════════
function renderClash(pa, pb, style, paIsDataA) {
  const oa = pa.overview, ob = pb.overview;

  if (!style) {
    $("#clash-content").innerHTML = `<p style="text-align:center;color:var(--text-muted)">Style analysis not available for this matchup.</p>`;
    return;
  }

  const styleA = paIsDataA ? style.aStyle : style.bStyle;
  const styleB = paIsDataA ? style.bStyle : style.aStyle;

  const stylesRow = `
      <div class="clash-styles-row reveal">
        <div class="clash-style-card p1">
          <div class="clash-style-name">${oa.name}</div>
          <div class="clash-style-type">${styleA}</div>
        </div>
        <div class="clash-vs-icon">⚔️</div>
        <div class="clash-style-card p2">
          <div class="clash-style-name">${ob.name}</div>
          <div class="clash-style-type">${styleB}</div>
        </div>
      </div>
    `;

  const clashPoints = style.clashPoints.map((cp, i) => `
      <div class="clash-point-card reveal" style="transition-delay:${i * 0.1}s">
        <div class="clash-point-header">
          <div class="clash-point-icon">${cp.icon}</div>
          <div class="clash-point-title">${cp.title}</div>
        </div>
        <div class="clash-point-text">${cp.text}</div>
      </div>
    `).join("");

  $("#clash-content").innerHTML = `
      ${stylesRow}
      <div class="clash-points">${clashPoints}</div>
    `;

  refreshReveal();
}

// ═══════════════════════════════════════
// MATCHUP BARS
// ═══════════════════════════════════════
function renderMatchup(pa, pb, matchup, paIsDataA) {
  const oa = pa.overview, ob = pb.overview;

  if (!matchup) {
    $("#matchup-content").innerHTML = `<p style="text-align:center;color:var(--text-muted)">Matchup data unavailable.</p>`;
    return;
  }

  const bars = matchup.bars.map(bar => {
    const valA = paIsDataA ? bar.aVal : bar.bVal;
    const valB = paIsDataA ? bar.bVal : bar.aVal;
    const total = valA + valB;
    const pctA = (valA / total) * 50;
    const pctB = (valB / total) * 50;

    return `
        <div class="matchup-bar-row">
          <div class="matchup-bar-val p1">${valA}</div>
          <div class="matchup-bar-center">
            <div class="matchup-bar-label">${bar.label}</div>
            <div class="matchup-bar-track">
              <div class="matchup-bar-fill-l" style="width:${pctA}%"></div>
              <div class="matchup-bar-fill-r" style="width:${pctB}%"></div>
            </div>
          </div>
          <div class="matchup-bar-val p2">${valB}</div>
        </div>
      `;
  }).join("");

  $("#matchup-content").innerHTML = `
      <div class="matchup-card reveal">
        <div class="matchup-legend">
          <div class="matchup-legend-item">
            <div class="legend-dot p1"></div>
            <span>${oa.name}</span>
          </div>
          <div style="font-size:.78rem;color:var(--text-muted)">Best surface: <strong>${matchup.surface}</strong></div>
          <div class="matchup-legend-item">
            <div class="legend-dot p2"></div>
            <span>${ob.name}</span>
          </div>
        </div>
        <div class="matchup-bars">${bars}</div>
      </div>
    `;

  refreshReveal();
}

// ═══════════════════════════════════════
// WIN PROBABILITY
// ═══════════════════════════════════════
function renderPredict(pa, pb, matchup, paIsDataA) {
  const oa = pa.overview, ob = pb.overview;

  if (!matchup) {
    $("#predict-content").innerHTML = `<p style="text-align:center;color:var(--text-muted)">Prediction data unavailable.</p>`;
    return;
  }

  const winA = paIsDataA ? matchup.winProb.a : matchup.winProb.b;
  const winB = paIsDataA ? matchup.winProb.b : matchup.winProb.a;
  const reasonsA = paIsDataA ? matchup.reasons.a : matchup.reasons.b;
  const reasonsB = paIsDataA ? matchup.reasons.b : matchup.reasons.a;

  const confCls = matchup.confidence === "High" ? "confidence-high" : matchup.confidence === "Medium" ? "confidence-medium" : "confidence-low";

  const reasonsHtmlA = reasonsA.map(r => `<li class="prob-reason">${r}</li>`).join("");
  const reasonsHtmlB = reasonsB.map(r => `<li class="prob-reason">${r}</li>`).join("");

  $("#predict-content").innerHTML = `
      <div class="predict-confidence-row" style="margin-bottom:20px">
        <span class="predict-confidence-badge ${confCls}">${matchup.confidence} Confidence Prediction</span>
      </div>
      <div class="predict-split reveal">
        <div class="predict-player-col p1">
          <div class="prob-pct p1c">${winA}%</div>
          <div class="prob-label">Win Probability</div>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width:${winA}%"></div>
          </div>
          <div class="prob-reasons-title">${oa.name}'s Advantages</div>
          <ul class="prob-reasons">${reasonsHtmlA}</ul>
        </div>
        <div class="predict-center-col">VS</div>
        <div class="predict-player-col p2">
          <div class="prob-pct p2c">${winB}%</div>
          <div class="prob-label">Win Probability</div>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width:${winB}%"></div>
          </div>
          <div class="prob-reasons-title">${ob.name}'s Advantages</div>
          <ul class="prob-reasons">${reasonsHtmlB}</ul>
        </div>
      </div>
    `;

  refreshReveal();
}

// ═══════════════════════════════════════
// BETTING INSIGHTS
// ═══════════════════════════════════════
function renderBetting(matchup) {
  if (!matchup) return;
  const b = matchup.betting;

  const cards = [
    { icon: "📊", title: "Over/Under Sets", value: b.overUnder },
    { icon: "⚡", title: "Tiebreak Chance", value: b.tiebreakChance },
    { icon: "💥", title: "Upset Probability", value: b.upsetProb },
    { icon: "🎾", title: "Expected Length", value: b.expectedSets },
    { icon: "💰", title: "Odds Edge", value: b.bestOdds },
  ];

  const html = cards.map((c, i) => `
      <div class="betting-card reveal" style="transition-delay:${i * 0.08}s">
        <div class="betting-card-icon">${c.icon}</div>
        <div class="betting-card-title">${c.title}</div>
        <div class="betting-card-value">${c.value}</div>
      </div>
    `).join("");

  $("#betting-content").innerHTML = `<div class="betting-grid">${html}</div>`;
  refreshReveal();
}

// ═══════════════════════════════════════
// AI SUMMARY
// ═══════════════════════════════════════
function renderAISummary(pa, pb, matchup) {
  const oa = pa.overview, ob = pb.overview;
  if (!matchup) return;

  $("#ai-summary-content").innerHTML = `
      <div class="ai-h2h-card reveal">
        <div class="ai-h2h-header">
          <div class="ai-h2h-icon">🤖</div>
          <div class="ai-h2h-label">
            <h3>${oa.name} vs ${ob.name}</h3>
            <p>AI-generated matchup analysis</p>
          </div>
        </div>
        <p class="ai-h2h-text">${matchup.aiSummary}</p>
      </div>
    `;

  refreshReveal();
}

// ═══════════════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════════════
function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
    { threshold: 0.06, rootMargin: "0px 0px -20px 0px" }
  );
  $$(".reveal").forEach(el => observer.observe(el));
  window.__revealObserver = observer;
}

function refreshReveal() {
  if (!window.__revealObserver) return;
  $$(".reveal:not(.visible)").forEach(el => window.__revealObserver.observe(el));
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
      box-shadow:0 8px 32px rgba(0,0,0,.4);
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

// ─── Helper ────────────────────────
function getInitials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

