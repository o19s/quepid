# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application_modern'
pin '@hotwired/turbo-rails', to: 'turbo.min.js'
pin '@hotwired/stimulus', to: 'stimulus.min.js'
pin '@hotwired/stimulus-loading', to: 'stimulus-loading.js'
pin_all_from 'app/javascript/controllers', under: 'controllers'

pin 'local-time' # @3.0.3

pin 'vega', to: 'vega.js'
pin 'vega-lite', to: 'vega-lite.js'
pin 'vega-embed', to: 'vega-embed.js'

pin 'ahoy', to: 'ahoy.js'

pin 'js-cookie' # @3.0.5

# Bootstrap and its dependencies
pin 'bootstrap', to: 'bootstrap.min.js' # @5.3.3
pin '@popperjs/core', to: 'popper.min.js' # @2.11.8

# CodeMirror 6 packages
pin 'modules/editor', to: 'modules/editor.js'
pin 'modules/api_url', to: 'modules/api_url.js'
pin 'modules/query_template', to: 'modules/query_template.js'
pin 'modules/search_executor', to: 'modules/search_executor.js'
pin 'modules/scorer', to: 'modules/scorer.js'
pin 'modules/scorer_executor', to: 'modules/scorer_executor.js'
pin 'modules/ratings_store', to: 'modules/ratings_store.js'
pin 'modules/explain_parser', to: 'modules/explain_parser.js'
pin 'modules/field_renderer', to: 'modules/field_renderer.js'
pin 'modules/flash_helper', to: 'modules/flash_helper.js'
pin 'modules/wizard_settings', to: 'modules/wizard_settings.js'
pin 'modules/settings_validator', to: 'modules/settings_validator.js'
pin 'codemirror' # @6.0.2
pin '@codemirror/commands', to: '@codemirror--commands.js' # @6.10.2
pin '@codemirror/lint', to: '@codemirror--lint.js' # @6.9.4
pin '@codemirror/search', to: '@codemirror--search.js' # @6.6.0
pin '@codemirror/lang-json', to: '@codemirror--lang-json.js' # @6.0.2
pin '@codemirror/language', to: '@codemirror--language.js' # @6.12.1
pin '@codemirror/state', to: '@codemirror--state.js' # @6.5.4
pin '@codemirror/view', to: '@codemirror--view.js' # @6.39.14
pin '@lezer/common', to: '@lezer--common.js' # @1.5.1
pin '@lezer/highlight', to: '@lezer--highlight.js' # @1.2.3
pin '@lezer/json', to: '@lezer--json.js' # @1.0.3
pin '@lezer/lr', to: '@lezer--lr.js' # @1.4.8
pin '@marijn/find-cluster-break', to: '@marijn--find-cluster-break.js' # @1.0.2
pin 'crelt' # @1.0.6
pin 'style-mod' # @4.1.3
pin 'w3c-keyname' # @2.2.8
pin '@codemirror/lang-javascript', to: '@codemirror--lang-javascript.js' # @6.2.4
pin '@codemirror/autocomplete', to: '@codemirror--autocomplete.js' # @6.20.0
pin '@lezer/javascript', to: '@lezer--javascript.js' # @1.5.4
pin 'party-js' # @2.2.0
pin 'sortablejs' # @1.15.7
pin 'd3' # @7.9.0
pin 'd3-array' # @3.2.4
pin 'd3-axis' # @3.0.0
pin 'd3-brush' # @3.0.0
pin 'd3-chord' # @3.0.1
pin 'd3-color' # @3.1.0
pin 'd3-contour' # @4.0.2
pin 'd3-delaunay' # @6.0.4
pin 'd3-dispatch' # @3.0.1
pin 'd3-drag' # @3.0.0
pin 'd3-dsv' # @3.0.1
pin 'd3-ease' # @3.0.1
pin 'd3-fetch' # @3.0.1
pin 'd3-force' # @3.0.0
pin 'd3-format' # @3.1.2
pin 'd3-geo' # @3.1.1
pin 'd3-hierarchy' # @3.1.2
pin 'd3-interpolate' # @3.0.1
pin 'd3-path' # @3.1.0
pin 'd3-polygon' # @3.0.1
pin 'd3-quadtree' # @3.0.1
pin 'd3-random' # @3.0.1
pin 'd3-scale' # @4.0.2
pin 'd3-scale-chromatic' # @3.1.0
pin 'd3-selection' # @3.0.0
pin 'd3-shape' # @3.2.0
pin 'd3-time' # @3.1.0
pin 'd3-time-format' # @4.1.0
pin 'd3-timer' # @3.0.1
pin 'd3-transition' # @3.0.1
pin 'd3-zoom' # @3.0.0
pin 'delaunator' # @5.0.1
pin 'internmap' # @2.0.3
pin 'robust-predicates' # @3.0.2
