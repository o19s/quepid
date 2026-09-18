'use strict';

/**
 * Client-side routes and HTTP configuration for the Quepid app shell.
 * Case pages use `MainCtrl` with `views/queriesLayout.html`; unknown paths render the 404 view.
 */

angular.module('QuepidApp')
  .config([
    '$locationProvider',
    '$routeProvider',
    '$httpProvider',
    function (
      $locationProvider,
      $routeProvider,
      $httpProvider
     ) {
      $httpProvider.defaults.cache = false;
      if (!$httpProvider.defaults.headers.get) {
        $httpProvider.defaults.headers.get = {};
      }

      // disable IE ajax request caching
      $httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

      $locationProvider.html5Mode(true);

      $routeProvider
        .when('/case/:caseNo/try/:tryNo', {
          templateUrl: 'views/queriesLayout.html',
          controller: 'MainCtrl',
          reloadOnSearch: false
        })
        .when('/case/:caseNo', {
          templateUrl: 'views/queriesLayout.html',
          controller: 'MainCtrl',
          reloadOnSearch: false
        })
        .otherwise({
          templateUrl: 'views/404.html',
          controller: '404Ctrl'
        });
    }
  ]);
