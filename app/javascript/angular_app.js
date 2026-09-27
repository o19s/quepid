// Entry point for bundling the Angular 1 application
// This will be compiled by esbuild into app/assets/builds/angular_app.js
// NOTE: jQuery must be loaded separately before this bundle

// Angular and AngularJS satellite modules (vendored under ./vendor/ except core angular from npm)
import 'angular';
import './vendor/angular-sanitize';

// Bootstrap 5 JS (Tooltip, Popover, etc.) is loaded separately via the
// `bootstrap_globals` importmap pin (see app/views/layouts/core.html.erb)
// instead of being bundled here from npm — see config/importmap.rb for why.

// kraaden/autocompleter — vanilla replacement for uib-typeahead. Pinned to
// window so quepidTypeahead can use it without importing into the Angular
// bundle (matches the bootstrap pattern above).
import autocomplete from 'autocompleter';
window.autocompleter = autocomplete;

// SortableJS — vanilla replacement for angular-ui-sortable/jQuery UI's
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

// Angular UI ACE

// Splainer Search (vanilla-JS 3.x wrapped in a local Angular shim)
import './splainer_search_adapter';

// Vega for charts is loaded separately via the `vega_globals` importmap pin
// (see app/views/layouts/core.html.erb), not through Angular.

// URI.js
import URI from 'urijs';
window.URI = URI;

// The framework-free case runtime is loaded by core.html.erb before this
// legacy bundle. It remains available on window for compatibility services,
// but is no longer bundled as part of Angular.

// Shepherd for tours. Both are UMD builds; under esbuild's CommonJS-like
// module scope they resolve to their `module.exports` branch instead of
// setting `root.Shepherd`/`root.Tether`, so legacy code (app/assets/javascripts/tour.js)
// referencing the bare `Shepherd` global needs it pinned to window explicitly
// (matches the URI/quepidDom pattern above).
import Tether from 'tether-shepherd/dist/js/tether';
window.Tether = Tether;
import Shepherd from 'tether-shepherd/dist/js/shepherd';
window.Shepherd = Shepherd;

// Angular templates are pre-populated into $templateCache by build_templates.js
// (a local replacement for the angular-rails-templates gem). Controllers,
// directives, and services under app/assets/javascripts/ are still loaded via
// the asset pipeline rather than this bundle.
