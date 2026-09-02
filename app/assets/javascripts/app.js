'use strict';

/**
 * Root Angular module for Quepid's interactive case UI (search tries, queries, scorers).
 * Declares third-party and internal modules; routing and `MainCtrl` wiring live in `routes.js`.
 */

angular.module('QuepidApp', [
  'UtilitiesModule',
  'ngRoute',
  'ngSanitize',
  'mgo-angular-wizard',
  'ngJsonExplorer',
  'o19s.splainer-search',
  'ui.ace',
  'angularUtils.directives.dirPagination',
  'ngCsvImport',
  'angular-flash.service',
  'angular-flash.flash-alert-directive',
  'ngTagsInput',
  'ng-rails-csrf',
  'templates',
  'ngclipboard',
  'ngVega'
]);
