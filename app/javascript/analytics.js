// Analytics bundle - for vega visualizations
// Loads vega, vega-lite, and clipboard for the analytics pages

// Clipboard for copy functionality
import ClipboardJS from 'clipboard';
window.ClipboardJS = ClipboardJS;

// Vega for visualizations
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';
import vegaEmbed from 'vega-embed';

window.vega = vega;
window.vegaLite = vegaLite;
window.vegaEmbed = vegaEmbed;
