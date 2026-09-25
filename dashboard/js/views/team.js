/* H · Team */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var TASKS = P.TASKS;
  function dlBadge() { return P.dlBadge.apply(null, arguments); }
  function esc() { return P.esc.apply(null, arguments); }
  function ownerChip() { return P.ownerChip.apply(null, arguments); }

  /* ======================================================================
     H · TEAM
     ====================================================================== */
  function renderTeam() {
    var key = { BME: "bme", EEE: "eee" };
    var shared = TASKS.filter(function (t) { return t.owner === "shared"; });
    var html = P.data.team.map(function (m) {
      var o = key[m.department];
      var leads = TASKS.filter(function (t) { return t.owner === o; });
      var parts = m.name.split(/\s+/), initials = parts[0][0] + parts[parts.length - 1][0];
      return '<div class="member"><div class="monogram" aria-hidden="true">' + esc(initials) + "</div><div>" +
        '<div class="dept">' + esc(m.department) + '</div><div class="name">' + esc(m.name) + "</div>" +
        '<div class="role">' + esc(OWNERS[o].label) + " on " + leads.length + " subtasks; shares " + shared.length + " more.</div>" +
        '<div class="load"><span><b>' + leads.length + "</b>leads</span><span><b>" + leads.reduce(function (s, t) { return s + t.duration; }, 0) + "</b>lead task-weeks</span><span><b>" + shared.length + "</b>shared</span></div>" +
        "</div></div>";
    }).join("");
    html += '<div class="team-note"><div class="ag-title" style="margin:0">Lead roles</div>' + OWNER_KEYS.map(function (o) {
      return '<div class="row">' + ownerChip(o) + "<span>" + esc(OWNERS[o].meaning) + "</span></div>";
    }).join("") + '<p class="dr-note" style="margin-top:6px">Team 1 is the deep-learning track. The modelling subtasks tagged ' + dlBadge() + " are its deep-learning work.</p></div>";
    $("#team-grid").innerHTML = html;
  }

  P.renderTeam = renderTeam;
})(window.PD = window.PD || {});
