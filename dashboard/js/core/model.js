/* Project model: normalised data derived from data/project-data.js */
(function (P) {
  "use strict";
  var D = window.PD_DATA;
  if (!D) { document.body.insertAdjacentHTML("afterbegin", "<p style='padding:24px'>Project data (data/project-data.js) failed to load.</p>"); throw new Error("PD_DATA missing"); }
  P.data = D;

  /* ---------- data ------------------------------------------------------- */
  var WEEKS = D.weeks, PKGS = D.packages, TASKS = D.tasks, OWNERS = D.owners;
  var NW = WEEKS.length;
  var PRES = WEEKS.filter(function (w) { return w.kind === "presentation"; }).map(function (w) { return w.week; });
  var MID = WEEKS.filter(function (w) { return w.kind === "midterm"; })[0].week;
  var TASK = {}, PKG = {};
  TASKS.forEach(function (t, i) { t.order = i; TASK[t.id] = t; });
  PKGS.forEach(function (p) {
    PKG[p.id] = p;
    p.tasks = TASKS.filter(function (t) { return t.wp === p.id; });
    p.tw = p.tasks.reduce(function (s, t) { return s + t.duration; }, 0);
    p.span = [p.headingBar[0], p.headingBar[p.headingBar.length - 1]];
    p.barSegments = segs(p.headingBar);
  });
  var TOTAL_TW = TASKS.reduce(function (s, t) { return s + t.duration; }, 0);
  var OWNER_KEYS = ["bme", "eee", "shared"];

  var STATUS = {
    todo: { label: "Not started", w: 0 },
    prog: { label: "In progress", w: 0.5 },
    done: { label: "Completed", w: 1 }
  };
  var S_KEYS = ["todo", "prog", "done"];

  function segs(weeks) {
    var out = [];
    weeks.slice().sort(function (a, b) { return a - b; }).forEach(function (w) {
      var l = out[out.length - 1];
      if (l && w === l[1] + 1) l[1] = w; else out.push([w, w]);
    });
    return out;
  }
  function weekKind(w) { return WEEKS[w - 1].kind; }

  P.segs = segs;
  P.weekKind = weekKind;
  P.WEEKS = WEEKS;
  P.PKGS = PKGS;
  P.TASKS = TASKS;
  P.OWNERS = OWNERS;
  P.NW = NW;
  P.PRES = PRES;
  P.MID = MID;
  P.TASK = TASK;
  P.PKG = PKG;
  P.TOTAL_TW = TOTAL_TW;
  P.OWNER_KEYS = OWNER_KEYS;
  P.STATUS = STATUS;
  P.S_KEYS = S_KEYS;
})(window.PD = window.PD || {});
