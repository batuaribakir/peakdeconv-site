/* H · Team */
(function (P) {
  "use strict";
  function $() { return P.$.apply(null, arguments); }
  var OWNERS = P.OWNERS;
  var OWNER_KEYS = P.OWNER_KEYS;
  var TASKS = P.TASKS;
  function esc() { return P.esc.apply(null, arguments); }

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
        '<div class="load"><span><b>' + leads.length + "</b>leads</span><span><b>" + shared.length + "</b>shared</span></div>" +
        "</div></div>";
    }).join("");
    $("#team-grid").innerHTML = html;
  }

  P.renderTeam = renderTeam;
})(window.PD = window.PD || {});
