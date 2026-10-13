"use strict";

const STORE_KEY = "menstrack.v1";
const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Fatigue", "Mood swings", "Back pain", "Tender breasts", "Nausea", "Acne"];
const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
const DAY_MS = 864e5;

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((a - b) / DAY_MS);
const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---- storage ----

function isEmpty(e) {
  return !e.period && !e.symptoms.length && !e.note;
}

function sanitize(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !v || typeof v !== "object") continue;
    const period = v.period === true;
    const entry = {
      period,
      flow: period && [1, 2, 3].includes(v.flow) ? v.flow : 0,
      symptoms: Array.isArray(v.symptoms) ? v.symptoms.filter((s) => SYMPTOMS.includes(s)) : [],
      note: typeof v.note === "string" ? v.note.slice(0, 500) : "",
    };
    if (!isEmpty(entry)) out[key] = entry;
  }
  return out;
}

function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
  } catch {
    return {};
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

let data = load();

// ---- predictions ----

function computeStats() {
  const days = Object.keys(data).filter((k) => data[k].period).sort();
  if (!days.length) return null;

  const starts = [];
  const lengths = [];
  let run = 0;
  for (const key of days) {
    if (data[fmt(addDays(parse(key), -1))]?.period) {
      run++;
    } else {
      if (run) lengths.push(run);
      starts.push(parse(key));
      run = 1;
    }
  }
  lengths.push(run);

  // The latest period may still be running, so its length isn't final yet.
  const ongoing = diffDays(startOfToday(), parse(days.at(-1))) <= 1;
  const finished = ongoing ? lengths.slice(0, -1) : lengths;

  const gaps = starts.slice(1).map((s, i) => diffDays(s, starts[i])).filter((g) => g >= 15 && g <= 60);
  const recentGaps = gaps.slice(-6);
  const recentLens = finished.slice(-6);

  return {
    lastStart: starts.at(-1),
    avgCycle: recentGaps.length ? Math.round(mean(recentGaps)) : DEFAULT_CYCLE,
    avgPeriod: recentLens.length ? Math.round(mean(recentLens)) : DEFAULT_PERIOD,
    hasCycleHistory: recentGaps.length > 0,
  };
}

function predictionMarks(stats) {
  const marks = new Map();
  if (!stats) return marks;
  const today = startOfToday();
  const set = (d, kind) => { if (d >= today) marks.set(fmt(d), kind); };

  for (let k = 1; k <= 4; k++) {
    const next = addDays(stats.lastStart, stats.avgCycle * k);
    const ovulation = addDays(next, -14);
    for (let i = -5; i <= 1; i++) set(addDays(ovulation, i), "fertile");
    set(ovulation, "ovulation");
    for (let i = 0; i < stats.avgPeriod; i++) set(addDays(next, i), "predicted");
  }
  return marks;
}

// ---- rendering ----

let view = (() => { const t = startOfToday(); return { year: t.getFullYear(), month: t.getMonth() }; })();

function renderSummary(stats) {
  const headline = $("headline");
  const subline = $("subline");
  const statsEl = $("stats");
  statsEl.replaceChildren();

  if (!stats) {
    headline.textContent = "Welcome";
    subline.textContent = "Mark your first period day to start getting predictions.";
    return;
  }

  const today = startOfToday();
  const cycleDay = diffDays(today, stats.lastStart) + 1;
  const next = addDays(stats.lastStart, stats.avgCycle);
  const until = diffDays(next, today);

  if (until > 1) headline.textContent = `Period in ${until} days`;
  else if (until === 1) headline.textContent = "Period tomorrow";
  else if (until === 0) headline.textContent = "Period expected today";
  else headline.textContent = `Period ${-until} day${until === -1 ? "" : "s"} late`;

  subline.textContent = `Cycle day ${cycleDay}` + (stats.hasCycleHistory ? "" : " (using a 28-day default)");

  for (const [label, value] of [["Cycle", `${stats.avgCycle} d`], ["Period", `${stats.avgPeriod} d`]]) {
    const span = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = value;
    span.append(`${label} `, strong);
    statsEl.append(span);
  }
}

function renderCalendar(marks) {
  const first = new Date(view.year, view.month, 1);
  $("month-title").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const grid = $("days");
  grid.replaceChildren();
  const offset = (first.getDay() + 6) % 7; // Monday first
  for (let i = 0; i < offset; i++) grid.append(document.createElement("span"));

  const count = new Date(view.year, view.month + 1, 0).getDate();
  const todayKey = fmt(startOfToday());
  for (let day = 1; day <= count; day++) {
    const key = fmt(new Date(view.year, view.month, day));
    const entry = data[key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.textContent = day;
    btn.dataset.date = key;

    if (entry?.period) btn.classList.add("period");
    else if (marks.has(key)) btn.classList.add(marks.get(key));
    if (entry?.symptoms.length || entry?.note) btn.classList.add("has-symptoms");
    if (key === todayKey) btn.classList.add("today");
    grid.append(btn);
  }
}

function render() {
  const stats = computeStats();
  renderSummary(stats);
  renderCalendar(predictionMarks(stats));
}

function renderWeekdays() {
  const el = $("weekdays");
  for (let i = 0; i < 7; i++) {
    const span = document.createElement("span");
    span.textContent = new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }); // 2024-01-01 is a Monday
    el.append(span);
  }
}

