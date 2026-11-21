// ===== Window manager =====
const desktop = document.getElementById("desktop");
const dock = document.getElementById("dock");
const menuApp = document.getElementById("mb-app");
const windows = [...document.querySelectorAll(".window")];
let zTop = 10;

function dockItem(win) {
  return dock.querySelector(`[data-win="${win.id}"]`);
}

// Menu bar shows the name of the app in front (blank when none)
function updateMenuApp() {
  const active = windows.find(w => w.classList.contains("active"));
  menuApp.textContent = active ? active.dataset.title : "";
}

function focusWin(win) {
  windows.forEach(w => w.classList.remove("active"));
  win.classList.add("active");
  win.style.zIndex = ++zTop;
  updateMenuApp();
}

function topVisibleWin() {
  return windows
    .filter(w => !["closed", "minimized", "closing"].some(c => w.classList.contains(c)))
    .sort((a, b) => (b.style.zIndex || 0) - (a.style.zIndex || 0))[0];
}

function focusNext() {
  const next = topVisibleWin();
  if (next) focusWin(next);
  else updateMenuApp();
}

// The app's icon (emoji or image) from the app list, copied for reuse
function appIcon(win) {
  const glyph = document.querySelector(`#apps .app[data-open="${win.id}"] .glyph`);
  const wrap = document.createElement("span");
  wrap.className = "app-icon";
  if (glyph) glyph.childNodes.forEach(n => wrap.appendChild(n.cloneNode(true)));
  else wrap.textContent = win.dataset.icon || "";
  return wrap;
}

// Run a CSS animation class on a window, then call done() when it finishes
function animate(win, cls, done) {
  win.classList.add(cls);
  const finish = () => { win.classList.remove(cls); clearTimeout(fallback); done?.(); };
  // no animation (e.g. "reduce motion" is on) -> finish straight away
  if (getComputedStyle(win).animationName === "none") return finish();
  win.addEventListener("animationend", finish, { once: true });
  const fallback = setTimeout(finish, 2000);
}

function openWin(win) {
  const wasClosed = win.classList.contains("closed");
  win.closeToken = null;   // cancels a close that's still animating
  win.classList.remove("closed", "minimized", "closing");
  if (wasClosed) {
    win.dispatchEvent(new Event("winopen"));
    animate(win, "opening");
  }
  dockItem(win)?.classList.add("running");
  focusWin(win);
}

function closeWin(win) {
  if (win.classList.contains("closing")) return;
  const token = win.closeToken = {};
  win.classList.remove("active");
  dockItem(win)?.classList.remove("running");
  animate(win, "closing", () => {
    if (win.closeToken === token) {   // not reopened while it was closing
      win.classList.add("closed");
      win.classList.remove("minimized", "maximized");
      win.dispatchEvent(new Event("winclose"));
    }
  });
  focusNext();
}

function minimizeWin(win) {
  win.classList.add("minimized");
  win.classList.remove("active");
  focusNext();
}

function restoreWin(win) {
  win.classList.remove("minimized");
  focusWin(win);
}

function toggleMaximize(win) {
  win.classList.toggle("maximized");
  focusWin(win);
}

// Open, un-minimize, or bring to front - whatever the app needs
function showApp(win) {
  if (win.classList.contains("closed")) openWin(win);
  else if (win.classList.contains("minimized")) restoreWin(win);
  else focusWin(win);
}

