/* ═══════════════════════════════════════════
   AceIntel — Player Profile Logic
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let currentPlayerKey = null;

  // ─── Init ───────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // Get player from URL param
    const params = new URLSearchParams(window.location.search);
    const playerParam = params.get("player") || "Anna Blinkova";

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

  function resolvePlayerKey(query) {
    const keys = Object.keys(PROFILE_DB);
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
      document.title = `${PROFILE_DB[key].overview.name} — AceIntel`;
      loadProfile(key);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`Player not found. Try: ${Object.keys(PROFILE_DB).join(", ")}`);
    }
  }

  // ═══════════════════════════════════════
  // LOAD FULL PROFILE
  // ═══════════════════════════════════════
  function loadProfile(key) {
    const p = PROFILE_DB[key];
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
      { key: "grass",  label: "Grass",      icon: "🌿", cls: "grass" },
      { key: "clay",   label: "Clay",       icon: "🧱", cls: "clay" },
      { key: "hard",   label: "Hard Court", icon: "🏟️", cls: "hard" },
      { key: "indoor", label: "Indoor",     icon: "🏢", cls: "indoor" },
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
          </tr>
        </thead>
        <tbody>
          ${p.recentMatches.map((m, i) => `
            <tr class="reveal" style="transition-delay:${i * 0.05}s">
              <td><span class="match-result-badge ${m.result}">${m.result}</span></td>
              <td style="font-weight:600">${m.opponent}</td>
              <td class="match-score-cell">${m.score}</td>
              <td><span class="match-surface-tag ${m.surface.toLowerCase()}">${m.surface}</span></td>
              <td>${m.tournament}</td>
              <td class="match-date">${m.date}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    refreshReveal();
  }

  // ═══════════════════════════════════════
  // SERVE ANALYTICS
  // ═══════════════════════════════════════
  function renderServe(p) {
    const grid = $("#serve-grid");
    const stats = [
      { key: "firstServePct",       label: "First Serve %",        emoji: "🎯", unit: "%" },
      { key: "firstServeWonPct",    label: "First Serve Won %",    emoji: "⚡", unit: "%" },
      { key: "secondServeWonPct",   label: "Second Serve Won %",   emoji: "🛡️", unit: "%" },
      { key: "acesPct",             label: "Aces %",               emoji: "🔥", unit: "%" },
      { key: "doubleFaultsPct",     label: "Double Faults %",      emoji: "❌", unit: "%", invertColor: true },
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
      { key: "breakConversion", label: "Break Conversion %",  emoji: "💥", unit: "%" },
      { key: "returnGamesWon",  label: "Return Games Won %",  emoji: "🏆", unit: "%" },
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
      { key: "serve",              label: "Serve",               icon: "🎯" },
      { key: "return",             label: "Return",              icon: "🛡️" },
      { key: "consistency",        label: "Consistency",         icon: "📊" },
      { key: "pressurePoints",     label: "Pressure Points",    icon: "🧠" },
      { key: "surfaceAdaptability",label: "Surface Adaptability",icon: "🌍" },
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

  function renderPrediction(oppKey) {
    const p = PROFILE_DB[currentPlayerKey];
    const pred = p.predictions[oppKey];
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
          <div class="player-avatar">${getInitials(p.overview.name)}</div>
          <div class="predict-player-name">${p.overview.name}</div>
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
})();
