/* ==========================================================================
   Dashboard depth settings — how far the dashboard's own sections and
   panels travel with the pointer (js/interactions/parallax.js). Nothing here
   knows about tasks, charts or state; the dashboard never reads it.

   The background scene, its camera sway and the shared pointer loop are
   configured in ../../assets/js/ambient-scene.js (window.MavisAmbient.config),
   which every product page loads.
   ========================================================================== */
(function (P) {
  "use strict";
  P.fx = P.fx || {};
  P.fx.depth = {
    /* Dashboard parallax travel (px) at full pointer deflection, per depth
       level. Negative = moves against the pointer, like objects behind the
       orbit target of the tilting camera.                                  */
    layers: {
      section: -10,     // section wrappers (headings + panels move together)
      panel: -4.5       // glass panels, relative to their section
    },
    verticalRatio: 0.4,   // vertical travel relative to horizontal — the sway is mostly sideways
    scrollDrift: {}
  };
})(window.PD = window.PD || {});