windows.forEach(win => {
  const bar = win.querySelector(".titlebar");

  // Title bar: the app's icon + its name
  const title = win.querySelector(".title");
  title.textContent = "";
  title.append(appIcon(win), document.createTextNode(win.dataset.title));

  win.addEventListener("pointerdown", () => focusWin(win));
  win.querySelector(".btn-close").addEventListener("click", () => closeWin(win));
  win.querySelector(".btn-min").addEventListener("click", () => minimizeWin(win));
  win.querySelector(".btn-max").addEventListener("click", () => toggleMaximize(win));
  bar.addEventListener("dblclick", e => {
    if (!e.target.closest(".controls")) toggleMaximize(win);
  });

  // Dragging by the title bar
  bar.addEventListener("pointerdown", e => {
    if (e.target.closest(".controls") || win.classList.contains("maximized")) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startLeft = win.offsetLeft, startTop = win.offsetTop;
    win.classList.add("dragging");
    bar.setPointerCapture(e.pointerId);

    const onMove = ev => {
      const maxLeft = desktop.clientWidth - 60;          // keep a bit grabbable
      const maxTop = desktop.clientHeight - bar.offsetHeight;
      let left = startLeft + ev.clientX - startX;
      let top = startTop + ev.clientY - startY;
      left = Math.min(Math.max(left, 60 - win.offsetWidth), maxLeft);
      top = Math.min(Math.max(top, 0), maxTop);
      win.style.left = left + "px";
      win.style.top = top + "px";
    };
    const onUp = () => {
      win.classList.remove("dragging");
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
      bar.removeEventListener("pointercancel", onUp);
    };
    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp);
    bar.addEventListener("pointercancel", onUp);
  });
});

// Dock: one item per app (same order and icons as the app list)
document.querySelectorAll("#apps .app").forEach(icon => {
  const win = document.getElementById(icon.dataset.open);
  const item = document.createElement("button");
  item.className = "dock-item";
  item.dataset.win = win.id;
  item.setAttribute("aria-label", win.dataset.title);
  const tile = document.createElement("span");
  tile.className = "dock-tile";
  tile.appendChild(appIcon(win));
  const label = document.createElement("span");
  label.className = "dock-label";
  label.textContent = win.dataset.title;
  item.append(tile, label);
  item.addEventListener("click", () => showApp(win));
  dock.appendChild(item);
});

// Windows not marked closed start open
windows.forEach(win => { if (!win.classList.contains("closed")) openWin(win); });
updateMenuApp();

// ===== Menu bar clock (like "sat nov 21  5:41 pm") =====
const clock = document.getElementById("clock");
function tick() {
  const now = new Date();
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).replace(/,/g, "");
  clock.textContent = `${date}  ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`.toLowerCase();
}
tick();
setInterval(tick, 10_000);

// ===== Notes (saved in localStorage) =====
const notes = document.getElementById("notes-text");
notes.value = localStorage.getItem("notes") || "";
notes.addEventListener("input", () => localStorage.setItem("notes", notes.value));

// ===== Shared date helpers =====
const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = d => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
const fmtDay = (d, opts) => d.toLocaleDateString([], opts).toLowerCase();

// Due is stored as "yyyy-mm-dd" or "yyyy-mm-ddThh:mm" (local time)
function parseDue(due) {
  const [day, time] = due.split("T");
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time ? time.split(":").map(Number) : [23, 59];   // date only = end of that day
  return new Date(y, m - 1, d, h, min);
}
const hasTime = due => due.includes("T");

// 95 -> "1h 35m", 25 -> "25m"
function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function fmtDue(due) {
  const d = parseDue(due);
  const day = fmtDay(d, { weekday: "short", month: "short", day: "numeric" });
  return hasTime(due) ? `${day} · ${fmtTime(d)}` : day;
}

// Whenever tasks or study sessions change, refresh everything that shows them
function dataChanged() {
  renderTodos();
  renderStudyToday();
  renderStats();
  renderCalendar();
}

// ===== To-Do (saved in localStorage) =====
const todoWin = document.getElementById("todo");
const todoList = document.getElementById("todo-list");
const todoInput = document.getElementById("todo-input");
const todoDate = document.getElementById("todo-date");
const todoTime = document.getElementById("todo-time");
let todos = JSON.parse(localStorage.getItem("todos") || "[]");

function saveTodos() {
  localStorage.setItem("todos", JSON.stringify(todos));
  dataChanged();
}

