// Arro Phase 1 prototype. Everything the user picks is kept only in this
// browser (localStorage). Nothing is sent anywhere. All places are mock data.

const STORE_KEY = "arro.answers";
const INCOME_LABELS = {
  "under-20": "Under $20,000",
  "20-35": "$20,000 – $35,000",
  "35-55": "$35,000 – $55,000",
  "over-55": "Over $55,000",
  "no-say": "Prefer not to say",
};
const DEFAULTS = { need: "Teeth cleaning", household: "1", income: "20-35", location: true, saved: [] };

/* ---------- Mock places (from the brief). Prices are estimates, not quotes. ---------- */
const PLACES = [
  {
    id: "1", rank: 1, type: "Community health center", name: "[Clinic name]",
    address: "[Street address]", miles: 4.2, hours: "Open until 6 PM", open: true,
    low: 0, high: 30, tag: "Best match", nextOpening: "~2 wks",
    facts: ["Sliding scale based on your income", "Can't turn you away for not being able to pay", "Next opening in about 2 weeks"],
    costs: [["Exam", "$0 – $10"], ["Cleaning", "$0 – $15"], ["X-rays", "$0 – $5", "Only if they're due"]],
    costNote: "Based on your income and this clinic's published sliding scale. Estimate, not a quote.",
    script: "“Hi, I'm uninsured and need a cleaning. Can I be screened for your sliding fee scale, and when's your next new-patient opening?”",
    bring: ["Photo ID", "Proof of income", "Proof of address"],
    route: { from: [62, 140], to: [262, 58] },
  },
  {
    id: "2", rank: 2, type: "Dental school clinic", name: "[School name] Dental Clinic",
    address: "[Street address]", miles: 11, hours: "Open until 5 PM", open: true,
    low: 40, high: 90, tag: "Low cost", nextOpening: "~1 wk",
    facts: ["Students supervised by licensed dentists", "Visits take 2–3 hours", "Waitlist about 1 week"],
    costs: [["Exam", "$10 – $25"], ["Cleaning", "$25 – $50"], ["X-rays", "$5 – $15", "Only if they're due"]],
    costNote: "Based on this school's published patient fees. Estimate, not a quote.",
    script: "“Hi, I'm uninsured and need a cleaning. Are you taking new patients, and what are your fees for an exam and cleaning?”",
    bring: ["Photo ID", "List of any medications", "Payment for your first visit"],
    route: { from: [50, 120], to: [300, 70] },
  },
  {
    id: "3", rank: 3, type: "Private dentist (cash price)", name: "[Practice name]",
    address: "[Street address]", miles: 1.8, hours: "Open until 7 PM", open: true,
    low: 95, high: 180, tag: "Fastest", nextOpening: "This wk",
    facts: ["Ask for the self-pay discount", "Same-week appointments", "Written estimate on request"],
    costs: [["Exam", "$40 – $70"], ["Cleaning", "$45 – $90"], ["X-rays", "$10 – $20", "Only if they're due"]],
    costNote: "Based on typical self-pay prices in your area. Estimate, not a quote.",
    script: "“Hi, I don't have insurance. What's your self-pay price for an exam and cleaning, and can I get a written estimate?”",
    bring: ["Photo ID", "Payment method", "List of any medications"],
    route: { from: [120, 145], to: [230, 72] },
  },
];
const byId = id => PLACES.find(p => p.id === id);
const price = p => `$${p.low}–${p.high}`;

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(answers)); } catch {}
}
let answers = load();

