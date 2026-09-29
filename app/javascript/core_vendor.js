// Entry point for the remaining core vendor globals.
// This is compiled by esbuild into app/assets/builds/core_vendor.js.

// Bootstrap 5 JS (Tooltip, Popover, etc.) is loaded separately via the
// `bootstrap_globals` importmap pin (see app/views/layouts/core.html.erb)
// instead of being bundled here from npm — see config/importmap.rb for why.

// SortableJS — vanilla replacement for the old jQuery UI sortable widget's
// $.fn.sortable(). Pinned to window for the Stimulus query-list controller
// (matches the bootstrap pattern above).
import Sortable from 'sortablejs';
window.Sortable = Sortable;


import 'file-saver';

// ACE editor
import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/ext-language_tools';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-lucene';
window.ace = ace;

// Vega for charts is loaded separately via the `vega_globals` importmap pin
// (see app/views/layouts/core.html.erb), not through this bundle.

// URI.js
import URI from 'urijs';
window.URI = URI;

// Shepherd for tours. Both are UMD builds; under esbuild's CommonJS-like
// module scope they resolve to their `module.exports` branch instead of
// setting `root.Shepherd`/`root.Tether`, so legacy code (app/javascript/tour.js)
// referencing the bare `Shepherd` global needs it pinned to window explicitly
// (matches the URI/core-DOM pattern above).
import Tether from 'tether-shepherd/dist/js/tether';
window.Tether = Tether;
import Shepherd from 'tether-shepherd/dist/js/shepherd';
window.Shepherd = Shepherd;
