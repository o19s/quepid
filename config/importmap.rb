# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application', preload: 'application'
pin '@hotwired/turbo-rails', to: 'turbo.min.js', preload: true
pin '@hotwired/stimulus', to: 'stimulus.min.js'
pin '@hotwired/stimulus-loading', to: 'stimulus-loading.js'
pin 'quepid_store', to: 'quepid_store.js'
pin 'core_runtime', to: 'core_runtime.js'
pin_all_from 'app/javascript/controllers', under: 'controllers', preload: 'application'
pin_all_from 'app/javascript/utils', under: 'utils'
pin_all_from 'app/javascript/stores', under: 'stores'
pin_all_from 'app/javascript/api', under: 'api'

pin 'local-time' # @3.0.3

pin 'vega', to: 'vega.js'
pin 'vega-lite', to: 'vega-lite.js'
pin 'vega-embed', to: 'vega-embed.js'
# Shared entry point that loads the three above and exposes them as window
# globals — pinned separately so pages that don't otherwise load
# application.js (analytics and Rails pages) can load just this.
pin 'vega_globals'

pin 'ahoy', to: 'ahoy.js'

pin 'js-cookie' # @3.0.8

# Bootstrap and its dependencies
pin 'bootstrap', to: 'bootstrap.min.js' # @5.3.8
pin '@popperjs/core', to: 'popper.min.js' # @2.11.8
# Shared entry point that loads the two above and exposes them as window
# globals — pinned separately so pages that don't otherwise load
# application.js (the core case bundle) can load just this.
pin 'bootstrap_globals'

# Both page types import this shared editor; case pages fetch it through the ES-module bundle.
# Keep eager editor preloads on the Rails entry point.
# Scope application/controllers too, so their module preloads cannot pull in the editor indirectly.
# CodeMirror 6 packages
pin 'modules/editor', to: 'modules/editor.js', preload: 'application'
pin '@codemirror/lint', to: '@codemirror--lint.js', preload: 'application' # @6.9.7
pin '@codemirror/lang-json', to: '@codemirror--lang-json.js', preload: 'application' # @6.0.2
pin '@codemirror/language', to: '@codemirror--language.js', preload: 'application' # @6.13.1
pin '@codemirror/state', to: '@codemirror--state.js', preload: 'application' # @6.7.6
pin '@codemirror/view', to: '@codemirror--view.js', preload: 'application' # @6.43.15
pin '@lezer/common', to: '@lezer--common.js', preload: 'application' # @1.5.4
pin '@lezer/highlight', to: '@lezer--highlight.js', preload: 'application' # @1.2.5
pin '@lezer/json', to: '@lezer--json.js', preload: 'application' # @1.0.3
pin '@lezer/lr', to: '@lezer--lr.js', preload: 'application' # @1.4.11
pin '@marijn/find-cluster-break', to: '@marijn--find-cluster-break.js', preload: 'application' # @1.0.4
pin 'crelt', preload: 'application' # @1.0.7
pin 'style-mod', preload: 'application' # @4.1.4
pin 'w3c-keyname', preload: 'application' # @2.2.8
pin '@codemirror/lang-javascript', to: '@codemirror--lang-javascript.js', preload: 'application' # @6.2.5
pin '@codemirror/autocomplete', to: '@codemirror--autocomplete.js', preload: 'application' # @6.20.4
pin '@codemirror/commands', to: '@codemirror--commands.js', preload: 'application' # @6.11.1
pin '@lezer/javascript', to: '@lezer--javascript.js', preload: 'application' # @1.5.6
pin 'party-js' # @2.2.0

pin 'modules/search_endpoint_select', to: 'modules/search_endpoint_select.js'
pin '@codemirror/streamparser', to: '@codemirror--streamparser.js', preload: 'application' # @6.0.0