function renderTodos() {
  todoList.innerHTML = "";
  // tasks with a due date first (soonest first), then tasks without one
  const sorted = [...todos].sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return parseDue(a.due) - parseDue(b.due);
  });
  const now = new Date();
  sorted.forEach(t => {
    const li = document.createElement("li");
    li.classList.toggle("done", t.done);
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.addEventListener("change", () => { t.done = box.checked; saveTodos(); });

    const body = document.createElement("div");
    body.className = "todo-body";
    const text = document.createElement("span");
    text.textContent = t.text;
    body.appendChild(text);
    if (t.due) {
      const due = document.createElement("small");
      due.className = "due";
      const overdue = !t.done && parseDue(t.due) < now;
      due.classList.toggle("overdue", overdue);
      due.textContent = (overdue ? "overdue · " : "due ") + fmtDue(t.due);
      const rm = document.createElement("button");
      rm.className = "due-remove";
      rm.textContent = "×";
      rm.title = "remove due date";
      rm.setAttribute("aria-label", "remove due date");
      rm.addEventListener("click", () => { t.due = null; saveTodos(); });
      due.appendChild(rm);
      body.appendChild(due);
    }

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "delete";
    del.addEventListener("click", () => { todos.splice(todos.indexOf(t), 1); saveTodos(); });
    li.append(box, body, del);
    todoList.appendChild(li);
  });
}

document.getElementById("todo-form").addEventListener("submit", e => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;
  let due = null;
  if (todoDate.value) due = todoTime.value ? `${todoDate.value}T${todoTime.value}` : todoDate.value;
  todos.push({ text, done: false, due });
  todoInput.value = todoDate.value = todoTime.value = "";
  saveTodos();
});

document.getElementById("todo-due-clear").addEventListener("click", () => {
  todoDate.value = todoTime.value = "";
});

// Open the to-do window with a due date already filled in (used by the calendar)
function addTaskOn(day) {
  todoWin.classList.contains("minimized") ? restoreWin(todoWin) : openWin(todoWin);
  todoDate.value = day;
  todoInput.focus();
}

// ===== Focus timer / stopwatch + study sessions =====
const display = document.getElementById("timer-display");
const startBtn = document.getElementById("timer-start");
const resetBtn = document.getElementById("timer-reset");
const timerWin = document.getElementById("timer");
const studyToday = document.getElementById("timer-today");
let mode = "timer";                     // "timer" counts down, "stopwatch" counts up
let duration = 25 * 60, remaining = duration, timerId = null;
let sessionStart = null, elapsed = 0;   // current session (survives pauses)
let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");   // [{ start, minutes }]

const saveSessions = () => localStorage.setItem("sessions", JSON.stringify(sessions));

function clockText(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function showTime() {
  const text = mode === "timer"
    ? `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`
    : clockText(elapsed);
  display.textContent = text;
  document.title = timerId ? `${text} · study desktop` : "study desktop";
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  startBtn.textContent = elapsed ? "resume" : "start";
  showTime();
}

// Save the current session to the calendar if it lasted at least a minute
function logSession() {
  if (sessionStart && elapsed >= 60) {
    sessions.push({ start: sessionStart, minutes: Math.round(elapsed / 60) });
    saveSessions();
  }
  sessionStart = null;
  elapsed = 0;
  startBtn.textContent = "start";
  dataChanged();
}

function renderStudyToday() {
  const today = dateKey(new Date());
  const mins = sessions
    .filter(s => dateKey(new Date(s.start)) === today)
    .reduce((sum, s) => sum + s.minutes, 0);
  studyToday.textContent = `studied today: ${fmtMins(mins)} ♡`;
}

startBtn.addEventListener("click", () => {
  if (timerId) return stopTimer();   // pause
  if (mode === "timer" && remaining === 0) remaining = duration;
  if (!sessionStart) sessionStart = new Date().toISOString();
  startBtn.textContent = "pause";
  timerId = setInterval(() => {
    elapsed++;
    if (mode === "timer") remaining--;
    showTime();
    if (mode === "timer" && remaining <= 0) {
      stopTimer();
      logSession();
      alert("time's up! 🎉");
    }
  }, 1000);
  showTime();
});

// Timer: reset (saves time studied so far). Stopwatch: stop & save.
resetBtn.addEventListener("click", () => {
  stopTimer();
  logSession();
  remaining = duration;
  showTime();
});

function setDuration(mins) {
  stopTimer();
  logSession();
  duration = remaining = mins * 60;
  showTime();
}

document.querySelectorAll(".preset").forEach(btn =>
  btn.addEventListener("click", () => setDuration(Number(btn.dataset.min))));

document.getElementById("timer-custom").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("timer-custom-min");
  const mins = Math.round(Number(input.value));
  if (mins >= 1 && mins <= 600) { setDuration(mins); input.value = ""; }
});

