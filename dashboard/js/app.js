/* ==========================================================================
   Boot — renders every view from the model, wires them to the one state
   model, then tells the spatial layer that the surfaces exist.
   Dashboard logic lives in js/core, js/ui and js/views; the depth layer
   (js/interactions) only listens for the "pd:surfaces" event.
   ========================================================================== */
(function (P) {
  "use strict";

  P.renderTrace();
  P.renderKpisShell();
  P.renderGantt();
  P.renderPlate();
  P.fillFilters();
  P.bindTable();
  P.renderTable();
  P.buildWeekChart();
  P.buildWpChart();
  P.buildOwnerChart();
  P.renderMilestones();
  P.renderTeam();

  P.onChange(function (d) { P.renderKpis(d); P.renderNext(d); });
  P.onChange(P.updateGantt);
  P.onChange(P.updatePlate);
  P.onChange(function (d, id) { P.updateTableStatus(id); });
  P.onChange(P.updateWeekChart);
  P.onChange(P.updateWpChart);
  P.onChange(P.updateOwnerChart);
  P.onChange(P.updateMilestones);
  P.onChange(P.updateDrawer);
  P.emit(null);

  P.initNav();
  P.initReveal();

  // console / README helpers
  P.reset = P.resetAll;

  // the depth layer loads after this file and collects its elements on load
  document.dispatchEvent(new Event("pd:surfaces"));
})(window.PD);
