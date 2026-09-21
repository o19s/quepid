'use strict';

/**
 * `$http`/`$location` configuration for the Quepid app shell. `MainCtrl` is instantiated
 * directly on `core/index.html.erb` (see `app/views/core/index.html.erb`), not via a client
 * route -- ngRoute/$routeProvider were removed, see docs/todo/angularjs_removal_inventory.md.
 */

angular.module('QuepidApp')
  .config([
    '$locationProvider',
    '$httpProvider',
    function (
      $locationProvider,
      $httpProvider
     ) {
      $httpProvider.defaults.cache = false;
      if (!$httpProvider.defaults.headers.get) {
        $httpProvider.defaults.headers.get = {};
      }

      // disable IE ajax request caching
      $httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

      $locationProvider.html5Mode(true);
    }
  ]);
