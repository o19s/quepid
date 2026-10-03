// Entry point for the remaining core vendor globals.
// This is compiled by esbuild into app/assets/builds/core_vendor.js.

// Bootstrap 5 JS (Tooltip, Popover, etc.) is loaded separately via the
// `bootstrap_globals` importmap pin (see app/views/layouts/core.html.erb)
// instead of being bundled here from npm — see config/importmap.rb for why.

// Vega for charts is loaded separately via the `vega_globals` importmap pin
// (see app/views/layouts/core.html.erb), not through this bundle.

// Shepherd for tours. Both are UMD builds; under esbuild's CommonJS-like
// module scope they resolve to their `module.exports` branch instead of
// setting `root.Shepherd`/`root.Tether`, so legacy code (app/javascript/tour.js)
// referencing the bare `Shepherd` global needs it pinned to window explicitly.
import Tether from 'tether-shepherd/dist/js/tether';
window.Tether = Tether;
import Shepherd from 'tether-shepherd/dist/js/shepherd';
window.Shepherd = Shepherd;