const $ = id => document.getElementById(id);
const icon = (name, cls = "icon") => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Navigation (uses the URL #hash so the phone's back button works) ---------- */
const screens = [...document.querySelectorAll("[data-screen]")];
const TABS = ["discover", "saved", "rights", "profile"];
let visitedInApp = false;

function show(route) {
  let [name, id] = route.split("-");
  if (name === "place" && !byId(id)) name = "discover";
  if (!screens.some(s => s.dataset.screen === name)) name = "splash";
  screens.forEach(s => s.classList.toggle("active", s.dataset.screen === name));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", name === "splash" ? "#16284A" : "#F5F3EE");

  const tabbar = $("tabbar");
  tabbar.hidden = !TABS.includes(name);
  tabbar.querySelectorAll("[data-tab]").forEach(b => {
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });

  if (name === "discover") renderDiscover();
  if (name === "place") renderPlace(byId(id));
  if (name === "saved") renderSaved();
  if (name === "profile") renderSummary();
  window.scrollTo(0, 0);
}

function go(route) { visitedInApp = true; location.hash = route; }

document.addEventListener("click", e => {
  const el = e.target.closest("[data-go], [data-back], [data-toast]");
  if (!el) return;
  if (el.hasAttribute("data-toast")) return toast(el.dataset.toast);
  if (el.hasAttribute("data-back")) {
    if (visitedInApp) history.back(); else location.hash = "discover";
    return;
  }
  if (el.hasAttribute("data-skip-need")) { answers.need = null; save(); }
  go(el.dataset.go);
});
window.addEventListener("hashchange", () => show(location.hash.slice(1)));

/* ---------- 3 · What do you need? ---------- */
const options = [...document.querySelectorAll(".option")];
const search = $("need-search");
const noResults = document.querySelector(".no-results");

function syncNeed() {
  options.forEach(o => o.setAttribute("aria-checked", String(o.dataset.need === answers.need)));
}
options.forEach(o => o.addEventListener("click", () => {
  answers.need = o.dataset.need; save(); syncNeed();
}));
search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  let shown = 0;
  options.forEach(o => {
    const hit = !q || (o.dataset.need + " " + o.dataset.keywords).toLowerCase().includes(q);
    o.hidden = !hit; if (hit) shown++;
  });
  noResults.hidden = shown > 0;
});

/* ---------- 4 · Estimate your cost ---------- */
const household = $("household");
const thumb = household.querySelector(".seg-thumb");
const segButtons = [...household.querySelectorAll("button")];
const incomeRows = [...document.querySelectorAll("#income .list-row")];
const locationSwitch = $("use-location");

function syncHousehold() {
  const i = Math.max(0, segButtons.findIndex(b => b.dataset.value === answers.household));
  segButtons.forEach((b, j) => b.setAttribute("aria-checked", String(j === i)));
  thumb.style.transform = `translateX(${i * 100}%)`;
}
segButtons.forEach(b => b.addEventListener("click", () => {
  answers.household = b.dataset.value; save(); syncHousehold();
}));

function syncIncome() {
  incomeRows.forEach(r => r.setAttribute("aria-checked", String(r.dataset.value === answers.income)));
}
incomeRows.forEach(r => r.addEventListener("click", () => {
  answers.income = r.dataset.value; save(); syncIncome();
}));

locationSwitch.addEventListener("change", () => { answers.location = locationSwitch.checked; save(); });

/* ---------- 5 · Discover ---------- */
// Sorting changes the ranking on purpose; inside one sort the order never shuffles.
const SORTS = {
  best: list => [...list].sort((a, b) => a.rank - b.rank),
  cost: list => [...list].sort((a, b) => a.low - b.low || a.high - b.high),
  close: list => [...list].sort((a, b) => a.miles - b.miles),
  open: list => list.filter(p => p.open).sort((a, b) => a.rank - b.rank),
};
let sort = "best";
let deckOrder = [];
let current = 0;
let builtFor = "";

function isSaved(id) { return answers.saved.includes(id); }
function setSaved(id, on) {
  answers.saved = answers.saved.filter(x => x !== id);
  if (on) answers.saved.push(id);
  save(); syncBadge();
}
function syncBadge() {
  const b = $("saved-badge");
  b.textContent = answers.saved.length; b.hidden = answers.saved.length === 0;
}

