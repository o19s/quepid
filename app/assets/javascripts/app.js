'use strict';

/**
 * Root Angular module for Quepid's surviving case services (search tries, queries, scorers).
 * Declares third-party and internal modules; the case page is bootstrapped by
 * `core-bootstrap` (ngRoute/client-side routing removed -- see
 * docs/todo/angularjs_removal_inventory.md).
 */

angular.module('QuepidApp', [
  'ngSanitize',
  'o19s.splainer-search',
  'ng-rails-csrf',
  'templates',
]);
