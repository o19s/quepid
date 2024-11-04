# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application2', preload: true
#pin 'local-time', to: 'vendored-local-time.js' # @3.0.2
#pin '@hotwired/turbo-rails', to: 'turbo.min.js'

pin "ace", to: "ace-builds/src-min-noconflict/ace.js"
pin "ext-language_tools", to: "ace-builds/src-min-noconflict/ext-language_tools.js"
pin "mode-json", to: "ace-builds/src-min-noconflict/mode-json.js"
pin "mode-javascript", to: "ace-builds/src-min-noconflict/mode-javascript.js"
pin "mode-lucene", to: "ace-builds/src-min-noconflict/mode-lucene.js"
pin "theme-chrome", to: "ace-builds/src-min-noconflict/theme-chrome.js"
pin 'footer', preload: true
