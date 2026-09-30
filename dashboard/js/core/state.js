/* Status state (single source, persisted) + derived metrics */
(function (P) {
  "use strict";
  var NW = P.NW;
  var OWNER_KEYS = P.OWNER_KEYS;
  var PKGS = P.PKGS;
  var STATUS = P.STATUS;
  var TASK = P.TASK;
  var TASKS = P.TASKS;
  var TOTAL_TW = P.TOTAL_TW;
  function openWp() { return P.openWp.apply(null, arguments); }

  /* ---------- state (single source, persisted) --------------------------- */
  var KEY = "pd-dashboard.team1.v1";
  var state = { status: {}, unlocked: {}, filters: { q: "", status: "all", wp: "all", owner: "all", week: "all" } };
  (function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && raw.status) Object.keys(raw.status).forEach(function (id) {
        if (TASK[id] && STATUS[raw.status[id]] && raw.status[id] !== "todo") state.status[id] = raw.status[id];
      });
      if (raw && raw.unlocked) Object.keys(raw.unlocked).forEach(function (id) {
        if (TASK[id] && raw.unlocked[id] === true) state.unlocked[id] = true;
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
  P.onChange = onChange;
  P.emit = emit;
  P.setStatus = setStatus;
  P.resetAll = resetAll;
  P.derive = derive;
  P.state = state;
})(window.PD = window.PD || {});
