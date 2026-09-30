/* Status state (single source, persisted) + derived metrics */
(function (P) {
  "use strict";
  var NW = P.NW;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKG = P.PKG;
  var PKGS = P.PKGS;
  var STATUS = P.STATUS;
  var TASK = P.TASK;
  var TASKS = P.TASKS;
  var TOTAL_TW = P.TOTAL_TW;
  function openWp() { return P.openWp.apply(null, arguments); }

  /* ---------- state (single source, persisted) --------------------------- */
  var KEY = "pd-dashboard.team1.v1";
  var state = { status: {}, unlocked: {}, moved: {}, filters: { q: "", status: "all", wp: "all", owner: "all", week: "all" } };
  (function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.status) Object.keys(raw.status).forEach(function (id) {
        if (TASK[id] && STATUS[raw.status[id]] && raw.status[id] !== "todo") state.status[id] = raw.status[id];
      });
      if (raw && raw.unlocked) Object.keys(raw.unlocked).forEach(function (id) {
        if (TASK[id] && raw.unlocked[id] === true) state.unlocked[id] = true;
      });
      if (raw && raw.moved) Object.keys(raw.moved).forEach(function (id) {
        if (TASK[id] && Number.isInteger(raw.moved[id]) && raw.moved[id] !== 0) state.moved[id] = raw.moved[id];
      });
      if (raw && raw.filters) Object.keys(state.filters).forEach(function (k) {
        if (typeof raw.filters[k] === "string") state.filters[k] = raw.filters[k];
      });
    } catch (e) { /* storage unavailable — start neutral */ }
  })();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function S(id) { return state.status[id] || "todo"; }
  // A task's delivery week is locked unless the user has opened it.
  function isLocked(id) { return !state.unlocked[id]; }

  var subscribers = [];
  function onChange(fn) { subscribers.push(fn); }
  function emit(changedId) {
    var d = derive();
    subscribers.forEach(function (fn) { fn(d, changedId); });
  }
  function setStatus(id, s) {
    if (!TASK[id] || !STATUS[s] || S(id) === s) return;
    if (s === "todo") delete state.status[id]; else state.status[id] = s;
    save();
    emit(id);
  }
  function setLock(id, on) {
    if (!TASK[id] || isLocked(id) === on) return;
    if (on) delete state.unlocked[id]; else state.unlocked[id] = true;
    save();
    emit(id);
  }
  function toggleLock(id) { setLock(id, !isLocked(id)); }

  /* ---------- schedule: an unlocked task can be moved ---------------------
     A task keeps its length and its gaps. It moves in whole working weeks,
     so the midterm week is skipped, and it must stay inside the 15 weeks.
     state.moved[id] is the shift in working weeks from the workbook plan;
     the task's weeks, delivery week and label, and its package's final
     week and bar, are recomputed from it.                                   */
  var WEEKS = P.WEEKS, segs = P.segs;
  var WORK = WEEKS.filter(function (w) { return w.kind !== "midterm"; }).map(function (w) { return w.week; });
  var scheduleSubs = [];
  function onSchedule(fn) { scheduleSubs.push(fn); }
  function labelFor(sg) {
    return sg.map(function (s) { return s[0] === s[1] ? "Week " + s[0] : "Weeks " + s[0] + "–" + s[1]; }).join(", ");
  }
  TASKS.forEach(function (t) {
    t.base = { weeks: t.weeks.slice(), weeksLabel: t.weeksLabel, segments: t.segments.map(function (s) { return s.slice(); }) };
  });
  PKGS.forEach(function (p) { p.base = { headingBar: p.headingBar.slice() }; });
  function shiftOf(id) { return state.moved[id] || 0; }
  function shiftBounds(id) {
    var b = TASK[id].base.weeks;
    return [-WORK.indexOf(b[0]), WORK.length - 1 - WORK.indexOf(b[b.length - 1])];
  }
  function validShift(id, sh) { var r = shiftBounds(id); return sh >= r[0] && sh <= r[1]; }
  function placeTask(t) {
    var sh = shiftOf(t.id);
    t.weeks = t.base.weeks.map(function (w) { return WORK[WORK.indexOf(w) + sh]; });
    t.segments = segs(t.weeks);
    t.fixedWeek = t.weeks[t.weeks.length - 1];
    t.weeksLabel = sh ? labelFor(t.segments) : t.base.weeksLabel;
  }
  function placePackage(p) {
    var moved = p.tasks.some(function (t) { return shiftOf(t.id); });
    p.finalWeek = Math.max.apply(null, p.tasks.map(function (t) { return t.fixedWeek; }));
    if (moved) {
      var u = {}; p.tasks.forEach(function (t) { t.weeks.forEach(function (w) { u[w] = 1; }); });
      p.headingBar = Object.keys(u).map(Number).sort(function (a, b) { return a - b; });
    } else p.headingBar = p.base.headingBar.slice();
    p.span = [p.headingBar[0], p.headingBar[p.headingBar.length - 1]];
    p.barSegments = segs(p.headingBar);
  }
  function placeAll() { TASKS.forEach(placeTask); PKGS.forEach(placePackage); }
  Object.keys(state.moved).forEach(function (id) { if (!validShift(id, state.moved[id])) delete state.moved[id]; });
  placeAll();

  function moveTaskTo(id, sh) {
    if (!TASK[id] || isLocked(id)) return false;
    var r = shiftBounds(id);
    sh = Math.max(r[0], Math.min(r[1], sh));
    if (sh === shiftOf(id)) return false;
    if (sh === 0) delete state.moved[id]; else state.moved[id] = sh;
    placeTask(TASK[id]); placePackage(PKG[TASK[id].wp]);
    save();
    scheduleSubs.forEach(function (fn) { fn(id); });
    emit(id);
    return true;
  }
  function moveTask(id, d) { return moveTaskTo(id, shiftOf(id) + d); }
  function canMove(id, d) { return !isLocked(id) && validShift(id, shiftOf(id) + d); }
  function movedCount() { return Object.keys(state.moved).length; }
  function restorePlan() {
    if (!movedCount()) return;
    state.moved = {};
    placeAll();
    save();
    scheduleSubs.forEach(function (fn) { fn(null); });
    emit(null);
  }
  function resetAll() { state.status = {}; save(); emit(null); }

  /* ---------- derived metrics -------------------------------------------- */
  function derive() {
    var d = {
      count: { todo: 0, prog: 0, done: 0 },
      tw: { todo: 0, prog: 0, done: 0 },
      wp: {}, owner: {}, week: []
    };
    var weighted = 0;
    TASKS.forEach(function (t) {
      var s = S(t.id);
      d.count[s]++; d.tw[s] += t.duration; weighted += t.duration * STATUS[s].w;
    });
    d.weighted = weighted / TOTAL_TW;
    d.taskCompletion = d.count.done / TASKS.length;

    PKGS.forEach(function (p) {
      var x = { tasks: p.tasks.length, count: { todo: 0, prog: 0, done: 0 }, tw: { todo: 0, prog: 0, done: 0 }, w: 0 };
      p.tasks.forEach(function (t) { var s = S(t.id); x.count[s]++; x.tw[s] += t.duration; x.w += t.duration * STATUS[s].w; });
      x.pct = x.w / p.tw;
      x.complete = x.count.done === x.tasks;
      d.wp[p.id] = x;
    });
    OWNER_KEYS.forEach(function (o) {
      var ts = TASKS.filter(function (t) { return t.owner === o; });
      var x = { tasks: ts.length, tw: 0, done: 0, w: 0 };
      ts.forEach(function (t) { x.tw += t.duration; x.w += t.duration * STATUS[S(t.id)].w; if (S(t.id) === "done") x.done++; });
      x.pct = x.tw ? x.w / x.tw : 0;
      d.owner[o] = x;
    });
    for (var w = 1; w <= NW; w++) {
      var row = { total: 0, wp: {} };
      PKGS.forEach(function (p) {
        var c = { todo: 0, prog: 0, done: 0, n: 0 };
        p.tasks.forEach(function (t) { if (t.weeks.indexOf(w) >= 0) { c[S(t.id)]++; c.n++; } });
        row.wp[p.id] = c; row.total += c.n;
      });
      d.week.push(row);
    }
    var open = TASKS.filter(function (t) { return S(t.id) !== "done" && isLocked(t.id); });
    open.sort(function (a, b) { return a.fixedWeek - b.fixedWeek || a.order - b.order; });
    d.nextFixed = open[0] || null;
    d.nextFixedSame = open.filter(function (t) { return d.nextFixed && t.fixedWeek === d.nextFixed.fixedWeek; });
    var openWp = PKGS.filter(function (p) { return !d.wp[p.id].complete; }).sort(function (a, b) { return a.finalWeek - b.finalWeek; });
    d.nextWp = openWp[0] || null;
    return d;
  }

  P.save = save;
  P.S = S;
  P.isLocked = isLocked;
  P.setLock = setLock;
  P.toggleLock = toggleLock;
  P.onSchedule = onSchedule;
  P.shiftOf = shiftOf;
  P.canMove = canMove;
  P.moveTask = moveTask;
  P.moveTaskTo = moveTaskTo;
  P.movedCount = movedCount;
  P.restorePlan = restorePlan;
  P.workWeeks = WORK;
  P.onChange = onChange;
  P.emit = emit;
  P.setStatus = setStatus;
  P.resetAll = resetAll;
  P.derive = derive;
  P.state = state;
})(window.PD = window.PD || {});
