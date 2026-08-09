// Loads vega/vega-lite/vega-embed and exposes them as window globals.
//
// These three are pinned in config/importmap.rb to files vendored by the
// `vega` gem (served through the Rails asset pipeline, not npm/node_modules)
// so every page that needs Vega shares one copy instead of each esbuild
// bundle (admin, analytics, the Angular core app) shipping its own.
//
// They're plain UMD builds, not real ES modules — loading them via a bare
// `import` still runs them (any script is valid as a no-export ES module),
// and their UMD wrapper's "browser global" branch is what actually assigns
// `window.vega` / `window.vegaLite` / `window.vegaEmbed` as a side effect.
// vega-embed's wrapper reads `window.vega` / `window.vegaLite` at that same
// evaluation time, so this order (vega, then vega-lite, then vega-embed)
// matters — ES modules evaluate sibling static imports in declaration
// order when there's no dependency relationship between them, so this is
// safe as long as the three `import` lines stay in this order.
import "vega"
import "vega-lite"
import "vega-embed"

window.dispatchEvent(new Event("vega:load"))
