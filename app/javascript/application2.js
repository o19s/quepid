// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
// This is a importmap version of the classic application.js so that we can have
// both sprockets and importmaps at the same time.


// Note: the file in vendor/javascript/vendored-local-time.js is the one that was downloaded via
// importmap pin.  See https://github.com/basecamp/local_time/issues/113 for others who suggested
// vendoring it
import "@hotwired/turbo-rails"
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

// Import the new CodeMirror module
import { setupGlobalCodeMirror } from "modules/editor"

// Initialize CodeMirror global instance
setupGlobalCodeMirror();


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