// Switch between timer and stopwatch (saves anything in progress first)
document.querySelectorAll(".mode-tabs button").forEach(tab =>
  tab.addEventListener("click", () => {
    if (tab.dataset.mode === mode) return;
    stopTimer();
    logSession();
    mode = tab.dataset.mode;
    remaining = duration;
    timerWin.dataset.mode = mode;
    document.querySelectorAll(".mode-tabs button").forEach(t => t.classList.toggle("on", t === tab));
    resetBtn.textContent = mode === "timer" ? "reset" : "stop & save";
    showTime();
  }));
timerWin.dataset.mode = mode;

// Don't lose a session in progress if the page is closed
window.addEventListener("pagehide", () => {
  if (sessionStart && elapsed >= 60) {
    sessions.push({ start: sessionStart, minutes: Math.round(elapsed / 60) });
    saveSessions();
    // if the page comes back (e.g. browser back button), carry on as a new session
    sessionStart = new Date().toISOString();
    elapsed = 0;
  }
});

function deleteSession(s) {
  const st = new Date(s.start);
  const when = `${fmtDay(st, { month: "short", day: "numeric" })} at ${fmtTime(st)}`;
  if (!confirm(`delete the ${s.minutes} min study session on ${when}?`)) return;
  sessions.splice(sessions.indexOf(s), 1);
  saveSessions();
  dataChanged();
}

// ===== Study stats =====
const stList = document.getElementById("st-list");
const stChart = document.getElementById("st-chart");

function renderStats() {
  const now = new Date();
  const todayKey = dateKey(now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const perDay = {};
  let week = 0, month = 0, total = 0;
  sessions.forEach(s => {
    const d = new Date(s.start);
    const k = dateKey(d);
    perDay[k] = (perDay[k] || 0) + s.minutes;
    total += s.minutes;
    if (d >= weekStart) week += s.minutes;
    if (d >= monthStart) month += s.minutes;
  });

  // streak: consecutive days with study, ending today (or yesterday if nothing yet today)
  let streak = 0;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!perDay[todayKey]) day.setDate(day.getDate() - 1);
  while (perDay[dateKey(day)]) { streak++; day.setDate(day.getDate() - 1); }

  const best = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];

  const set = (id, v) => document.getElementById(id).textContent = v;
  set("st-today", fmtMins(perDay[todayKey] || 0));
  set("st-week", fmtMins(week));
  set("st-month", fmtMins(month));
  set("st-total", fmtMins(total));
  set("st-count", sessions.length);
  set("st-avg", fmtMins(sessions.length ? Math.round(total / sessions.length) : 0));
  set("st-streak", streak);
  set("st-best", best ? fmtMins(best[1]) : "-");
  document.getElementById("st-best").parentElement.title =
    best ? fmtDay(new Date(best[0] + "T00:00"), { weekday: "short", month: "short", day: "numeric" }) : "";

  // last 7 days bar chart (one series: minutes per day)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ d, mins: perDay[dateKey(d)] || 0 });
  }
  const max = Math.max(...days.map(x => x.mins));
  stChart.innerHTML = "";
  stChart.setAttribute("aria-label", "minutes studied, last 7 days: " +
    days.map(x => `${fmtDay(x.d, { weekday: "short" })} ${x.mins} min`).join(", "));
  days.forEach(x => {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.dataset.tip = `${fmtDay(x.d, { weekday: "short", month: "short", day: "numeric" })}: ${fmtMins(x.mins)}`;
    const track = document.createElement("div");
    track.className = "bar-track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = max ? `${(x.mins / max) * 100}%` : "0%";
    if (x.mins && x.mins === max) {          // label only the best day
      const v = document.createElement("span");
      v.className = "bar-value";
      v.textContent = fmtMins(x.mins);
      bar.appendChild(v);
    }
    track.appendChild(bar);
    const label = document.createElement("span");
    label.className = "bar-label";
    label.classList.toggle("today", dateKey(x.d) === todayKey);
    label.textContent = dateKey(x.d) === todayKey ? "today" : fmtDay(x.d, { weekday: "short" });
    col.append(track, label);
    stChart.appendChild(col);
  });

  // every session, newest first, each deletable
  stList.innerHTML = "";
  const sorted = [...sessions].sort((a, b) => new Date(b.start) - new Date(a.start));
  if (!sorted.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "no study sessions yet ♡";
    stList.appendChild(li);
  }
  sorted.forEach(s => {
    const st = new Date(s.start);
    const li = document.createElement("li");
    const when = document.createElement("span");
    when.textContent = `${fmtDay(st, { weekday: "short", month: "short", day: "numeric" })} · ${fmtTime(st)}`;
    const len = document.createElement("span");
    len.className = "len";
    len.textContent = fmtMins(s.minutes);
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "delete session";
    del.setAttribute("aria-label", "delete session");
    del.addEventListener("click", () => deleteSession(s));
    li.append(when, len, del);
    stList.appendChild(li);
  });
}

