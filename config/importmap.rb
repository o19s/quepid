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

pin 'js-cookie' # @3.0.8

# Bootstrap and its dependencies
pin 'bootstrap', to: 'bootstrap.min.js' # @5.3.8
pin '@popperjs/core', to: 'popper.min.js' # @2.11.8

# CodeMirror 6 packages
pin 'modules/editor', to: 'modules/editor.js'
pin '@codemirror/lint', to: '@codemirror--lint.js' # @6.9.7
pin '@codemirror/lang-json', to: '@codemirror--lang-json.js' # @6.0.2
pin '@codemirror/language', to: '@codemirror--language.js' # @6.12.4
pin '@codemirror/state', to: '@codemirror--state.js' # @6.7.1
pin '@codemirror/view', to: '@codemirror--view.js' # @6.43.7
pin '@lezer/common', to: '@lezer--common.js' # @1.5.2
pin '@lezer/highlight', to: '@lezer--highlight.js' # @1.2.3
pin '@lezer/json', to: '@lezer--json.js' # @1.0.3
pin '@lezer/lr', to: '@lezer--lr.js' # @1.4.10
pin '@marijn/find-cluster-break', to: '@marijn--find-cluster-break.js' # @1.0.3
pin 'crelt' # @1.0.7
pin 'style-mod' # @4.1.3
pin 'w3c-keyname' # @2.2.8
pin '@codemirror/lang-javascript', to: '@codemirror--lang-javascript.js' # @6.2.5
pin '@codemirror/autocomplete', to: '@codemirror--autocomplete.js' # @6.20.3
pin '@lezer/javascript', to: '@lezer--javascript.js' # @1.5.4
pin 'party-js' # @2.2.0
