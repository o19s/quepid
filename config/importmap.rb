# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application2', preload: true
pin 'local-time', to: 'vendored-local-time.js' # @3.0.2
pin '@hotwired/turbo-rails', to: 'turbo.min.js'

pin 'vega', to: 'vega.js'
pin 'vega-lite', to: 'vega-lite.js'
pin 'vega-embed', to: 'vega-embed.js'
pin 'ahoy', to: 'ahoy.js'
pin 'js-cookie' # @3.0.5

# CodeMirror 6 packages
pin '@codemirror/lang-javascript', to: 'https://ga.jspm.io/npm:@codemirror/lang-javascript@6.2.1/dist/index.js'
pin '@codemirror/lang-json', to: 'https://ga.jspm.io/npm:@codemirror/lang-json@6.0.1/dist/index.js'
pin '@lezer/javascript', to: 'https://ga.jspm.io/npm:@lezer/javascript@1.4.6/dist/index.js'
pin '@lezer/lr', to: 'https://ga.jspm.io/npm:@lezer/lr@1.3.10/dist/index.js'
pin '@lezer/json', to: 'https://ga.jspm.io/npm:@lezer/json@1.0.1/dist/index.js'
pin 'modules/editor', to: 'modules/editor.js'
pin "codemirror" # @6.0.2
pin "@codemirror/autocomplete", to: "@codemirror--autocomplete.js" # @6.18.6
pin "@codemirror/commands", to: "@codemirror--commands.js" # @6.8.1
pin "@codemirror/language", to: "@codemirror--language.js" # @6.11.1
pin "@codemirror/lint", to: "@codemirror--lint.js" # @6.8.5
pin "@codemirror/search", to: "@codemirror--search.js" # @6.5.11
pin "@codemirror/state", to: "@codemirror--state.js" # @6.5.2
pin "@codemirror/view", to: "@codemirror--view.js" # @6.37.2
pin "@lezer/common", to: "@lezer--common.js" # @1.2.3
pin "@lezer/highlight", to: "@lezer--highlight.js" # @1.2.1
pin "@marijn/find-cluster-break", to: "@marijn--find-cluster-break.js" # @1.0.2
pin "crelt" # @1.0.6
pin "style-mod" # @4.1.2
pin "w3c-keyname" # @2.2.8
