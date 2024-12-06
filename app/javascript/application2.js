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

import "vega"
import "vega-lite"
import "vega-embed"

window.dispatchEvent(new Event("vega:load"))

// consent banner handling begin
document.addEventListener("DOMContentLoaded", function() {
  // Show the toast when the page loads if it's been loaded
  var toastEl = document.getElementById('consent_banner');
  if (toastEl){
    var toast = new bootstrap.Toast(toastEl);
    toast.show();
  }
});
// consent banner handling end

// cookie handling begin
// Inspired by the https://github.com/infinum/cookies_eu project
var cookiesEu = {
  init: function() {
    var cookiesEuOKButton = document.querySelector('.js-cookies-eu-ok');

    if (cookiesEuOKButton) {
      this.addListener(cookiesEuOKButton);
    }
  },

  addListener: function(target) {
    // Support for IE < 9
    if (target.attachEvent) {
      target.attachEvent('onclick', this.setCookie);
    } else {
      target.addEventListener('click', this.setCookie, false);
    }
  },

  setCookie: function() {
    var isSecure = location.protocol === 'https:';
    Cookies.set('cookie_eu_consented', true, { path: '/', expires: 365, secure: isSecure });
    console.log("Setting consent");
  }
};

(function() {
 
  var isCalled = false;

  function isReady() {
    if (isCalled) {
      return
    }
    isCalled = true;

    cookiesEu.init();
  }

  if (document.addEventListener) {
    return document.addEventListener('DOMContentLoaded', isReady, false);
  }

  // Old browsers IE < 9
  if (window.addEventListener) {
    window.addEventListener(eventName('load'), isReady, false);
  } else if (window.attachEvent) {
    window.attachEvent(eventName('onload'), isReady);
  }
})();
// cookie handling end
