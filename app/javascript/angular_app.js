// Entry point for bundling the Angular 1 application
// This will be compiled by esbuild into app/assets/builds/angular_app.js
// NOTE: jQuery must be loaded separately before this bundle

// Angular and AngularJS satellite modules (vendored under ./vendor/ except core angular from npm)
import 'angular';
import './vendor/angular-route';
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
// $.fn.sortable(). Pinned to window so quepidSortable can use it without
// importing into the Angular bundle (matches the pattern above).
import Sortable from 'sortablejs';
window.Sortable = Sortable;

// curl-generator — builds the curl snippet shown in the "Browse Results" modal.
// Pinned to window so BrowseQueryModalInstanceCtrl can use it without importing
// into the Angular bundle (matches the pattern above).
import { CurlGenerator } from 'curl-generator';
window.CurlGenerator = CurlGenerator;

// Angular third-party modules (vendored sources; see vendor/README.md)
import './vendor/angular-wizard/angular-wizard.js';
import './vendor/angular-utils-pagination';
import './vendor/angular-csv-import/lib/angular-csv-import.js';
import './vendor/angular-flash/angular-flash.js';
import 'clipboard';
import './vendor/ngclipboard/ngclipboard.js';
import './vendor/ng-tags-input/build/ng-tags-input.js';
import 'file-saver';

// ACE editor
import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/ext-language_tools';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-lucene';
window.ace = ace;

// Angular UI ACE
import './vendor/angular-ui-ace/src/ui-ace.js';

// Splainer Search (vanilla-JS 3.x wrapped in a local Angular shim)
import './splainer_search_adapter';

// ng-json-explorer - use dist build to avoid gulpfile issues
import './vendor/ng-json-explorer/dist/angular-json-explorer.js';

// Vega for charts (angular-vega.js directive) is loaded separately via the
// `vega_globals` importmap pin (see app/views/layouts/core.html.erb) instead
// of being bundled here from npm — see config/importmap.rb for why.

// URI.js
import URI from 'urijs';
window.URI = URI;

// Shared BS5 tooltip/popover/paste helpers (see app/javascript/quepid_dom.js).
import quepidDom from './quepid_dom';
window.quepidDom = quepidDom;

// Shepherd for tours
import 'tether-shepherd/dist/js/tether';
import 'tether-shepherd/dist/js/shepherd';

// Angular templates are pre-populated into $templateCache by build_templates.js
// (a local replacement for the angular-rails-templates gem). Controllers,
// directives, and services under app/assets/javascripts/ are still loaded via
// the asset pipeline rather than this bundle.