// Add a study session by hand
const stDate = document.getElementById("st-date");
const stTime = document.getElementById("st-time");
const stMin = document.getElementById("st-min");
const stMsg = document.getElementById("st-msg");
stDate.value = dateKey(new Date());
document.getElementById("st-form").addEventListener("submit", e => {
  e.preventDefault();
  const [y, m, d] = stDate.value.split("-").map(Number);
  const [h, min] = stTime.value.split(":").map(Number);
  const mins = Math.round(Number(stMin.value));
  if (!y || isNaN(h) || !(mins >= 1)) return;
  const start = new Date(y, m - 1, d, h, min);
  sessions.push({ start: start.toISOString(), minutes: mins });
  saveSessions();
  stTime.value = stMin.value = "";
  stMsg.textContent = `added ${fmtMins(mins)} on ${fmtDay(start, { month: "short", day: "numeric" })} ♡`;
  dataChanged();
});

// ===== Calendar (shows tasks + study sessions) =====
const calWin = document.getElementById("calendar");
const calGrid = document.getElementById("cal-grid");
const calLabel = document.getElementById("cal-label");
const cal = { view: "month", cursor: new Date(), show: { tasks: true, sessions: true } };
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function itemsByDay() {
  const map = {};
  const get = k => (map[k] ??= { tasks: [], sessions: [] });
  if (cal.show.tasks) todos.filter(t => t.due).forEach(t => get(t.due.split("T")[0]).tasks.push(t));
  if (cal.show.sessions) sessions.forEach(s => get(dateKey(new Date(s.start))).sessions.push(s));
  Object.values(map).forEach(v => {
    v.tasks.sort((a, b) => parseDue(a.due) - parseDue(b.due));
    v.sessions.sort((a, b) => new Date(a.start) - new Date(b.start));
  });
  return map;
}

function taskChip(t, withCheckbox) {
  const chip = document.createElement("div");
  chip.className = "chip task";
  chip.classList.toggle("done", t.done);
  chip.classList.toggle("overdue", !t.done && parseDue(t.due) < new Date());
  chip.title = `${t.text} — due ${fmtDue(t.due)}`;
  if (withCheckbox) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.addEventListener("click", e => e.stopPropagation());
    box.addEventListener("change", () => { t.done = box.checked; saveTodos(); });
    chip.appendChild(box);
  }
  const label = document.createElement("span");
  label.className = "user-text";
  label.textContent = (hasTime(t.due) ? fmtTime(parseDue(t.due)) + " " : "") + t.text;
  chip.appendChild(label);
  return chip;
}

function studyChip(text, title) {
  const chip = document.createElement("div");
  chip.className = "chip study";
  const label = document.createElement("span");
  label.textContent = text;
  chip.appendChild(label);
  chip.title = title;
  return chip;
}

