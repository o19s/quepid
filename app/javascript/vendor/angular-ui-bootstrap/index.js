/**
 * Vendored angular-ui-bootstrap 2.5.6 (MIT). See LICENSE and README.md in this directory.
 *
 * This entry imports the same modular sources as upstream (editable under ./src/). Each component’s
 * full `index.js` pulls in its small `*.css` files; esbuild emits them into `app/assets/builds/angular_app.css`.
 * Load that stylesheet next to `angular_app.js` (see `app/views/layouts/core.html.erb`) so behavior matches
 * npm’s prebuilt `dist/ui-bootstrap-tpls.js`, which injects these rules at runtime.
 */

import './src/collapse';
import './src/tabindex';
import './src/accordion';
import './src/alert';
import './src/buttons';
import './src/carousel';
import './src/dateparser';
import './src/isClass';
import './src/datepicker';
import './src/position';
import './src/datepickerPopup';
import './src/debounce';
import './src/multiMap';
import './src/dropdown';
import './src/stackedMap';
import './src/modal';
import './src/paging';
import './src/pager';
import './src/pagination';
import './src/tooltip';
import './src/popover';
import './src/progressbar';
import './src/rating';
import './src/tabs';
import './src/timepicker';
import './src/typeahead';

angular.module('ui.bootstrap.tpls', [
  'uib/template/accordion/accordion-group.html',
  'uib/template/accordion/accordion.html',
  'uib/template/alert/alert.html',
  'uib/template/carousel/carousel.html',
  'uib/template/carousel/slide.html',
  'uib/template/datepicker/datepicker.html',
  'uib/template/datepicker/day.html',
  'uib/template/datepicker/month.html',
  'uib/template/datepicker/year.html',
  'uib/template/datepickerPopup/popup.html',
  'uib/template/modal/window.html',
  'uib/template/pager/pager.html',
  'uib/template/pagination/pagination.html',
  'uib/template/tooltip/tooltip-html-popup.html',
  'uib/template/tooltip/tooltip-popup.html',
  'uib/template/tooltip/tooltip-template-popup.html',
  'uib/template/popover/popover-html.html',
  'uib/template/popover/popover-template.html',
  'uib/template/popover/popover.html',
  'uib/template/progressbar/bar.html',
  'uib/template/progressbar/progress.html',
  'uib/template/progressbar/progressbar.html',
  'uib/template/rating/rating.html',
  'uib/template/tabs/tab.html',
  'uib/template/tabs/tabset.html',
  'uib/template/timepicker/timepicker.html',
  'uib/template/typeahead/typeahead-match.html',
  'uib/template/typeahead/typeahead-popup.html'
]);

angular.module('ui.bootstrap', [
  'ui.bootstrap.tpls',
  'ui.bootstrap.collapse',
  'ui.bootstrap.tabindex',
  'ui.bootstrap.accordion',
  'ui.bootstrap.alert',
  'ui.bootstrap.buttons',
  'ui.bootstrap.carousel',
  'ui.bootstrap.dateparser',
  'ui.bootstrap.isClass',
  'ui.bootstrap.datepicker',
  'ui.bootstrap.position',
  'ui.bootstrap.datepickerPopup',
  'ui.bootstrap.debounce',
  'ui.bootstrap.multiMap',
  'ui.bootstrap.dropdown',
  'ui.bootstrap.stackedMap',
  'ui.bootstrap.modal',
  'ui.bootstrap.paging',
  'ui.bootstrap.pager',
  'ui.bootstrap.pagination',
  'ui.bootstrap.tooltip',
  'ui.bootstrap.popover',
  'ui.bootstrap.progressbar',
  'ui.bootstrap.rating',
  'ui.bootstrap.tabs',
  'ui.bootstrap.timepicker',
  'ui.bootstrap.typeahead'
]);

export default 'ui.bootstrap';
