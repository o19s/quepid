'use strict';

angular.module('QuepidApp')
  .controller('BootstrapCtrl', [
    '$rootScope',
    'caseTryNavSvc',
    function($rootScope, caseTryNavSvc) {
      $rootScope.$watch('currentUser', function(user) {
        if ( angular.isDefined(user) && user !== null ) {
          caseTryNavSvc.bootstrap();
        }
      });
    }
  ]);
