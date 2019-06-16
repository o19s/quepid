'use strict';

angular.module('UtilitiesModule')
  .service('secureRedirectSvc', [
    '$window', '$log',
    function SecureRedirectSvc($window, $log) {
      var scheme = 'https://';
      var port = '443';
      this.debugServer = function(debugPort) {
        port = debugPort.toString();
        scheme = 'http://';
        $log.debug('USING THE DEBUG SERVER: ' + scheme + ' port: ' + port);
      };
      this.redirectToSecure = function (path) {
        $window.location = scheme + $window.location.hostname + ':' + port + '/secure' + (path || '');
      };
      this.redirectToMain = function (path) {
        $window.location = 'http://' + $window.location.host + (path || '');
      };
    }
  ]);
