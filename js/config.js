/* =========================================================================
   config.js — site-level configuration.

   Camera/gesture/scroll tuning now lives in HandGestureNav.DEFAULTS
   (see js/hand-gesture-utility.js), since that file is a standalone,
   reusable utility with its own sensible defaults. `gestureNav` below is
   only the Trivron-specific overrides passed into `new HandGestureNav(...)`.
   ========================================================================= */

const CONFIG = {

    /* ---------------------------------------------------------------
       Page transitions (lightweight CSS only). Site-specific: unrelated
       to the gesture utility.
       --------------------------------------------------------------- */
    transition: {
        outMs: 180,
        enabled: true
    },

    /* ---------------------------------------------------------------
       Debug overlay. Off in production; enable with ?debug=1 or Shift+D.
       --------------------------------------------------------------- */
    debug: false,

    /* ---------------------------------------------------------------
       Overrides merged on top of HandGestureNav.DEFAULTS. Leave empty to
       use the utility's built-in defaults as-is.
       --------------------------------------------------------------- */
    gestureNav: {}
};

/* URL flag wins over the default above, e.g. index.html?debug=1 */
if (typeof window !== "undefined" && /[?&]debug=1\b/.test(window.location.search)) {
    CONFIG.debug = true;
}
