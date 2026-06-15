/* ═══════════════════════════════════════════
   AceIntel — Application Logic
   ═══════════════════════════════════════════ */

(function () {
  "use strict";

  // ─── State & API Config ─────────────────
  const API_BASE = "http://localhost:5000/api";
  let currentPlayer = "Anna Blinkova";
  let playersList = [];

  // ─── DOM Cache ──────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Init ───────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initSearch();
    initChips();
    renderTrending();
    initCompare();
    loadPlayerData(currentPlayer);
    initScrollReveal();
    initSmoothScroll();
    
    // Fetch players in the background
    fetchPlayersList().catch(() => {});
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

  // ═══════════════════════════════════════
  // NAVBAR
  // ═══════════════════════════════════════
  function initNav() {
    const toggle = $("#nav-toggle");
    const links = $("#nav-links");

    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      links.classList.toggle("open");
    });

    // Close on link click
    $$(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        toggle.classList.remove("active");
        links.classList.remove("open");
      });
    });

    // Active link on scroll
    const sections = $$("section[id]");
    const navLinks = $$(".nav-link");

    window.addEventListener("scroll", () => {
      let current = "";
      sections.forEach((s) => {
        if (window.scrollY >= s.offsetTop - 200) {
          current = s.id;
        }
      });
      navLinks.forEach((l) => {
        l.classList.remove("active");
        if (l.getAttribute("href") === "#" + current) {
          l.classList.add("active");
        }
      });
    });
  }

  // ═══════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════
  function initSearch() {
    const input = $("#hero-search");
    const btn = $("#btn-analyze");

    btn.addEventListener("click", () => {
      const query = input.value.trim();
      if (query) searchPlayer(query);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = input.value.trim();
        if (query) searchPlayer(query);
      }
    });
  }

  function searchPlayer(query) {
    // Find closest match
    const keys = (playersList && playersList.length > 0)
      ? playersList.map(p => p.name)
      : Object.keys(PLAYERS_DB);
    const match = keys.find(
      (k) => k.toLowerCase() === query.toLowerCase()
    ) || keys.find(
      (k) => k.toLowerCase().includes(query.toLowerCase())
    );

    if (match) {
      // Navigate to deep player profile page
      window.location.href = `player.html?player=${encodeURIComponent(match)}`;
    } else {
      showToast(`Player "${query}" not found. Try: ${keys.join(", ")}`);
    }
  }

  // ═══════════════════════════════════════
  // CHIPS
  // ═══════════════════════════════════════
  function initChips() {
    $$(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const player = chip.dataset.player;
        $("#hero-search").value = player;
        searchPlayer(player);
      });
    });
  }

  // ═══════════════════════════════════════
  // TRENDING PLAYERS
  // ═══════════════════════════════════════
  async function renderTrending() {
    const grid = $("#trending-grid");
    
    // Render static fallback immediately
    renderTrendingUI(TRENDING_PLAYERS);

    try {
      const res = await fetch(`${API_BASE}/players?trending=true`);
      if (res.ok) {
        const trending = await res.json();
        renderTrendingUI(trending);
      }
    } catch (err) {
      console.warn("Using fallback trending data due to fetch error:", err);
    }
  }

  function renderTrendingUI(trending) {
    const grid = $("#trending-grid");
    grid.innerHTML = trending.map((p, i) => `
      <div class="player-card reveal" style="transition-delay:${i * 0.08}s" data-player="${p.name}">
        <div class="player-card-header">
          <div class="player-avatar">${getInitials(p.name)}</div>
          <div>
            <div class="player-name">${p.name}</div>
            <div class="player-country">${p.country}</div>
          </div>
        </div>
        <div class="player-meta">
          <div class="player-stat-row">
            <span class="player-stat-label">Rank</span>
            <span class="player-stat-value">#${p.rank}</span>
          </div>
          <div class="player-stat-row">
            <span class="player-stat-label">Best Surface</span>
            <span class="player-stat-value">${p.surface}</span>
          </div>
          <div class="player-stat-row">
            <span class="player-stat-label">Current Form</span>
            <span class="badge badge-${p.formColor}">${p.form}</span>
          </div>
        </div>
      </div>
    `).join("");

    // Click on player card
    $$(".player-card").forEach((card) => {
      card.addEventListener("click", () => {
        const name = card.dataset.player;
        $("#hero-search").value = name;
        searchPlayer(name);
      });
    });
  }

  // ═══════════════════════════════════════
  // COMPARE
  // ═══════════════════════════════════════
  function initCompare() {
    $("#btn-compare").addEventListener("click", () => {
      const p1 = $("#compare-p1").value.trim();
      const p2 = $("#compare-p2").value.trim();
      if (!p1 || !p2) {
        showToast("Please enter both player names.");
        return;
      }
      renderCompare(p1, p2);
    });
  }

  async function renderCompare(q1, q2) {
    const keys = (playersList && playersList.length > 0)
      ? playersList.map(p => p.name)
      : Object.keys(PLAYERS_DB);
    const m1 = keys.find(k => k.toLowerCase().includes(q1.toLowerCase()));
    const m2 = keys.find(k => k.toLowerCase().includes(q2.toLowerCase()));

    if (!m1 || !m2) {
      showToast(`Could not find one or both players. Available: ${keys.join(", ")}`);
      return;
    }

    let p1, p2;
    try {
      const res1 = await fetch(`${API_BASE}/players/${encodeURIComponent(m1)}`);
      const res2 = await fetch(`${API_BASE}/players/${encodeURIComponent(m2)}`);
      if (res1.ok && res2.ok) {
        const d1 = await res1.json();
        const d2 = await res2.json();
        p1 = {
          name: d1.overview.name,
          rank: d1.overview.currentRank,
          country: d1.overview.nationality,
          stats: {
            serve: d1.strengthMeter.serve,
            return: d1.strengthMeter.return,
            elo: d1.overview.elo,
            pressure: d1.strengthMeter.pressurePoints,
            tiebreak: parseInt(d1.surfaces.hard.tiebreakRecord.split("-")[0]) * 5 || 70,
            breakPt: d1.returnAnalytics.breakConversion.value
          }
        };
        p2 = {
          name: d2.overview.name,
          rank: d2.overview.currentRank,
          country: d2.overview.nationality,
          stats: {
            serve: d2.strengthMeter.serve,
            return: d2.strengthMeter.return,
            elo: d2.overview.elo,
            pressure: d2.strengthMeter.pressurePoints,
            tiebreak: parseInt(d2.surfaces.hard.tiebreakRecord.split("-")[0]) * 5 || 70,
            breakPt: d2.returnAnalytics.breakConversion.value
          }
        };
      } else {
        p1 = PLAYERS_DB[m1];
        p2 = PLAYERS_DB[m2];
      }
    } catch (err) {
      console.warn("Using static comparison due to fetch error:", err);
      p1 = PLAYERS_DB[m1];
      p2 = PLAYERS_DB[m2];
    }

    const result = $("#compare-result");
    result.classList.remove("hidden");

    const compareStats = [
      { label: "Serve Rating",     v1: p1.stats.serve,    v2: p2.stats.serve },
      { label: "Return Rating",    v1: p1.stats.return,   v2: p2.stats.return },
      { label: "Elo Rating",       v1: p1.stats.elo,      v2: p2.stats.elo,     isElo: true },
      { label: "Pressure",         v1: p1.stats.pressure, v2: p2.stats.pressure },
      { label: "Tiebreak",         v1: p1.stats.tiebreak, v2: p2.stats.tiebreak },
      { label: "Break Point Conv.", v1: p1.stats.breakPt,  v2: p2.stats.breakPt  },
    ];

    result.innerHTML = `
      <div class="compare-header">
        <div class="compare-player-info">
          <div class="player-avatar">${getInitials(p1.name)}</div>
          <div class="compare-player-name">${p1.name}</div>
          <div class="compare-player-rank">#${p1.rank} • ${p1.country}</div>
        </div>
        <div class="compare-score-center">
          <div class="compare-score-big">VS</div>
          <div class="compare-score-label">Head to Head</div>
        </div>
        <div class="compare-player-info">
          <div class="player-avatar" style="background:linear-gradient(135deg,#06b6d4,#0891b2)">${getInitials(p2.name)}</div>
          <div class="compare-player-name">${p2.name}</div>
          <div class="compare-player-rank">#${p2.rank} • ${p2.country}</div>
        </div>
      </div>
      <div class="compare-bars">
        ${compareStats.map((s) => {
          const max = s.isElo ? Math.max(s.v1, s.v2) * 1.05 : 100;
          const pct1 = (s.v1 / max) * 50;
          const pct2 = (s.v2 / max) * 50;
          return `
            <div class="compare-bar-row">
              <div class="compare-bar-label">${s.label}</div>
              <div class="compare-bar-track">
                <div class="compare-bar-fill-left" style="width:${pct1}%"></div>
                <div class="compare-bar-fill-right" style="width:${pct2}%"></div>
              </div>
              <div class="compare-bar-values">
                <span class="compare-bar-val p1">${s.v1}</span>
                <span class="compare-bar-val p2">${s.v2}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="compare-h2h-link" style="text-align:center;margin-top:32px;">
        <a href="h2h.html?p1=${encodeURIComponent(p1.name)}&p2=${encodeURIComponent(p2.name)}" class="btn btn-primary">
          <span>Open Full H2H Comparison Report</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    `;

    result.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ═══════════════════════════════════════
  // LOAD PLAYER DATA
  // ═══════════════════════════════════════
  async function loadPlayerData(name) {
    // Render static data first as immediate fallback
    const staticPlayer = PLAYERS_DB[name];
    if (staticPlayer) {
      renderPlayerUI(staticPlayer);
    }

    try {
      const res = await fetch(`${API_BASE}/players/${encodeURIComponent(name)}`);
      if (res.ok) {
        const d = await res.json();
        const p = {
          name: d.overview.name,
          country: d.overview.nationality + " " + d.overview.flag,
          rank: d.overview.currentRank,
          surfaces: {
            grass: { winPct: d.surfaces.grass.winPct, rating: d.surfaces.grass.serveRating, strength: d.surfaces.grass.strength },
            clay:  { winPct: d.surfaces.clay.winPct, rating: d.surfaces.clay.serveRating, strength: d.surfaces.clay.strength },
            hard:  { winPct: d.surfaces.hard.winPct, rating: d.surfaces.hard.serveRating, strength: d.surfaces.hard.strength },
          },
          stats: {
            serve: d.strengthMeter.serve,
            return: d.strengthMeter.return,
            elo: d.overview.elo,
            pressure: d.strengthMeter.pressurePoints,
            tiebreak: parseInt(d.surfaces.hard.tiebreakRecord.split("-")[0]) * 5 || 70,
            breakPt: d.returnAnalytics.breakConversion.value,
          },
          recentMatches: d.recentMatches.map(m => ({
            opponent: m.opponent,
            event: m.tournament,
            score: m.score,
            result: m.result
          })),
          h2h: d.h2h ? {
            opponent: d.h2h.opponent,
            opponentRank: d.h2h.opponentRank,
            record: d.h2h.record,
            stats: d.h2h.stats
          } : null,
          aiInsights: d.aiInsights ? {
            summary: d.aiInsights.summary,
            strengths: d.aiInsights.strengths,
            weaknesses: d.aiInsights.weaknesses,
            tags: d.aiInsights.tags
          } : {
            summary: d.aiSummary,
            strengths: ["Strong baseline play", "Solid court coverage"],
            weaknesses: ["Second serve can be attacked"],
            tags: ["Baseline Operator"]
          }
        };
        renderPlayerUI(p);
      }
    } catch (err) {
      console.warn("Using static player overview data due to fetch error:", err);
    }
  }

  function renderPlayerUI(p) {
    // Update name references
    const nameSpans = ["#surface-player-name", "#stats-player-name", "#form-player-name", "#ai-player-name"];
    nameSpans.forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = p.name;
    });

    renderSurfaces(p);
    renderStats(p);
    renderForm(p);
    if (p.h2h) {
      renderH2H(p);
      const h2hSec = $("#h2h");
      if (h2hSec) h2hSec.style.display = "";
    } else {
      const h2hSec = $("#h2h");
      if (h2hSec) h2hSec.style.display = "none";
    }
    renderAI(p);
  }

  // ═══════════════════════════════════════
  // SURFACE INSIGHTS
  // ═══════════════════════════════════════
  function renderSurfaces(p) {
    const grid = $("#surface-grid");
    const surfaceData = [
      { key: "grass", label: "Grass",     icon: "🌿", gradient: "grass" },
      { key: "clay",  label: "Clay",      icon: "🧱", gradient: "clay" },
      { key: "hard",  label: "Hard Court", icon: "🏟️", gradient: "hard" },
    ];

    grid.innerHTML = surfaceData.map((s, i) => {
      const d = p.surfaces[s.key];
      const strengthClass = d.strength.toLowerCase();
      return `
        <div class="surface-card ${s.key} reveal" style="transition-delay:${i * 0.1}s">
          <div class="surface-card-header">
            <div class="surface-name">
              <div class="surface-icon">${s.icon}</div>
              <div class="surface-label">${s.label}</div>
            </div>
            <span class="surface-strength strength-${strengthClass}">${d.strength}</span>
          </div>
          <div class="surface-stats">
            <div class="surface-stat">
              <span class="surface-stat-label">Win Rate</span>
              <span class="surface-stat-value">${d.winPct}%</span>
            </div>
            <div class="surface-bar">
              <div class="surface-bar-fill" style="width:${d.winPct}%"></div>
            </div>
            <div class="surface-stat">
              <span class="surface-stat-label">Rating</span>
              <span class="surface-stat-value">${d.rating}</span>
            </div>
            <div class="surface-bar">
              <div class="surface-bar-fill" style="width:${d.rating}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    refreshReveal();
  }

  // ═══════════════════════════════════════
  // STATS OVERVIEW
  // ═══════════════════════════════════════
  function renderStats(p) {
    const grid = $("#stats-grid");
    const statsData = [
      { label: "Serve Rating",       value: p.stats.serve,    emoji: "🎯", sub: "Power & placement" },
      { label: "Return Rating",      value: p.stats.return,   emoji: "🛡️", sub: "Defensive brilliance" },
      { label: "Elo Rating",         value: p.stats.elo,      emoji: "📈", sub: "Overall strength", isElo: true },
      { label: "Pressure Perf.",     value: p.stats.pressure, emoji: "🧠", sub: "Mental fortitude" },
      { label: "Tiebreak Perf.",     value: p.stats.tiebreak, emoji: "⚡", sub: "Clutch moments" },
      { label: "Break Pt Conv.",     value: p.stats.breakPt,  emoji: "💥", sub: "Converting chances" },
    ];

    grid.innerHTML = statsData.map((s, i) => {
      const circumference = 2 * Math.PI * 30;
      const pct = s.isElo ? Math.min(s.value / 2500, 1) : s.value / 100;
      const offset = circumference * (1 - pct);

      return `
        <div class="stat-card reveal" style="transition-delay:${i * 0.08}s">
          <div class="stat-ring">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <defs>
                <linearGradient id="ringGrad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="100%" stop-color="#a78bfa"/>
                </linearGradient>
              </defs>
              <circle class="stat-ring-bg" cx="36" cy="36" r="30"/>
              <circle class="stat-ring-fill" cx="36" cy="36" r="30"
                stroke="url(#ringGrad${i})"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <div class="stat-ring-value">${s.isElo ? s.value : s.value}</div>
          </div>
          <div class="stat-label">${s.label}</div>
          <div class="stat-sub">${s.sub}</div>
        </div>
      `;
    }).join("");

    refreshReveal();
  }

  // ═══════════════════════════════════════
  // RECENT FORM
  // ═══════════════════════════════════════
  function renderForm(p) {
    const timeline = $("#form-timeline");
    timeline.innerHTML = p.recentMatches.map((m, i) => `
      <div class="match-item" style="animation-delay:${i * 0.08}s">
        <div class="match-dot ${m.result}"></div>
        <div class="match-card">
          <div class="match-info">
            <div class="match-opponent">vs ${m.opponent}</div>
            <div class="match-event">${m.event}</div>
          </div>
          <div class="match-score">${m.score}</div>
          <span class="match-result ${m.result}">${m.result}</span>
        </div>
      </div>
    `).join("");

    // Re-trigger animations
    setTimeout(() => {
      $$(".match-item").forEach((el) => {
        el.style.opacity = "1";
      });
    }, 100);
  }

  // ═══════════════════════════════════════
  // HEAD TO HEAD
  // ═══════════════════════════════════════
  function renderH2H(p) {
    const card = $("#h2h-card");
    const h = p.h2h;

    card.innerHTML = `
      <div class="h2h-top">
        <div class="h2h-player">
          <div class="player-avatar">${getInitials(p.name)}</div>
          <div class="h2h-player-name">${p.name}</div>
          <div class="h2h-player-rank">#${p.rank}</div>
        </div>
        <div class="h2h-score">
          <div class="h2h-score-big">${h.record}</div>
          <div class="h2h-score-label">Overall Record</div>
        </div>
        <div class="h2h-player">
          <div class="player-avatar" style="background:linear-gradient(135deg,#06b6d4,#0891b2)">${getInitials(h.opponent)}</div>
          <div class="h2h-player-name">${h.opponent}</div>
          <div class="h2h-player-rank">#${h.opponentRank}</div>
        </div>
      </div>
      <div class="h2h-bars">
        ${Object.entries(h.stats).map(([label, vals]) => {
          const total = vals.p1 + vals.p2;
          const pct1 = (vals.p1 / total) * 100;
          const pct2 = (vals.p2 / total) * 100;
          return `
            <div class="h2h-bar-row">
              <div class="h2h-bar-val">${vals.p1}</div>
              <div class="h2h-bar-center">
                <div class="h2h-bar-label">${label}</div>
                <div class="h2h-bar-track">
                  <div class="h2h-bar-fill-l" style="width:${pct1}%"></div>
                  <div class="h2h-bar-fill-r" style="width:${pct2}%"></div>
                </div>
              </div>
              <div class="h2h-bar-val">${vals.p2}</div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="h2h-deep-link" style="text-align:center;margin-top:32px;">
        <a href="h2h.html?p1=${encodeURIComponent(p.name)}&p2=${encodeURIComponent(h.opponent)}" class="btn btn-primary">
          <span>Open Full H2H Comparison Report</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      </div>
    `;
  }

  // ═══════════════════════════════════════
  // AI INSIGHTS
  // ═══════════════════════════════════════
  function renderAI(p) {
    const card = $("#ai-card");
    const ai = p.aiInsights;

    card.innerHTML = `
      <div class="ai-header">
        <div class="ai-icon">🤖</div>
        <div class="ai-header-text">
          <h3>AI Analysis — ${p.name}</h3>
          <p>Generated from performance data & match history</p>
        </div>
      </div>

      <div class="ai-section">
        <div class="ai-section-title">📋 Overview</div>
        <p class="ai-text">${ai.summary}</p>
      </div>

      <div class="ai-section">
        <div class="ai-section-title">💪 Key Strengths</div>
        <ul class="ai-text" style="padding-left:18px;">
          ${ai.strengths.map((s) => `<li style="margin-bottom:6px;">${s}</li>`).join("")}
        </ul>
      </div>

      <div class="ai-section">
        <div class="ai-section-title">⚠️ Areas to Improve</div>
        <ul class="ai-text" style="padding-left:18px;">
          ${ai.weaknesses.map((w) => `<li style="margin-bottom:6px;">${w}</li>`).join("")}
        </ul>
      </div>

      <div class="ai-tags">
        ${ai.tags.map((t) => `<span class="ai-tag">${t}</span>`).join("")}
      </div>
    `;
  }

  // ═══════════════════════════════════════
  // SCROLL REVEAL
  // ═══════════════════════════════════════
  function initScrollReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    $$(".reveal").forEach((el) => observer.observe(el));

    // Store observer for re-use
    window.__revealObserver = observer;
  }

  function refreshReveal() {
    if (!window.__revealObserver) return;
    $$(".reveal:not(.visible)").forEach((el) => {
      window.__revealObserver.observe(el);
    });
  }

  // ═══════════════════════════════════════
  // SMOOTH SCROLL
  // ═══════════════════════════════════════
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute("href"));
        if (target) {
          target.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }

  // ═══════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════
  function showToast(msg) {
    const existing = $(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #1c2438;
      color: #f0f2f5;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 0.9rem;
      border: 1px solid rgba(99,102,241,0.3);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      z-index: 9999;
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
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
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
})();