function mapSvg(p, tall = false) {
  const [fx, fy] = p.route.from, [tx, ty] = p.route.to;
  const mx = (fx + tx) / 2, my = Math.max(fy, ty) - 10;
  return `<svg viewBox="0 0 350 168" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="350" height="168" fill="var(--map)"/>
    <g fill="none" stroke="var(--paper)" stroke-width="12">
      <path d="M95 -10 V180"/><path d="M262 -10 C264 60, 268 120, 272 180"/>
      <path d="M-10 62 H360"/><path d="M-10 130 C110 126, 240 120, 360 114"/>
    </g>
    <path d="M${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}" fill="none" stroke="var(--coral)" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 10"/>
    <circle cx="${fx}" cy="${fy}" r="8" fill="var(--card)" stroke="var(--navy)" stroke-width="3.5"/>
    <circle cx="${tx}" cy="${ty}" r="17" fill="var(--navy)"/><circle cx="${tx}" cy="${ty}" r="6" fill="var(--coral)"/>
  </svg>`;
}

function cardHtml(p, i, total) {
  return `<article class="card" data-id="${p.id}" aria-label="${p.type}, ${p.name}, ${price(p)} estimated">
    <div class="card-map">${mapSvg(p)}
      <span class="rank-chip">${i + 1} of ${total}</span>
      <span class="chip">${p.tag}</span>
    </div>
    <div class="card-body">
      <span class="eyebrow">${p.type}</span>
      <h2 class="card-name">${p.name}</h2>
      <span class="card-meta">${p.miles} mi · ${p.hours}</span>
      <div class="price-box"><span class="price">${price(p)}</span><span class="price-note">est. out of pocket</span></div>
      <ul class="facts">${p.facts.map(f => `<li>${icon("check", "")}${f}</li>`).join("")}</ul>
    </div>
    <span class="swipe-label skip">Skip</span>
    <span class="swipe-label open">Details</span>
  </article>`;
}

function endCardHtml() {
  return `<article class="card end">
    <span class="end-mark">${icon("chevrons")}</span>
    <h2>That's everyone nearby</h2>
    <p>You've seen every match for this search. Start over to look again, or check the places you saved.</p>
    <button class="btn btn-paper" id="start-over">${icon("redo")} Start over</button>
  </article>`;
}

