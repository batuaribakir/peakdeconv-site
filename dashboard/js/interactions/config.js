/* ==========================================================================
   Spatial interaction settings — the ONLY place to tune the background
   scene, depth and pointer shading. Nothing here knows about tasks, charts
   or state; the dashboard never reads it.

   The interaction language follows assets/spline/interactive_3_d_parallax_scene.spline
   (hover-tilt camera, damping 0.125 per frame, reset on pointer leave,
   depth-layered ribbons + particles), rebuilt as our own light scene with a
   wider horizontal sway.
   ========================================================================== */
(function (P) {
  "use strict";
  P.fx = P.fx || {};
  P.fx.config = {
    camera: {
      yawDeg: 7,            // horizontal sway of the 3D camera (reference scene: 2°, widened on request)
      pitchDeg: 2.2,        // vertical sway
      panX: 0.55,           // extra sideways camera travel (world units) at full deflection
      damping: 0.125,       // fraction closed per 60 fps frame (reference scene value)
      resetOnLeave: true
    },

    scene: {
      fov: 35,
      distance: 10,
      renderScale: 0.6,     // render below device resolution: softer ribbons, lighter GPU load
      scrollLift: 1.4,      // camera rises this much (world units) over the full page scroll
      particles: 220,
      // ribbons: control points (x, y, z), width, twist turns, opacity, hue offset
      ribbons: [
        { pts: [[-9, 3.6, -3], [-4, 1.6, -1.5], [0.5, 3.1, -0.8], [5, 1.0, -2.2], [10, 2.9, -4]], width: 1.7, twist: 1.25, opacity: 0.74, hue: 0.0,  speed: 0.32 },
        { pts: [[-10, -3.4, -1.5], [-4.5, -1.2, 0.6], [0.5, -2.9, 1.2], [5, -1.0, -0.6], [10, -2.8, -2.5]], width: 1.25, twist: 0.9, opacity: 0.66, hue: 0.33, speed: 0.26 },
        { pts: [[-12, -0.6, -9], [-6, 2.6, -8], [0, -0.4, -7], [6, 2.8, -8], [12, 0.2, -9.5]], width: 3.2, twist: 0.6, opacity: 0.46, hue: 0.62, speed: 0.18 }
      ]
    },

    /* Dashboard parallax travel (px) at full pointer deflection, per depth
       level. Negative = moves against the pointer, like objects behind the
       orbit target of the tilting camera.                                  */
    layers: {
      section: -10,     // section wrappers (headings + panels move together)
      panel: -4.5       // glass panels, relative to their section
    },
    verticalRatio: 0.4,   // vertical travel relative to horizontal — the sway is mostly sideways
    scrollDrift: {},

    light: {
      followSpeed: 9,     // 1/s — pointer shading follow
      resetSpeed: 5,      // 1/s — ease back when the pointer leaves
      restIntensity: 0.38,
      activeIntensity: 1,
      rest: { x: 0.78, y: 0.12 } // fraction of the viewport
    }
  };
})(window.PD = window.PD || {});
