'use strict';

angular.module('QuepidApp')
  .controller('CustomHeadersCtrl', [
    '$scope', function ($scope) {
      $scope.updateHeaders = function() {
        if($scope.settings.headerType !== 'API Key') {
          $scope.settings.customHeaders = '';
        } else {
          $scope.settings.customHeaders = '{\n  "Authorization": "ApiKey XXX"\n}';
        }
      };
    }
  ]);
