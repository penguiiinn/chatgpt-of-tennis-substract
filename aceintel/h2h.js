/* ═══════════════════════════════════════════
   AceIntel — H2H Comparison Logic
   ═══════════════════════════════════════════ */

// ─── API Config & State ─────────────────
const API_BASE = "https://aceintel-backend.onrender.com";
let p1Key = null, p2Key = null;
let playersList = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── Init ───────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initSelector();
  initAutocomplete();

  // Pre-fill from URL params
  const params = new URLSearchParams(window.location.search);
  const ua = params.get("p1");
  const ub = params.get("p2");
  if (ua && ub) {
    $("#input-p1").value = ua;
    $("#input-p2").value = ub;
    buildReport(ua, ub);
  }
});

// ─── Navbar & Navigation ─────────────
function initNav() {
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      links.classList.toggle("open");
    });
  }

  $$(".nav-link").forEach(l => {
    l.addEventListener("click", () => {
      if (toggle) toggle.classList.remove("active");
      if (links) links.classList.remove("open");
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

// Helper to extract player slug from Tennis Abstract URL
function extractSlug(url) {
  if (!url) return "";
  try {
    const urlObj = new URL(url, "https://www.tennisabstract.com");
    return urlObj.searchParams.get("p") || "";
  } catch (e) {
    return "";
  }
}

// ─── Autocomplete live search ────────
function initAutocomplete() {
  const setupField = (inputId, resultsId) => {
    const input = $(`#${inputId}`);
    const results = $(`#${resultsId}`);
    let debounceTimer;

    input.addEventListener("input", () => {
      // Clear stored selection on manual typing
      delete input.dataset.slug;
      delete input.dataset.name;

      clearTimeout(debounceTimer);
      const query = input.value.trim();

      if (query.length < 2) {
        results.innerHTML = "";
        results.classList.add("hidden");
        return;
      }

      debounceTimer = setTimeout(async () => {
        // Loading state
        results.classList.remove("hidden");
        results.innerHTML = `<div style="padding:12px 16px;color:var(--text-muted);font-size:0.85rem;display:flex;align-items:center;gap:10px">
          <span class="spinner" style="width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);border-top-color:var(--accent);display:inline-block;animation:spin .7s linear infinite"></span>
          Searching…
        </div>`;
        input.setAttribute("aria-busy", "true");

        try {
          const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}&limit=10`;
          console.log("API URL being called:", url);
          const res = await fetch(url);
          console.log("fetch status:", res.status);
          if (!res.ok) throw new Error("Search failed");
          const matches = await res.json();
          console.log("response JSON:", matches);

          if (matches.length === 0) {
            results.innerHTML = `<div style="padding:12px 16px;color:var(--text-muted);font-size:0.85rem">No players found</div>`;
            results.classList.remove("hidden");
            return;
          }

          results.innerHTML = matches.map(m => {
            const tourBadgeClass = m.tour.toLowerCase() === "atp" ? "atp" : "wta";
            const slug = extractSlug(m.url);
            return `
              <div class="search-result-item" data-name="${m.name}" data-slug="${slug}">
                <span>${m.name}</span>
                <span class="tour-badge ${tourBadgeClass}">${m.tour.toUpperCase()}</span>
              </div>
            `;
          }).join("");
          results.classList.remove("hidden");

          // Bind click events on items
          results.querySelectorAll(".search-result-item").forEach(item => {
            item.addEventListener("click", () => {
              const pickedName = item.getAttribute("data-name");
              const pickedSlug = item.getAttribute("data-slug");
              const otherInput = inputId === "input-p1" ? $("#input-p2") : $("#input-p1");
              const otherSlug = otherInput?.dataset?.slug;

              // Prevent duplicate selection
              if (otherSlug && otherSlug === pickedSlug) {
                showToast("Pick a different player for Player 2.");
                return;
              }

              input.value = pickedName;
              input.dataset.name = pickedName;
              input.dataset.slug = pickedSlug;

              results.classList.add("hidden");
              input.removeAttribute("aria-busy");

              // Clear the other dropdown so UX stays clean
              const otherResults = inputId === "input-p1" ? $("#results-p2") : $("#results-p1");
              if (otherResults) otherResults.classList.add("hidden");
            });
          });

        } catch (err) {
          console.warn("Failed to fetch search results:", err);
        } finally {
          input.removeAttribute("aria-busy");
        }
      }, 300);
    });

    // Hide dropdown on blur/click away, but delay slightly so clicks can register
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.classList.add("hidden");
      }
    });

    // Show again if clicked and contains query
    input.addEventListener("click", () => {
      if (input.value.trim().length >= 2 && results.innerHTML !== "") {
        results.classList.remove("hidden");
      }
    });
  };

  setupField("input-p1", "results-p1");
  setupField("input-p2", "results-p2");
}

// ─── Selector ───────────────────────
function initSelector() {
  $("#btn-compare").addEventListener("click", () => {
    const p1 = $("#input-p1");
    const p2 = $("#input-p2");

    const a = p1.dataset.slug;
    const b = p2.dataset.slug;

    if (!a || !b) { showToast("Please select both players from the suggestions."); return; }
    if (a.toLowerCase() === b.toLowerCase()) { showToast("Please select two different players."); return; }


    // Update URL
    const url = new URL(window.location);
    url.searchParams.set("p1", p1.dataset.name || p1.value.trim());
    url.searchParams.set("p2", p2.dataset.name || p2.value.trim());
    window.history.pushState({}, "", url);

    buildReport(a, b);
  });
}

// ═══════════════════════════════════════
// RESOLVE SLUG TO FULL NAME (share with homepage search)
// ═══════════════════════════════════════
async function resolveSlugToName(slug) {
  // If already has space, assume full name
  if (slug.includes(" ")) return slug;

  try {
    const url = `${API_BASE}/api/search?name=${encodeURIComponent(slug)}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return slug;
    const matches = await res.json();

    // Find best match: exact match first, then partial match
    const best = matches.find(m => m.name.toLowerCase() === slug.toLowerCase())
      || matches.find(m => m.name.toLowerCase().includes(slug.toLowerCase()))
      || matches[0];
    return best ? best.name : slug;
  } catch (e) {
    console.warn("Failed to resolve slug:", slug, e);
    return slug;
  }
}

// ═══════════════════════════════════════
// BUILD FULL REPORT
// ═══════════════════════════════════════
async function buildReport(a, b) {
  // Resolve slugs to full names (like homepage does)
  const [nameA, nameB] = await Promise.all([
    resolveSlugToName(a),
    resolveSlugToName(b)
  ]);
  p1Key = nameA; p2Key = nameB;

  const report = $("#h2h-report");
  report.classList.remove("hidden");

  let data = null;
  let matchupIntel = null;
  try {
    // Use resolved full names for API calls
    const url1 = `${API_BASE}/api/h2h?p1=${encodeURIComponent(nameA)}&p2=${encodeURIComponent(nameB)}`;
    const url2 = `${API_BASE}/api/matchup/${encodeURIComponent(nameA)}/${encodeURIComponent(nameB)}`;
    console.log("API URL being called:", url1);
    console.log("API URL being called:", url2);

    const [h2hRes, matchupRes] = await Promise.all([
      fetch(url1),
      fetch(url2)
    ]);
    
    console.log("fetch status:", h2hRes.status);
    console.log("fetch status:", matchupRes.status);

    if (h2hRes.ok) {
      data = await h2hRes.json();
      console.log("response JSON:", data);
    }
    if (matchupRes.ok) {
      matchupIntel = await matchupRes.json();
      console.log("response JSON:", matchupIntel);
    }
  } catch (err) {
    console.warn("Failed to fetch API data from server, using fallback data", err);
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

  // Generate fallback matchup intelligence if missing/offline
  if (!matchupIntel) {
    matchupIntel = getMockMatchupIntelligence(pa, pb, matchup);
  }

  // Determine which player is "a" in the data (alphabetical)
  const [dataA, dataB] = getDataOrder(a, b);
  const paIsDataA = (a === dataA);

  renderOverview(pa, pb, meetings, paIsDataA);
  renderSurfaces(pa, pb, meetings);
  renderHistory(pa, pb, meetings, paIsDataA);
  renderClash(pa, pb, style, paIsDataA);
  renderMatchup(pa, pb, matchup, paIsDataA);
  renderPredictNew(pa, pb, matchupIntel);
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

  // Dynamic tour label calculation
  const tourA = oa.tour || (["Carlos Alcaraz", "Jannik Sinner", "Novak Djokovic"].includes(oa.name) ? "ATP" : "WTA");
  const tourB = ob.tour || (["Carlos Alcaraz", "Jannik Sinner", "Novak Djokovic"].includes(ob.name) ? "ATP" : "WTA");

  // Form Streak Helper
  const getFormStreak = (arr) => {
    if (!arr || arr.length === 0) return "N/A";
    const first = arr[0];
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === first) count++;
      else break;
    }
    return `${count}${first}`;
  };

  const streakA = getFormStreak(oa.recentForm);
  const streakB = getFormStreak(ob.recentForm);

  const isWinA = streakA.endsWith("W");
  const isWinB = streakB.endsWith("W");
  const numStreakA = parseInt(streakA) || 0;
  const numStreakB = parseInt(streakB) || 0;

  let isStreakABetter = false;
  let isStreakEqual = false;
  if (isWinA && !isWinB) isStreakABetter = true;
  else if (!isWinA && isWinB) isStreakABetter = false;
  else if (isWinA && isWinB) {
    if (numStreakA === numStreakB) isStreakEqual = true;
    else isStreakABetter = numStreakA > numStreakB;
  } else {
    if (numStreakA === numStreakB) isStreakEqual = true;
    else isStreakABetter = numStreakA < numStreakB; // fewer consecutive losses is better
  }

  const streakColorA = isStreakEqual ? "var(--text-muted)" : (isStreakABetter ? "var(--green)" : "var(--red-dim)");
  const streakColorB = isStreakEqual ? "var(--text-muted)" : (isStreakABetter ? "var(--red-dim)" : "var(--green)");
  const streakBadgeA = isStreakEqual ? "=" : (isStreakABetter ? "▲" : "▼");
  const streakBadgeB = isStreakEqual ? "=" : (isStreakABetter ? "▼" : "▲");

  const buildComparisonRow = (label, valA, valB, suffix = "", lowerIsBetter = false) => {
    let indicatorClassA = "", indicatorClassB = "";
    let indicatorBadgeA = "", indicatorBadgeB = "";

    const numA = parseFloat(valA);
    const numB = parseFloat(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA === numB) {
        indicatorClassA = "equal";
        indicatorClassB = "equal";
        indicatorBadgeA = `<span style="color:var(--text-muted); font-size:0.75rem;">=</span>`;
        indicatorBadgeB = `<span style="color:var(--text-muted); font-size:0.75rem;">=</span>`;
      } else {
        const aIsBetter = lowerIsBetter ? (numA < numB) : (numA > numB);
        if (aIsBetter) {
          indicatorClassA = "better";
          indicatorClassB = "worse";
          indicatorBadgeA = `<span style="color:var(--green); font-size:0.8rem; font-weight:bold;">▲</span>`;
          indicatorBadgeB = `<span style="color:var(--red); font-size:0.8rem; font-weight:bold;">▼</span>`;
        } else {
          indicatorClassA = "worse";
          indicatorClassB = "better";
          indicatorBadgeA = `<span style="color:var(--red); font-size:0.8rem; font-weight:bold;">▼</span>`;
          indicatorBadgeB = `<span style="color:var(--green); font-size:0.8rem; font-weight:bold;">▲</span>`;
        }
      }
    }

    return `
      <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:0.85rem;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${indicatorBadgeA}
          <span style="font-family:var(--font-mono); font-weight:700; ${indicatorClassA === 'better' ? 'color:var(--green);' : indicatorClassA === 'worse' ? 'color:var(--text-muted);' : ''}">${valA}${suffix}</span>
        </div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; font-weight:600; text-align:center; min-width:140px;">${label}</div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
          <span style="font-family:var(--font-mono); font-weight:700; ${indicatorClassB === 'better' ? 'color:var(--green);' : indicatorClassB === 'worse' ? 'color:var(--text-muted);' : ''}">${valB}${suffix}</span>
          ${indicatorBadgeB}
        </div>
      </div>
    `;
  };

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

      <!-- Overview stats comparative grid extension -->
      <div class="h2h-comparison-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:24px; margin-top:32px;">
        <!-- rankings card -->
        <div class="h2h-comp-card reveal" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); overflow:hidden; padding-bottom:12px;">
          <div style="background:rgba(255,255,255,0.02); padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; display:flex; align-items:center; gap:10px; color:var(--accent-hover);">
            <span>📈</span> Rankings & Form Comparison
          </div>
          <div style="display:flex; flex-direction:column;">
            ${buildComparisonRow(`${tourA} Rank`, oa.currentRank, ob.currentRank, "", true)}
            ${buildComparisonRow("Peak Rank", oa.peakRank, ob.peakRank, "", true)}
            ${buildComparisonRow("Elo Rating", oa.elo, ob.elo, "")}
            ${buildComparisonRow("Career Win Rate", oa.careerWinPct, ob.careerWinPct, "%")}
            ${buildComparisonRow("YTD Win Rate", oa.ytdWinPct, ob.ytdWinPct, "%")}
            <!-- Form Streak Row -->
            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.02); font-size:0.85rem;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:${streakColorA === 'var(--green)' ? 'var(--green)' : streakColorA === 'var(--red-dim)' ? 'var(--red)' : 'var(--text-muted)'}; font-size:0.8rem; font-weight:bold;">${streakBadgeA}</span>
                <span style="font-family:var(--font-mono); font-weight:700; color:${streakColorA}">${streakA}</span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; font-weight:600; text-align:center; min-width:140px;">Form Streak</div>
              <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                <span style="font-family:var(--font-mono); font-weight:700; color:${streakColorB}">${streakB}</span>
                <span style="color:${streakColorB === 'var(--green)' ? 'var(--green)' : streakColorB === 'var(--red-dim)' ? 'var(--red)' : 'var(--text-muted)'}; font-size:0.8rem; font-weight:bold;">${streakBadgeB}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- serve card -->
        <div class="h2h-comp-card reveal" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); overflow:hidden; padding-bottom:12px;">
          <div style="background:rgba(255,255,255,0.02); padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; display:flex; align-items:center; gap:10px; color:var(--accent-hover);">
            <span>🎯</span> Serve Analytics Comparison
          </div>
          <div style="display:flex; flex-direction:column;">
            ${buildComparisonRow("Serve Rating", pa.strengthMeter.serve, pb.strengthMeter.serve, "")}
            ${buildComparisonRow("First Serve In", pa.serve.firstServePct.value, pb.serve.firstServePct.value, "%")}
            ${buildComparisonRow("1st Serve Won", pa.serve.firstServeWonPct.value, pb.serve.firstServeWonPct.value, "%")}
            ${buildComparisonRow("2nd Serve Won", pa.serve.secondServeWonPct.value, pb.serve.secondServeWonPct.value, "%")}
            ${buildComparisonRow("Aces %", pa.serve.acesPct.value, pb.serve.acesPct.value, "%")}
            ${buildComparisonRow("Double Faults %", pa.serve.doubleFaultsPct.value, pb.serve.doubleFaultsPct.value, "%", true)}
            ${buildComparisonRow("Break Points Saved", pa.serve.breakPointsSavedPct.value, pb.serve.breakPointsSavedPct.value, "%")}
          </div>
        </div>

        <!-- return card -->
        <div class="h2h-comp-card reveal" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-xl); overflow:hidden; padding-bottom:12px;">
          <div style="background:rgba(255,255,255,0.02); padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.06em; display:flex; align-items:center; gap:10px; color:var(--accent-hover);">
            <span>🛡️</span> Return Analytics Comparison
          </div>
          <div style="display:flex; flex-direction:column;">
            ${buildComparisonRow("Return Rating", pa.strengthMeter.return, pb.strengthMeter.return, "")}
            ${buildComparisonRow("Return Points Won", pa.returnAnalytics.returnPointsWon.value, pb.returnAnalytics.returnPointsWon.value, "%")}
            ${buildComparisonRow("BP Conversion", pa.returnAnalytics.breakConversion.value, pb.returnAnalytics.breakConversion.value, "%")}
            ${buildComparisonRow("Return Games Won", pa.returnAnalytics.returnGamesWon.value, pb.returnAnalytics.returnGamesWon.value, "%")}
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
function renderSurfaces(pa, pb, meetings) {
  const surfaces = [
    { key: "grass", label: "Grass", icon: "🌿", cls: "grass" },
    { key: "clay", label: "Clay", icon: "🧱", cls: "clay" },
    { key: "hard", label: "Hard Court", icon: "🏟️", cls: "hard" },
    { key: "indoor", label: "Indoor", icon: "🏢", cls: "indoor" },
  ];

  // Compute surface-wise H2H record
  const surfaceH2H = { grass: { a: 0, b: 0 }, clay: { a: 0, b: 0 }, hard: { a: 0, b: 0 }, indoor: { a: 0, b: 0 } };
  
  if (meetings && meetings.meetings) {
    const nameA = pa.overview.name.toLowerCase().split(" ")[0];
    meetings.meetings.forEach(m => {
      const winnerName = m.winner.toLowerCase();
      const isWinnerA = winnerName.includes(nameA);
      
      const sKey = m.surface.toLowerCase(); // 'hard', 'clay', 'grass', 'indoor'
      if (surfaceH2H[sKey]) {
        if (isWinnerA) {
          surfaceH2H[sKey].a++;
        } else {
          surfaceH2H[sKey].b++;
        }
      }
    });
  }

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
            <!-- Surface H2H Record -->
            <span style="margin-left: 16px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-family: var(--font-mono); font-weight: 700; color: var(--text-primary)">
              H2H: ${surfaceH2H[s.key].a} – ${surfaceH2H[s.key].b}
            </span>
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

  // Slice meetings list to show only the last 5 meetings
  const last5Meetings = meetings.meetings.slice(0, 5);

  const tableRows = last5Meetings.map((m, i) => {
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
function renderPredictNew(pa, pb, mi) {
  const el = $("#predict-content");
  if (!mi) {
    el.innerHTML = `<p style="text-align:center;color:var(--text-muted)">Matchup prediction unavailable.</p>`;
    return;
  }

  const confCls = mi.confidence.toLowerCase() === "high" ? "confidence-high" : mi.confidence.toLowerCase() === "medium" ? "confidence-medium" : "confidence-low";

  const edges = mi.edges || {
    surfaceEdge: "Neutral / Insufficient Data",
    recentFormEdge: "Neutral / Insufficient Data",
    historicalEdge: "Neutral / Insufficient Data",
    h2hEdge: "Neutral / Insufficient Data"
  };

  const advantagesHtml = mi.advantages.map(a => `
    <li class="prob-reason" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
      <span style="color:var(--green);font-weight:bold;margin-top:1px;">✓</span>
      <span style="color:var(--text-secondary);font-size:0.88rem;">${a}</span>
    </li>
  `).join("");

  const riskFactorsHtml = mi.riskFactors.map(rf => `
    <li class="prob-reason" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
      <span style="color:var(--red);font-weight:bold;margin-top:1px;">⚠</span>
      <span style="color:var(--text-secondary);font-size:0.88rem;">${rf}</span>
    </li>
  `).join("");

  // Determine progress bar fill percentages
  const p1Name = pa.overview.name;
  const p2Name = pb.overview.name;

  let fillPctL = 50;
  let fillPctR = 50;
  if (mi.favorite === p1Name) {
    fillPctL = mi.winProbability;
    fillPctR = 100 - mi.winProbability;
  } else {
    fillPctL = 100 - mi.winProbability;
    fillPctR = mi.winProbability;
  }

  el.innerHTML = `
    <div class="mi-result-card reveal" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:36px 32px;">
      <!-- Confidence & Favorite Banner -->
      <div class="mi-header-row" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:18px;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
        <div>
          <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Predicted Favorite</span>
          <h3 style="font-size:1.6rem;font-weight:900;color:var(--text-primary);margin-top:4px;">🏆 ${mi.favorite}</h3>
        </div>
        <div style="text-align:right">
          <span class="predict-confidence-badge ${confCls}" style="padding:5px 16px;border-radius:var(--radius-full);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${mi.confidence} Confidence</span>
          <div class="prob-pct" style="font-size:2rem;font-weight:900;font-family:var(--font-mono);background:var(--gradient-hero);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-top:4px;">${mi.winProbability}%</div>
        </div>
      </div>

      <!-- Probability Bar -->
      <div class="prob-bar-container" style="margin-bottom:32px;">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;font-weight:600;letter-spacing:0.04em;">
          <span>${p1Name}</span>
          <span>${p2Name}</span>
        </div>
        <div class="prob-bar-track" style="height:10px;background:rgba(255,255,255,0.05);border-radius:5px;position:relative;overflow:hidden;display:flex;">
          <div class="prob-bar-fill-l" style="width:${fillPctL}%;height:100%;background:var(--accent);transition:width 1s var(--ease);"></div>
          <div class="prob-bar-fill-r" style="width:${fillPctR}%;height:100%;background:var(--cyan);transition:width 1s var(--ease);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:0.85rem;margin-top:6px;font-weight:700;">
          <span class="p1c" style="color:var(--accent-hover);">${fillPctL}%</span>
          <span class="p2c" style="color:var(--cyan);">${fillPctR}%</span>
        </div>
      </div>

      <!-- Key Advantage Breakdown -->
      <div class="key-advantages-breakdown reveal" style="margin-bottom: 32px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-lg);">
        <h4 style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--accent); margin-top:0; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:6px; font-weight:700; display:flex; align-items:center; gap:6px;">
          <span>⚡</span> Key Advantage Breakdown
        </h4>
        <div class="edges-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <!-- Surface Edge Card -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">Surface Edge</span>
            <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:6px; text-align:left;">
              <span style="color:var(--accent);">🎾</span> ${edges.surfaceEdge}
            </span>
          </div>
          <!-- Recent Form Edge Card -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">Recent Form Edge</span>
            <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:6px; text-align:left;">
              <span style="color:var(--green);">📈</span> ${edges.recentFormEdge}
            </span>
          </div>
          <!-- Historical Edge Card -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">Historical Edge</span>
            <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:6px; text-align:left;">
              <span style="color:var(--cyan);">⏳</span> ${edges.historicalEdge}
            </span>
          </div>
          <!-- H2H Edge Card -->
          <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.04em;">H2H Edge</span>
            <span style="font-size:0.85rem; color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:6px; text-align:left;">
              <span style="color:var(--accent-hover);">⚔️</span> ${edges.h2hEdge}
            </span>
          </div>
        </div>
      </div>

      <!-- Advantages vs Risk Factors Grid -->
      <div class="mi-details-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px;">
        <div>
          <h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--green);margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:6px;">Advantages for ${mi.favorite}</h4>
          <ul style="list-style:none;padding:0;">
            ${advantagesHtml}
          </ul>
        </div>
        <div>
          <h4 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--red);margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:6px;">Risk Factors / Vulnerabilities</h4>
          <ul style="list-style:none;padding:0;">
            ${riskFactorsHtml}
          </ul>
        </div>
      </div>

      <!-- Reasoning & Key Battle -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- Reasoning -->
        <div class="predict-reasoning" style="margin:0;border-left:3px solid var(--accent);background:rgba(255,255,255,0.01);padding:18px 20px;border-radius:var(--radius-sm);">
          <span style="display:block;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:6px;">AI Matchup Reasoning</span>
          <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.65;text-align:left;margin:0;">${mi.reasoning}</p>
        </div>

        <!-- Key Battle -->
        <div class="predict-reasoning" style="margin:0;border-left:3px solid var(--cyan);background:rgba(255,255,255,0.01);padding:18px 20px;border-radius:var(--radius-sm);">
          <span style="display:block;font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:6px;">🔑 Key Tactical Battle</span>
          <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.65;text-align:left;margin:0;">${mi.keyBattle}</p>
        </div>
      </div>
    </div>
  `;

  refreshReveal();
}

function getMockMatchupIntelligence(pa, pb, matchup) {
  const winA = matchup?.winProb?.a || 50;
  const winB = matchup?.winProb?.b || 50;
  const favorite = winA >= winB ? pa.overview.name : pb.overview.name;
  const winProbability = Math.max(winA, winB);
  const confidence = matchup?.confidence || "Medium";
  const advantages = matchup?.reasons?.[winA >= winB ? "a" : "b"] || ["Overall statistical advantage."];
  const riskFactors = matchup?.reasons?.[winA >= winB ? "b" : "a"]?.map(r => `Opponent holds advantage in: ${r}`) || ["Potential drop in baseline consistency."];
  const keyBattle = `Baseline Consistency: Overall surface capability clash.`;
  const reasoning = matchup?.aiSummary || `Matchup analysis between ${pa.overview.name} and ${pb.overview.name}.`;

  return {
    favorite,
    winProbability,
    confidence,
    advantages,
    reasoning,
    riskFactors,
    keyBattle
  };
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

