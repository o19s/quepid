'use strict';

angular.module('QuepidApp', [
  'yaru22.angular-timeago',
  'UtilitiesModule',
  'ngRoute',
  'ngCookies',
  'ngSanitize',
  'ui.bootstrap',
  'mgo-angular-wizard',
  'ngActionCable',
  'ui.sortable',
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
  'ngAnimate',
  'countUp',
  'ngclipboard'
])
.run(function ($location, ActionCableConfig){
  // Handle setting up websockets for ActionCable and AngularJS.
  ActionCableConfig.debug = true;
  var quepidStartsWithHttps = $location.protocol() === 'https';
  if (quepidStartsWithHttps) {
    ActionCableConfig.wsUri= "wss://" + $location.host() + "/cable";
  }
  else {
    ActionCableConfig.wsUri= "ws://" + $location.host() + "/cable";
  }
})
;