// ---- day editor ----

const sheet = $("sheet");
let editingKey = null;

function buildSymptomChips() {
  const box = $("symptoms");
  for (const name of SYMPTOMS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = name;
    const span = document.createElement("span");
    span.textContent = name;
    label.append(input, span);
    box.append(label);
  }
}

function syncFlowEnabled() {
  $("flow-set").disabled = !$("f-period").checked;
}

function openSheet(key) {
  editingKey = key;
  const entry = data[key] ?? { period: false, flow: 0, symptoms: [], note: "" };

  $("sheet-title").textContent = parse(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  $("f-period").checked = entry.period;
  document.querySelectorAll('input[name="flow"]').forEach((r) => { r.checked = Number(r.value) === entry.flow; });
  document.querySelectorAll("#symptoms input").forEach((c) => { c.checked = entry.symptoms.includes(c.value); });
  $("f-note").value = entry.note;
  syncFlowEnabled();
  sheet.showModal();
}

function commitSheet() {
  const period = $("f-period").checked;
  const flowInput = document.querySelector('input[name="flow"]:checked');
  const entry = {
    period,
    flow: period && flowInput ? Number(flowInput.value) : 0,
    symptoms: [...document.querySelectorAll("#symptoms input:checked")].map((c) => c.value),
    note: $("f-note").value.trim(),
  };
  if (isEmpty(entry)) delete data[editingKey];
  else data[editingKey] = entry;
  save();
  sheet.close();
  render();
}

// ---- backup ----

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 1, entries: data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `menstrack-${fmt(startOfToday())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = sanitize(parsed?.entries ?? parsed);
    const n = Object.keys(incoming).length;
    if (!n) { alert("No valid entries found in that file."); return; }
    if (!confirm(`Replace your current data with ${n} imported entries?`)) return;
    data = incoming;
    save();
    render();
  } catch {
    alert("Could not read that file.");
  }
}

// ---- wiring ----

function shiftMonth(delta) {
  const d = new Date(view.year, view.month + delta, 1);
  view = { year: d.getFullYear(), month: d.getMonth() };
  render();
}

$("prev").addEventListener("click", () => shiftMonth(-1));
$("next").addEventListener("click", () => shiftMonth(1));
$("month-title").addEventListener("click", () => {
  const t = startOfToday();
  view = { year: t.getFullYear(), month: t.getMonth() };
  render();
});
$("days").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-date]");
  if (btn) openSheet(btn.dataset.date);
});
$("log-today").addEventListener("click", () => openSheet(fmt(startOfToday())));

$("f-period").addEventListener("change", syncFlowEnabled);
$("sheet-form").addEventListener("submit", (e) => { e.preventDefault(); commitSheet(); });
$("sheet-cancel").addEventListener("click", () => sheet.close());
$("sheet-clear").addEventListener("click", () => {
  delete data[editingKey];
  save();
  sheet.close();
  render();
});

$("export").addEventListener("click", exportData);
$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) importData(file);
});

buildSymptomChips();
renderWeekdays();
render();

// Ask the browser not to evict our data.
navigator.storage?.persist?.();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
