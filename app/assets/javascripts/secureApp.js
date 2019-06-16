'use strict';

try {
  angular.module('QuepidSecureApp');
}
catch (e) {
  angular.module('QuepidSecureApp', ['UtilitiesModule', 'ngRoute', 'ng-rails-csrf', 'templates'])
    .config([
      '$locationProvider', '$routeProvider',
      function ($locationProvider, $routeProvider) {
        $locationProvider.html5Mode(true);

        $routeProvider
          .when('/', {
            controller: 'SignupCtrl',
            templateUrl: 'views/signup.html'
          })
          .otherwise({
            templateUrl: 'views/404.html',
            controller: '404Ctrl'
          });
      }
    ]);
}