function renderCalendar() {
  const byDay = itemsByDay();
  const todayKey = dateKey(new Date());
  const c = cal.cursor;
  let start, count;

  if (cal.view === "month") {
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const daysInMonth = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
    start = new Date(c.getFullYear(), c.getMonth(), 1 - first.getDay());
    count = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
    calLabel.textContent = fmtDay(c, { month: "long", year: "numeric" });
  } else {
    start = new Date(c.getFullYear(), c.getMonth(), c.getDate() - c.getDay());
    count = 7;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    calLabel.textContent = `${fmtDay(start, { month: "short", day: "numeric" })} - ${fmtDay(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }

  document.querySelectorAll(".cal-views button").forEach(b =>
    b.classList.toggle("on", b.dataset.view === cal.view));

  calGrid.className = cal.view;
  calGrid.innerHTML = "";
  DOW.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-dow";
    h.textContent = d;
    calGrid.appendChild(h);
  });

  for (let i = 0; i < count; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dateKey(day);
    const items = byDay[key] || { tasks: [], sessions: [] };
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.classList.toggle("today", key === todayKey);
    cell.classList.toggle("other-month", cal.view === "month" && day.getMonth() !== c.getMonth());

    const num = document.createElement("div");
    num.className = "cal-num";
    num.textContent = day.getDate();
    cell.appendChild(num);

    const studyMins = items.sessions.reduce((s, x) => s + x.minutes, 0);

    if (cal.view === "month") {
      // compact: up to 2 tasks, then "+n more", plus a study total
      items.tasks.slice(0, 2).forEach(t => cell.appendChild(taskChip(t, false)));
      if (items.tasks.length > 2) {
        const more = document.createElement("div");
        more.className = "more";
        more.textContent = `+${items.tasks.length - 2} more`;
        cell.appendChild(more);
      }
      if (studyMins) cell.appendChild(studyChip(`${fmtMins(studyMins)}`, `${items.sessions.length} study session(s)`));
      cell.title = "open this week";
      cell.addEventListener("click", () => { cal.view = "week"; cal.cursor = day; renderCalendar(); });
    } else {
      // detailed: every task (with checkbox) and every session with its time
      items.tasks.forEach(t => cell.appendChild(taskChip(t, true)));
      items.sessions.forEach(s => {
        const st = new Date(s.start);
        const en = new Date(st.getTime() + s.minutes * 60000);
        const chip = studyChip(`${fmtTime(st)} · ${fmtMins(s.minutes)}`, `study session ${fmtTime(st)} - ${fmtTime(en)}`);
        const del = document.createElement("button");
        del.className = "chip-del";
        del.textContent = "×";
        del.title = "delete session";
        del.setAttribute("aria-label", "delete session");
        del.addEventListener("click", e => { e.stopPropagation(); deleteSession(s); });
        chip.appendChild(del);
        cell.appendChild(chip);
      });
      if (studyMins) {
        const total = document.createElement("div");
        total.className = "more";
        total.textContent = `total: ${fmtMins(studyMins)}`;
        cell.appendChild(total);
      }
      const add = document.createElement("button");
      add.className = "cal-add";
      add.textContent = "+ task";
      add.title = "add a task due this day";
      add.addEventListener("click", () => addTaskOn(key));
      cell.appendChild(add);
    }
    calGrid.appendChild(cell);
  }
}

function moveCal(step) {
  const c = cal.cursor;
  cal.cursor = cal.view === "month"
    ? new Date(c.getFullYear(), c.getMonth() + step, 1)
    : new Date(c.getFullYear(), c.getMonth(), c.getDate() + step * 7);
  renderCalendar();
}
document.getElementById("cal-prev").addEventListener("click", () => moveCal(-1));
document.getElementById("cal-next").addEventListener("click", () => moveCal(1));
document.getElementById("cal-today").addEventListener("click", () => { cal.cursor = new Date(); renderCalendar(); });
document.querySelectorAll(".cal-views button").forEach(b =>
  b.addEventListener("click", () => { cal.view = b.dataset.view; renderCalendar(); }));
calWin.addEventListener("winopen", renderCalendar);

// Legend buttons: show / hide tasks or study sessions
document.querySelectorAll(".cal-legend [data-filter]").forEach(b =>
  b.addEventListener("click", () => {
    const key = b.dataset.filter;
    cal.show[key] = !cal.show[key];
    b.classList.toggle("on", cal.show[key]);
    b.setAttribute("aria-pressed", cal.show[key]);
    renderCalendar();
  }));

// Initial draw, then refresh every minute so "today" and "overdue" stay current
dataChanged();
setInterval(dataChanged, 60_000);
