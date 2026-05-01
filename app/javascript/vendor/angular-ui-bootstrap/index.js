/**
 * Vendored angular-ui-bootstrap 2.5.6 (MIT). See LICENSE and README.md in this directory.
 * Module graph matches dist/ui-bootstrap-tpls.js on npm; *-nocss entries avoid bundling
 * component CSS (Quepid uses bootstrap3.css instead).
 */

import './src/collapse';
import './src/tabindex';
import './src/accordion';
import './src/alert';
import './src/buttons';
import './src/carousel/index-nocss.js';
import './src/dateparser';
import './src/isClass';
import './src/datepicker/index-nocss.js';
import './src/position/index-nocss.js';
import './src/datepickerPopup/index-nocss.js';
import './src/debounce';
import './src/multiMap';
import './src/dropdown/index-nocss.js';
import './src/stackedMap';
import './src/modal/index-nocss.js';
import './src/paging';
import './src/pager';
import './src/pagination';
import './src/tooltip/index-nocss.js';
import './src/popover/index-nocss.js';
import './src/progressbar';
import './src/rating';
import './src/tabs';
import './src/timepicker/index-nocss.js';
import './src/typeahead/index-nocss.js';

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
