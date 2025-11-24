// jQuery bundle - must load before angular_app
// This ensures jQuery is available globally for jQuery UI and other plugins

import jQuery from 'jquery';

// Expose jQuery globally
window.jQuery = jQuery;
window.$ = jQuery;
