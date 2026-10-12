// This file leverages importmaps and Stimulus for Rails pages. The core case
// uses a separate esbuild entry (see package.json).

// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
import { application } from "controllers/application"

import LocalTime from "local-time"
LocalTime.start()

Turbo.config.drive.progressBarDelay = 500
Turbo.session.drive = true

// data-turbo-confirm uses the layout's shared modal; native confirm until it connects.
// The form's data-turbo-confirm-style picks the Confirm button colour.
Turbo.config.forms.confirm = (message, form) => {
  const element = document.getElementById("confirmModal")
  const dialog = element && application.getControllerForElementAndIdentifier(element, "confirm-dialog")
  return dialog ? dialog.ask(message, form?.dataset.turboConfirmStyle) : Promise.resolve(window.confirm(message))
}

import "vega_globals"

import "ahoy"

// Import Bootstrap and its dependencies, exposing the UMD global used by the
// data API and Stimulus controllers.
import "bootstrap_globals"