function renderDiscover() {
  $("disc-need").textContent = answers.need || "All care";
  const key = sort + "|" + (answers.need || "");
  if (key !== builtFor) {
    builtFor = key; current = 0;
    deckOrder = SORTS[sort](PLACES);
    $("deck").innerHTML = deckOrder.map((p, i) => cardHtml(p, i, deckOrder.length)).join("") + endCardHtml();
    $("deck").querySelectorAll(".card[data-id]").forEach(attachSwipe);
    $("start-over").addEventListener("click", () => { current = 0; layoutDeck(); });
  }
  $("disc-count").textContent = `${deckOrder.length} match${deckOrder.length === 1 ? "" : "es"} near you`;
  document.querySelectorAll("#filters button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.sort === sort)));
  renderMatchList();
  syncBadge();
  layoutDeck();
}

function layoutDeck() {
  const cards = [...$("deck").children];
  cards.forEach((c, i) => {
    c.classList.remove("dragging");
    c.querySelectorAll(".swipe-label").forEach(l => (l.style.opacity = 0));
    c.classList.toggle("behind", i === current + 1);
    c.style.zIndex = String(cards.length - i);
    c.hidden = i < current - 1 || i > current + 1;
    if (i < current) { c.style.transform = c.dataset.out || "translateX(-130%) rotate(-12deg)"; c.style.opacity = 0; }
    else if (i === current) { c.style.transform = ""; c.style.opacity = 1; }
    else { c.style.transform = ""; c.style.opacity = ""; }
    c.setAttribute("aria-hidden", String(i !== current));
  });
  const atEnd = current >= deckOrder.length;
  ["act-skip", "act-save", "act-open"].forEach(id => ($(id).disabled = atEnd));
}

function topCard() { return $("deck").children[current]; }
function currentPlace() { return deckOrder[current]; }

function skip() {
  const c = topCard(); if (!c || !currentPlace()) return;
  c.dataset.out = "translateX(-130%) rotate(-12deg)";
  current++; layoutDeck();
}
function openDetails() {
  const p = currentPlace(); if (!p) return;
  const c = topCard();
  c.style.transform = "translateX(130%) rotate(12deg)"; c.style.opacity = 0;
  setTimeout(() => go("place-" + p.id), 220);
}
function saveCurrent() {
  const p = currentPlace(); if (!p) return;
  setSaved(p.id, true);
  $("act-save").classList.remove("pop"); void $("act-save").offsetWidth; $("act-save").classList.add("pop");
  toast(`Saved ${p.name}`);
  topCard().dataset.out = "translateY(-120%) scale(.9)";
  current++; layoutDeck();
}

$("act-skip").addEventListener("click", skip);
$("act-open").addEventListener("click", openDetails);
$("act-save").addEventListener("click", saveCurrent);

function attachSwipe(card) {
  let startX = 0, startY = 0, dx = 0, active = false;
  const labelSkip = card.querySelector(".swipe-label.skip");
  const labelOpen = card.querySelector(".swipe-label.open");
  card.addEventListener("pointerdown", e => {
    if (card !== topCard()) return;
    active = true; startX = e.clientX; startY = e.clientY; dx = 0;
    card.setPointerCapture(e.pointerId); card.classList.add("dragging");
  });
  card.addEventListener("pointermove", e => {
    if (!active) return;
    dx = e.clientX - startX;
    const dy = (e.clientY - startY) * 0.2;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    labelSkip.style.opacity = Math.min(1, Math.max(0, -dx / 90));
    labelOpen.style.opacity = Math.min(1, Math.max(0, dx / 90));
  });
  const end = () => {
    if (!active) return;
    active = false; card.classList.remove("dragging");
    if (dx < -100) skip();
    else if (dx > 100) openDetails();
    else if (Math.abs(dx) < 6) openDetails(); // a tap opens details too
    else layoutDeck();
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", () => { active = false; layoutDeck(); });
}

// Keyboard: left arrow skips, right arrow opens details
document.addEventListener("keydown", e => {
  if (!document.querySelector('[data-screen="discover"].active') || $("deck-wrap").hidden) return;
  if (e.key === "ArrowLeft") skip();
  if (e.key === "ArrowRight") openDetails();
});

$("filters").addEventListener("click", e => {
  const b = e.target.closest("[data-sort]"); if (!b) return;
  sort = b.dataset.sort; renderDiscover();
});

$("view-toggle").addEventListener("click", () => {
  const listOn = $("view-toggle").getAttribute("aria-pressed") !== "true";
  $("view-toggle").setAttribute("aria-pressed", String(listOn));
  $("view-toggle").setAttribute("aria-label", listOn ? "Show as cards" : "Show as list");
  $("deck-wrap").hidden = listOn; $("match-list").hidden = !listOn;
});

function rowHtml(p) {
  return `<button class="match-row" data-go="place-${p.id}">
    <span class="match-row-main">
      <span class="chip">${p.tag}</span>
      <span class="eyebrow">${p.type}</span>
      <span class="match-row-name">${p.name}</span>
      <span class="match-row-meta">${p.miles} mi · ${p.hours}</span>
    </span>
    <span class="match-row-price">${price(p)}<small>est. out of pocket</small></span>
  </button>`;
}
function renderMatchList() { $("match-list").innerHTML = deckOrder.map(rowHtml).join(""); }

/* ---------- 6 · Place details ---------- */
let placeId = null;
function renderPlace(p) {
  placeId = p.id;
  syncPlaceSave();
  const total = `$${p.low} – $${p.high}`;
  $("place-sheet").innerHTML = `
    <div class="sheet-head"><span class="eyebrow">${p.type}</span><span class="chip">${p.tag}</span></div>
    <h1 class="sheet-name">${p.name}</h1>
    <p class="sheet-meta">${p.address} · ${p.miles} mi · <strong>${p.hours}</strong></p>

    <div class="tiles">
      <button class="tile primary" data-toast="Calling is turned off in the prototype.">${icon("phone")}Call</button>
      <button class="tile" data-toast="Directions are coming later.">${icon("nav")}Directions</button>
      <button class="tile" data-toast="Clinic websites are coming later.">${icon("globe")}Website</button>
      <button class="tile" data-toast="Booking is coming later.">${icon("cal")}Book</button>
    </div>

    <div class="stats">
      <div class="stat"><span>You'd pay</span><strong>${price(p)}</strong></div>
      <div class="stat"><span>Distance</span><strong>${p.miles} mi</strong></div>
      <div class="stat"><span>Next opening</span><strong>${p.nextOpening}</strong></div>
    </div>

    <h2 class="h2">Your estimated cost</h2>
    <div class="list-card cost-list">
      ${p.costs.map(([label, amt, sub]) => `<div class="list-row"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><span class="amt">${amt}</span></div>`).join("")}
      <div class="list-row total"><span>Total</span><span class="amt">${total}</span></div>
    </div>
    <p class="fine">${p.costNote}</p>

    <div class="script-card">
      <div class="script-head"><span class="script-label">What to say when you call</span><button class="copy-btn" id="copy-script">Copy</button></div>
      <p class="script-text" id="script-text">${p.script}</p>
    </div>

    <h2 class="h2">Bring with you</h2>
    <div class="list-card bring">
      ${p.bring.map(b => `<div class="list-row">${icon("check", "check on")}${b}</div>`).join("")}
    </div>

    <button class="lock-row" data-go="rights">
      <span class="lock-icon">${icon("shield")}</span>
      <span class="lock-text"><strong>Lock in your price</strong><span>Get a written Good Faith Estimate</span></span>
      ${icon("chev")}
    </button>`;

  $("copy-script").addEventListener("click", () => {
    const text = $("script-text").textContent.replace(/[“”]/g, "");
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("script-text"));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast("Selected. Copy it from here.");
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast("Copied"), fallback);
    else fallback();
  });
}
function syncPlaceSave() {
  const on = isSaved(placeId);
  $("place-save").setAttribute("aria-pressed", String(on));
  $("place-save").setAttribute("aria-label", on ? "Remove from saved" : "Save");
}
$("place-save").addEventListener("click", () => {
  const on = !isSaved(placeId);
  setSaved(placeId, on); syncPlaceSave();
  toast(on ? "Saved" : "Removed from saved");
});

