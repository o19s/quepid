// This is a manifest file that'll be compiled into core.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or any plugin's vendor/assets/javascripts directory can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/rails/sprockets#sprockets-directives) for details
// about supported directives.
//
// This file loads all the below JavaScript files and can be very slow in the dev mode.
//
// Use the bootstrap-sprockets instead of bootstrap when you need individual boostrap files for
// debugging.  Otherwise the bootstrap version loads all the files as a single minified file.
//
// jquery-ui brings in a ton of files that make loading in dev slow.  The below is the minimum required
// to enable the drag and drop of queries in a case.  There may be others that are used by Quepid that
// we don't know about.
//
//= require jquery

//= require jquery-ui/widgets/draggable
//= require jquery-ui/widgets/droppable
//= require jquery-ui/widgets/sortable

//= require jquery-autoGrowInput
//= require d3
//= require d3-tip

//= require angular/angular
//= require ace-builds/src-min-noconflict/ace
//= require ace-builds/src-min-noconflict/ext-language_tools
//= require ace-builds/src-min-noconflict/mode-json
//= require ace-builds/src-min-noconflict/mode-javascript
//= require ace-builds/src-min-noconflict/mode-lucene

//= require vega
//= require vega-lite
//= require vega-embed

//= require ahoy

//= require angular-resource/angular-resource
//= require angular-cookies/angular-cookies
//= require angular-route/angular-route
//= require angular-sanitize/angular-sanitize
//= require angular-ui-bootstrap/dist/ui-bootstrap
//= require angular-ui-bootstrap/dist/ui-bootstrap-tpls
//= require angular-wizard/dist/angular-wizard
//= require angular-rails-templates
//= require splainer-search/splainer-search
//= require ng-json-explorer/dist/angular-json-explorer
//= require angular-ui-ace/src/ui-ace
//= require angular-ui-sortable/dist/sortable
//= require angular-utils-pagination/dirPagination
//= require angular-timeago/dist/angular-timeago
//= require angular-csv-import/dist/angular-csv-import
//= require angular-flash/dist/angular-flash
//= require angular-animate/angular-animate
//= require angular-countup/angular-countup
//= require clipboard/dist/clipboard
//= require ngclipboard/dist/ngclipboard
//= require ng-tags-input/build/ng-tags-input
//= require file-saver/dist/FileSaver
//= require urijs/src/URI
//= require utilitiesModule
//= require app
//= require routes
//= require_tree ./components
//= require_tree ./controllers
//= require_tree ./directives
//= require_tree ./factories
//= require_tree ./filters
//= require_tree ./interceptors
//= require_tree ./services
//= require_tree ./values
//= require_tree ../templates
//= require_tree ./components
//= require footer
//= require tether-shepherd/dist/js/tether
//= require tether-shepherd/dist/js/shepherd
//= require tour
//= require ace_config
