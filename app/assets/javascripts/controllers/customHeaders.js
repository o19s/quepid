'use strict';

angular.module('QuepidApp')
  .controller('CustomHeadersCtrl', [
    '$scope', function ($scope) {
      $scope.updateHeaders  = updateHeaders;

      function updateHeaders() {
        if($scope.settings.headerType !== 'API Key') {
          $scope.settings.customHeaders = "";
        } else {
          $scope.settings.customHeaders = '{\n  "Authorization": "ApiKey XXX"\n}';
        }
      }
    }
  ]);
