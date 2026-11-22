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
  renderTreats();
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
  updateCafe();
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  startBtn.textContent = elapsed ? "resume" : "start";
  showTime();
}

// Save the current session to the calendar if it lasted at least a minute.
// Timer sessions also remember which café treat was made (the stopwatch has no café).
function logSession(finished = false) {
  if (sessionStart && elapsed >= 60) {
    const session = { start: sessionStart, minutes: Math.round(elapsed / 60) };
    if (mode === "timer") Object.assign(session, { item: cafeItem, made: finished ? 1 : 0 });
    sessions.push(session);
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
      logSession(true);
      updateCafe();
      alert(`time's up! your ${CAFE_MENU[cafeItem].name} is ready 🎉`);
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
    sessions.push({ start: sessionStart, minutes: Math.round(elapsed / 60), item: cafeItem, made: 0 });
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

// ===== Café: pick a treat and watch it being made while you study =====
// Each treat is a little SVG drawing. Parts of it react to progress (0 -> 1):
//   data-show="0.5"          appears once progress reaches 0.5
//   data-fill="a,b"          a liquid that rises from data-bottom to data-top between a and b
//   data-bake="a,b"          colour shifts from data-from to data-to between a and b
const OUTLINE = "#e3b5c6";
const CAFE_MENU = {
  latte: {
    name: "latte",
    steps: [[0, "warming the cup"], [0.04, "pulling the espresso"], [0.4, "steaming the milk"],
            [0.82, "pouring latte art"], [0.96, "almost ready"]],
    svg: id => `
      <ellipse cx="100" cy="130" rx="60" ry="9" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
      <defs><clipPath id="${id}c"><path d="M61 64 L139 64 L132 118 Q130 126 122 126 L78 126 Q70 126 68 118 Z"/></clipPath></defs>
      <path d="M139 78 C164 78 164 110 133 110" fill="none" stroke="${OUTLINE}" stroke-width="7" stroke-linecap="round"/>
      <path d="M58 62 L142 62 L134 120 Q132 128 124 128 L76 128 Q68 128 66 120 Z" fill="#fff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)">
        <rect x="55" width="90" fill="#8a5a44" data-fill="0.04,0.8" data-bottom="126" data-top="66"
              data-bake="0.4,0.8" data-from="#8a5a44" data-to="#d8b08c"/>
        <ellipse cx="100" cy="67" rx="40" ry="5" fill="#f7e9dc" data-show="0.82"/>
      </g>
      <path d="M100 72 l-7 -6 a4 4 0 0 1 7 -4 a4 4 0 0 1 7 4 z" fill="#f6c3d4" data-show="0.9"/>
      <g class="steam" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round" data-show="0.96">
        <path d="M84 52 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M100 50 q-6 -8 0 -16 q6 -8 0 -16"/><path d="M116 52 q-6 -8 0 -16 q6 -8 0 -16"/>
      </g>`,
  },

  cake: {
    name: "strawberry cake",
    steps: [[0, "getting a plate"], [0.12, "baking the sponge"], [0.3, "whipping the cream"],
            [0.42, "slicing strawberries"], [0.56, "stacking the layers"], [0.7, "frosting the cake"],
            [0.8, "piping cream"], [0.9, "adding strawberries"]],
    svg: () => `
      <ellipse cx="100" cy="128" rx="72" ry="10" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
      <rect x="45" y="100" width="110" height="24" rx="3" fill="#f6d8a8" stroke="#e8c08a" stroke-width="2" data-show="0.12"/>
      <rect x="45" y="92" width="110" height="9" fill="#fffdf9" stroke="#f0dfe6" stroke-width="1.5" data-show="0.3"/>
      <g fill="#f6a0b0" data-show="0.42">
        <ellipse cx="58" cy="96.5" rx="6" ry="3.5"/><ellipse cx="80" cy="96.5" rx="6" ry="3.5"/><ellipse cx="102" cy="96.5" rx="6" ry="3.5"/>
        <ellipse cx="124" cy="96.5" rx="6" ry="3.5"/><ellipse cx="144" cy="96.5" rx="6" ry="3.5"/>
      </g>
      <rect x="45" y="68" width="110" height="24" rx="3" fill="#f6d8a8" stroke="#e8c08a" stroke-width="2" data-show="0.56"/>
      <g fill="#fff6fa" stroke="#f0cfdc" stroke-width="2" data-show="0.7">
        <rect x="42" y="60" width="116" height="13" rx="6"/>
        <ellipse cx="60" cy="74" rx="4" ry="5" stroke="none"/><ellipse cx="88" cy="75" rx="4" ry="6" stroke="none"/>
        <ellipse cx="118" cy="74" rx="4" ry="5" stroke="none"/><ellipse cx="144" cy="75" rx="4" ry="6" stroke="none"/>
      </g>
      <g fill="#fff" stroke="#f0cfdc" stroke-width="2" data-show="0.8">
        <circle cx="66" cy="56" r="7"/><circle cx="100" cy="55" r="7"/><circle cx="134" cy="56" r="7"/>
      </g>
      <g data-show="0.9">
        ${[66, 100, 134].map(x => `<g transform="translate(${x} 44)">
          <path d="M0 -6 C7 -6 9 3 0 10 C-9 3 -7 -6 0 -6 Z" fill="#f4889a"/>
          <path d="M-5 -6 L0 -10 L5 -6 L0 -4 Z" fill="#a9d39a"/>
          <circle cx="-2" cy="0" r=".9" fill="#fff"/><circle cx="2" cy="3" r=".9" fill="#fff"/></g>`).join("")}
      </g>`,
  },

  matcha: {
    name: "iced matcha",
    steps: [[0, "chilling the glass"], [0.06, "pouring milk"], [0.18, "adding ice"],
            [0.5, "whisking matcha"], [0.92, "adding a straw"]],
    svg: id => `
      <defs><clipPath id="${id}c"><path d="M69 40 L131 40 L122.5 122 Q121.5 127 117 127 L83 127 Q78.5 127 77.5 122 Z"/></clipPath></defs>
      <rect x="112" y="12" width="9" height="100" rx="4" fill="#f6b8cf" transform="rotate(12 116 62)" data-show="0.92"/>
      <path d="M66 38 L134 38 L125 124 Q124 130 118 130 L82 130 Q76 130 75 124 Z" fill="#fff" fill-opacity=".75" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)">
        <rect x="60" width="80" fill="#fbf5ec" data-fill="0.06,0.5" data-bottom="127" data-top="70"/>
        <rect x="60" width="80" fill="#b5d39a" data-fill="0.5,0.85" data-bottom="70" data-top="46"/>
        <rect x="80" y="84" width="20" height="18" rx="4" fill="#fff" fill-opacity=".55" stroke="#e6f0f0" stroke-width="1.5" data-show="0.18"/>
        <rect x="102" y="96" width="18" height="17" rx="4" fill="#fff" fill-opacity=".55" stroke="#e6f0f0" stroke-width="1.5" data-show="0.26"/>
        <rect x="88" y="52" width="19" height="17" rx="4" fill="#fff" fill-opacity=".55" stroke="#e6f0f0" stroke-width="1.5" data-show="0.6"/>
      </g>
      <path d="M72 44 L76 116" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  },

  cookies: {
    name: "cookies",
    steps: [[0, "preheating the oven"], [0.1, "scooping dough"], [0.35, "baking"],
            [0.85, "adding chocolate chips"], [0.95, "cooling down"]],
    svg: () => {
      const cookie = (cx, cy, r, show) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f5e3c3" stroke="#e6c79f" stroke-width="2"
        data-show="${show}" data-bake="0.35,0.85" data-from="#f5e3c3" data-to="#dba46a"/>`;
      const chips = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#7a4f3a"/>`).join("");
      return `
      <ellipse cx="100" cy="128" rx="72" ry="10" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
      ${cookie(100, 88, 24, 0.1)}${cookie(68, 108, 22, 0.18)}${cookie(132, 108, 22, 0.26)}
      <g data-show="0.85">${chips([[92, 80], [108, 86], [97, 97], [112, 74], [60, 102], [74, 112], [64, 116], [126, 102], [140, 110], [132, 117]])}</g>
      <g class="steam" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round" data-show="0.95">
        <path d="M86 58 q-5 -7 0 -14 q5 -7 0 -14"/><path d="M114 58 q-5 -7 0 -14 q5 -7 0 -14"/>
      </g>`;
    },
  },

  boba: {
    name: "strawberry boba",
    steps: [[0, "cooking the pearls"], [0.2, "shaking strawberry milk"], [0.86, "sealing the lid"], [0.93, "adding a straw"]],
    svg: id => `
      <defs><clipPath id="${id}c"><path d="M69 50 L131 50 L123.5 122 Q122.5 127 118 127 L82 127 Q77.5 127 76.5 122 Z"/></clipPath></defs>
      <path d="M66 48 L134 48 L126 124 Q125 130 119 130 L81 130 Q75 130 74 124 Z" fill="#fff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
      <g clip-path="url(#${id}c)">
        <rect x="60" width="80" fill="#f8c9d6" data-fill="0.2,0.8" data-bottom="127" data-top="54"/>
        <g fill="#6b4436" data-show="0.06">
          <circle cx="84" cy="121" r="5"/><circle cx="95" cy="123" r="5"/><circle cx="106" cy="121" r="5"/><circle cx="117" cy="122" r="5"/>
          <circle cx="89" cy="112" r="5"/><circle cx="101" cy="113" r="5"/><circle cx="112" cy="112" r="5"/>
        </g>
      </g>
      <g data-show="0.86">
        <path d="M62 47 Q100 14 138 47 Z" fill="#fff" fill-opacity=".85" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
        <rect x="60" y="43" width="80" height="8" rx="3" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
      </g>
      <rect x="104" y="0" width="10" height="64" rx="4" fill="#f4a6c0" transform="rotate(10 109 32)" data-show="0.93"/>`,
  },
};

const cafeDish = document.getElementById("cafe-dish");
const cafeStatus = document.getElementById("cafe-status");
const cafeMenuEl = document.getElementById("cafe-menu");
const cafeTreats = document.getElementById("cafe-treats");
let cafeItem = CAFE_MENU[localStorage.getItem("cafeItem")] ? localStorage.getItem("cafeItem") : "latte";
let cafeUid = 0;

function dishMarkup(key) {
  const id = `dish${++cafeUid}`;       // unique ids so several drawings can share a page
  return `<svg viewBox="0 0 200 150" aria-hidden="true">${CAFE_MENU[key].svg(id)}</svg>`;
}

const clamp01 = n => Math.min(1, Math.max(0, n));
function mixColor(a, b, t) {
  const pa = a.match(/\w\w/g).map(h => parseInt(h, 16)), pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Draw a treat at a given progress (0 = just started, 1 = ready)
function paintDish(svg, p) {
  svg.querySelectorAll("[data-show]").forEach(el => el.classList.toggle("hidden-part", p < Number(el.dataset.show)));
  svg.querySelectorAll("[data-fill]").forEach(el => {
    const [a, b] = el.dataset.fill.split(",").map(Number);
    const bottom = Number(el.dataset.bottom), top = Number(el.dataset.top);
    const level = clamp01((p - a) / (b - a)) * (bottom - top);
    el.setAttribute("y", bottom - level);
    el.setAttribute("height", level);
  });
  svg.querySelectorAll("[data-bake]").forEach(el => {
    const [a, b] = el.dataset.bake.split(",").map(Number);
    el.setAttribute("fill", mixColor(el.dataset.from, el.dataset.to, clamp01((p - a) / (b - a))));
  });
}

// How far along the current treat is
function cafeProgress() {
  return duration ? 1 - remaining / duration : 0;
}

function updateCafe() {
  if (mode !== "timer") return;   // the café is only part of the timer
  const item = CAFE_MENU[cafeItem];
  const svg = cafeDish.querySelector("svg");
  const p = cafeProgress();
  paintDish(svg, p);
  const idle = !timerId && elapsed === 0 && remaining === duration;
  if (idle) {
    cafeStatus.textContent = `one ${item.name}, coming up - press start ♡`;
  } else if (remaining === 0) {
    cafeStatus.textContent = `your ${item.name} is ready! enjoy ♡`;
  } else {
    const step = item.steps.filter(([t]) => p >= t).pop()[1];
    cafeStatus.textContent = `${step}... ${Math.floor(p * 100)}%${timerId ? "" : " (paused)"}`;
  }
}

function pickTreat(key) {
  cafeItem = key;
  localStorage.setItem("cafeItem", key);
  cafeDish.innerHTML = dishMarkup(key);
  cafeMenuEl.querySelectorAll("button").forEach(b => {
    const on = b.dataset.item === key;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  });
  updateCafe();
}

// Menu buttons: a finished version of each treat as a little picture
Object.entries(CAFE_MENU).forEach(([key, item]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.item = key;
  b.title = item.name;
  b.setAttribute("role", "radio");
  b.setAttribute("aria-label", item.name);
  b.innerHTML = dishMarkup(key);
  paintDish(b.querySelector("svg"), 1);
  b.addEventListener("click", () => pickTreat(key));
  cafeMenuEl.appendChild(b);
});

// "today's treats": finished treats saved on study sessions as { item, made }
function renderTreats() {
  const today = dateKey(new Date());
  const counts = {};
  sessions.filter(s => s.item && s.made && dateKey(new Date(s.start)) === today)
    .forEach(s => counts[s.item] = (counts[s.item] || 0) + s.made);
  cafeTreats.innerHTML = "";
  const keys = Object.keys(counts).filter(k => CAFE_MENU[k]);
  if (!keys.length) { cafeTreats.textContent = "no treats made yet today"; return; }
  cafeTreats.append("today's treats: ");
  keys.forEach(k => {
    const chip = document.createElement("span");
    chip.className = "treat-chip";
    chip.title = CAFE_MENU[k].name;
    chip.innerHTML = dishMarkup(k);
    paintDish(chip.querySelector("svg"), 1);
    chip.append(`×${counts[k]}`);
    cafeTreats.appendChild(chip);
  });
}

pickTreat(cafeItem);
renderTreats();

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
