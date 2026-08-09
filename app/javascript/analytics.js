// Analytics bundle - for clipboard support on the analytics pages.
// Vega/vega-lite/vega-embed are loaded separately via the `vega_globals`
// importmap pin (see app/views/layouts/analytics.html.erb) instead of being
// bundled here from npm — see config/importmap.rb for why.

// Clipboard for copy functionality
import ClipboardJS from 'clipboard';
window.ClipboardJS = ClipboardJS;
