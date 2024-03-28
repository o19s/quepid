# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application2', preload: true
pin 'local-time', to: 'vendored-local-time.js' # @3.0.2
pin '@hotwired/turbo-rails', to: 'turbo.min.js'
