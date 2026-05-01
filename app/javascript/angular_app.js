// Entry point for bundling the Angular 1 application
// This will be compiled by esbuild into app/assets/builds/angular_app.js
// NOTE: jQuery must be loaded separately before this bundle

// jQuery UI and plugins (jQuery must already be loaded globally)
import 'jquery-ui-dist/jquery-ui.min';
import 'jquery-autogrowinput';

// D3 for visualizations
import * as d3 from 'd3';
window.d3 = d3;

// Angular and AngularJS satellite modules (vendored under ./vendor/ except core angular from npm)
import 'angular';
import './vendor/angular-cookies';
import './vendor/angular-route';
import './vendor/angular-sanitize';
import './vendor/angular-animate';

// Bootstrap 5 JS (Tooltip, Popover, etc.) — exposed as window.bootstrap for
// use by directives such as quepidTooltip. Pulls @popperjs/core transitively.
// esbuild resolves `bootstrap` to its ESM build, which exports named symbols
// but does NOT auto-assign window.bootstrap (unlike the UMD build that the
// importmap'd application_modern.js gets). Re-pin it here so directives can
// use the same window.bootstrap.* surface across both bundles.
import * as bootstrap from 'bootstrap';
window.bootstrap = bootstrap;

// Angular third-party modules (vendored sources; see vendor/README.md)
import './vendor/angular-ui-bootstrap/index.js';
import './vendor/angular-wizard/angular-wizard.js';
import './vendor/angular-ui-sortable/src/sortable.js';
import './vendor/angular-utils-pagination';
import './vendor/angular-timeago/dist/angular-timeago.js';
import './vendor/angular-csv-import/lib/angular-csv-import.js';
import './vendor/angular-flash/angular-flash.js';
import './vendor/angular-countup/angular-countup.js';
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

// Vega for charts
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import vegaEmbed from 'vega-embed';
window.vega = vega;
window.vegaLite = vegaLite;
window.vegaEmbed = vegaEmbed;

// URI.js
import URI from 'urijs';
window.URI = URI;

// Shepherd for tours
import 'tether-shepherd/dist/js/tether';
import 'tether-shepherd/dist/js/shepherd';

// Angular templates will be handled separately via angular-rails-templates
// The actual application code will be loaded via individual script tags
// or bundled in a separate step
