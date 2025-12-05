// jQuery bundle - ONLY jQuery, not jQuery UI
// This file is bundled as IIFE by esbuild and must load BEFORE angular_app.js

import jQuery from 'jquery';

// Expose jQuery globally for all other scripts
window.jQuery = jQuery;
window.$ = jQuery;
