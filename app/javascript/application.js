// This file leverages importmaps and Stimulus for Rails pages. The core case
// uses a separate esbuild entry (see package.json).

// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"

import LocalTime from "local-time"
LocalTime.start()

Turbo.config.drive.progressBarDelay = 500
Turbo.session.drive = true

import "vega_globals"

import "ahoy"

// Import Bootstrap and its dependencies, exposing the UMD global used by the
// data API and Stimulus controllers.
import "bootstrap_globals"
