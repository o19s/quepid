'use strict';

/**
 * Root Angular module for Quepid's remaining case-page directives and filters.
 * Declares third-party and internal modules; the case page is bootstrapped by
 * `core-bootstrap` (ngRoute/client-side routing removed -- see
 * docs/todo/angularjs_removal_inventory.md).
 */

angular.module('QuepidApp', [
  'ngSanitize',
  'templates',
]);