/* ---------- Saved ---------- */
function renderSaved() {
  const list = PLACES.filter(p => isSaved(p.id)).sort((a, b) => a.rank - b.rank);
  $("saved-list").innerHTML = list.length ? list.map(rowHtml).join("") :
    `<div class="empty">Nothing saved yet. Tap the heart on a place to keep it here.
      <button class="btn btn-navy" data-go="discover">Find places</button></div>`;
}

/* ---------- Profile ---------- */
function renderSummary() {
  const rows = [
    ["Need", answers.need || "Not picked yet"],
    ["Household", answers.household],
    ["Income", INCOME_LABELS[answers.income] || "Not picked yet"],
    ["Location", answers.location ? "On" : "Off"],
  ];
  $("summary").innerHTML = rows
    .map(([k, v]) => `<div class="list-row"><span>${k}</span><span>${v}</span></div>`).join("");
}
$("clear-info").addEventListener("click", () => {
  answers = { ...DEFAULTS, saved: [] }; save(); syncAll(); builtFor = "";
  toast("Your info was cleared from this phone");
  go("splash");
});

function syncAll() {
  syncNeed(); syncHousehold(); syncIncome(); syncBadge();
  locationSwitch.checked = !!answers.location;
}
syncAll();
show(location.hash.slice(1) || "splash");
