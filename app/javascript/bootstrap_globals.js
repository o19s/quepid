// Loads Bootstrap 5 JS (and its Popper.js dependency) and exposes it as a
// window global.
//
// These are pinned in config/importmap.rb to files vendored by
// importmap-rails (served through the Rails asset pipeline, not
// npm/node_modules) so every page that needs Bootstrap's JS shares one copy
// instead of each esbuild bundle (e.g. the Angular core app) shipping its
// own — same reasoning as vega_globals.js.
//
// bootstrap.min.js and popper.min.js are plain UMD builds, not real ES
// modules — loading them via a bare `import` still runs them (any script is
// valid as a no-export ES module), and their UMD wrapper's "browser global"
// branch is what actually assigns `window.Popper` / `window.bootstrap`.
// Bootstrap's wrapper reads `window.Popper` at that same evaluation time, so
// this order (popper, then bootstrap) matters, same as vega_globals.js.
import "@popperjs/core"
import "bootstrap"
