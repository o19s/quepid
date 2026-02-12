'use strict';

angular.module('QuepidApp')
  .config([
    '$locationProvider',
    '$routeProvider',
    '$httpProvider',
    'flashProvider',
    function (
      $locationProvider,
      $routeProvider,
      $httpProvider,
      flashProvider
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

      // Support bootstrap 3.0 "alert-danger" class with error flash types
      flashProvider.errorClassnames.push('alert-danger');
    }
  ]);
