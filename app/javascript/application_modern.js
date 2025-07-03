// This file is leverages importmaps and Stimulus and should be just app/javascript/application.js, but we still
// have the legacy Sprockets that depends on app/assets/javascripts/application.js to deal with.

// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"

import LocalTime from "local-time"
import Cookies from 'js-cookie'
LocalTime.start()

Turbo.config.drive.progressBarDelay = 1
Turbo.session.drive = false

import "vega"
import "vega-lite"
import "vega-embed"

window.dispatchEvent(new Event("vega:load"))

import "ahoy"

// Import Bootstrap and its dependencies
import "@popperjs/core"
import "bootstrap"

// Import the new CodeMirror module
import { setupGlobalCodeMirror } from "modules/editor"

// Initialize CodeMirror global instance
setupGlobalCodeMirror();

// Auto-initialize CodeMirror editors when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Look for textareas with data-codemirror-mode attribute
  const textareas = document.querySelectorAll('textarea[data-codemirror-mode]');
  
  textareas.forEach(textarea => {
    
    // Build options from data attributes
    const options = {};
    
    if (textarea.dataset.codemirrorMode) {
      options.mode = textarea.dataset.codemirrorMode;
    }
    
    if (textarea.dataset.codemirrorLineNumbers) {
      options.lineNumbers = textarea.dataset.codemirrorLineNumbers === 'true';
    }
    
    if (textarea.dataset.codemirrorHeight) {
      options.height = parseInt(textarea.dataset.codemirrorHeight);
    }
    
    if (textarea.dataset.codemirrorWidth) {
      options.width = parseInt(textarea.dataset.codemirrorWidth);
    }
    
    if (textarea.dataset.codemirrorReadonly) {
      options.readOnly = textarea.dataset.codemirrorReadonly === 'true';
    }
    
    CodeMirror.fromTextArea(textarea, options);
  });
});


// cookies consent toast handling begin
// Only rendered on the home page.
document.addEventListener("turbo:load", function() {
  // Show the toast when the page loads if it's been rendered.
  // The logic for deciding if we need to show the banner is in the server side partial _consent_toast.html.erb.
  const toastEl = document.getElementById('consent_banner');
  if (toastEl){
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  }

  const cookiesEuOKButton = document.querySelector('.js-cookies-eu-ok');
  if (cookiesEuOKButton) {
    cookiesEuOKButton.addEventListener('click', setCookie, false);
  }

});

function setCookie() {
  const isSecure = location.protocol === 'https:';
  Cookies.set('cookie_eu_consented', true, { path: '/', expires: 365, secure: isSecure });
}
// cookies consent toast handling end
