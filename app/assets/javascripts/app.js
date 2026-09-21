'use strict';

/**
 * Root Angular module for Quepid's interactive case UI (search tries, queries, scorers).
 * Declares third-party and internal modules; `MainCtrl` wiring lives in `routes.js`
 * (ngRoute/client-side routing removed -- see docs/todo/angularjs_removal_inventory.md).
 */

angular.module('QuepidApp', [
  'UtilitiesModule',
  'ngSanitize',
  'mgo-angular-wizard',
  'o19s.splainer-search',
  'ui.ace',
  'angularUtils.directives.dirPagination',
  'ngCsvImport',
  'ngTagsInput',
  'ng-rails-csrf',
  'templates',
  'ngVega'
]);
