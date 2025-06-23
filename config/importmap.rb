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
pin 'codemirror', to: 'https://ga.jspm.io/npm:codemirror@6.0.1/dist/index.js'
pin '@codemirror/state', to: 'https://ga.jspm.io/npm:@codemirror/state@6.2.1/dist/index.js'
pin '@codemirror/view', to: 'https://ga.jspm.io/npm:@codemirror/view@6.16.0/dist/index.js'
pin '@codemirror/commands', to: 'https://ga.jspm.io/npm:@codemirror/commands@6.2.4/dist/index.js'
pin '@codemirror/language', to: 'https://ga.jspm.io/npm:@codemirror/language@6.9.0/dist/index.js'
pin '@codemirror/lang-javascript', to: 'https://ga.jspm.io/npm:@codemirror/lang-javascript@6.2.1/dist/index.js'
pin '@codemirror/lang-json', to: 'https://ga.jspm.io/npm:@codemirror/lang-json@6.0.1/dist/index.js'
pin '@codemirror/autocomplete', to: 'https://ga.jspm.io/npm:@codemirror/autocomplete@6.11.0/dist/index.js'
pin '@lezer/common', to: 'https://ga.jspm.io/npm:@lezer/common@1.1.0/dist/index.js'
pin '@lezer/highlight', to: 'https://ga.jspm.io/npm:@lezer/highlight@1.1.6/dist/index.js'
pin '@lezer/javascript', to: 'https://ga.jspm.io/npm:@lezer/javascript@1.4.6/dist/index.js'
pin '@lezer/lr', to: 'https://ga.jspm.io/npm:@lezer/lr@1.3.10/dist/index.js'
pin '@lezer/json', to: 'https://ga.jspm.io/npm:@lezer/json@1.0.1/dist/index.js'
pin 'style-mod', to: 'https://ga.jspm.io/npm:style-mod@4.1.0/src/style-mod.js'
pin 'w3c-keyname', to: 'https://ga.jspm.io/npm:w3c-keyname@2.2.8/index.js'
pin 'modules/editor', to: 'modules/editor.js'
