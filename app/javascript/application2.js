// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
// This is a importmap version of the classic application.js so that we can have
// both sprockets and importmaps at the same time.


// Note: the file in vendor/javascript/vendored-local-time.js is the one that was downloaded via
// importmap pin.  See https://github.com/basecamp/local_time/issues/113 for others who suggested
// remaining it
//import "@hotwired/turbo-rails"
//import LocalTime from "local-time"
//LocalTime.start()

//window.Turbo.setProgressBarDelay(1);

import "ace"; // Import the Ace library
import "ext-language_tools"; // Import the JavaScript mode
import "mode-json"; // Import the Monokai theme
import "mode-javascript";
import "mode-lucene";
import "theme-chrome";
//import "worker-javascript"
//import "ace_config"

//import "tour" // Can't figure out how to get Shepherd.js to load
import "footer"
