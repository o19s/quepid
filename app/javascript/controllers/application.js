import { Application } from "@hotwired/stimulus"

const application = Application.start()

// Configure Stimulus development experience
application.debug = false
// Kept global for debugging and for Playwright specs that look up controllers
// with getControllerForElementAndIdentifier.
window.Stimulus   = application

export { application }
