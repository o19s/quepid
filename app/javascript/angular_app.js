// Entry point for bundling the Angular 1 application
// This will be compiled by esbuild into app/assets/builds/angular_app.js
// NOTE: jQuery must be loaded separately before this bundle

// jQuery UI and plugins (jQuery must already be loaded globally)
import 'jquery-ui-dist/jquery-ui.min';
import 'jquery-autogrowinput';

// D3 for visualizations
import * as d3 from 'd3';
window.d3 = d3;

// Angular and core dependencies
import 'angular';
import 'angular-resource';
import 'angular-cookies';
import 'angular-route';
import 'angular-sanitize';
import 'angular-animate';

// Angular third-party modules
import 'angular-ui-bootstrap';
import 'angular-wizard';
import 'angular-ui-sortable';
import 'angular-utils-pagination';
import 'angular-timeago';
import 'angular-csv-import';
import 'angular-flash/dist/angular-flash';
import 'angular-countup';
import 'clipboard';
import 'ngclipboard';
import 'ng-tags-input';
import 'file-saver';

// ACE editor
import ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/ext-language_tools';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-lucene';
window.ace = ace;

// Angular UI ACE
import 'angular-ui-ace/src/ui-ace';

// Splainer Search
import 'splainer-search';

// ng-json-explorer - use the dist file to avoid gulpfile issues
import 'ng-json-explorer/dist/angular-json-explorer';

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