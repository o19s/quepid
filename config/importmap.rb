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
