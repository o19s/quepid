'use strict';

angular.module('QuepidApp')
  .controller('CustomHeadersCtrl', [
    '$scope', function ($scope) {
      $scope.updateHeaders = function() {
        if($scope.settings.headerType === 'None') {
          $scope.settings.customHeaders = '';
        } else if ($scope.settings.headerType === 'Custom') {
          $scope.settings.customHeaders = '{\n "KEY": "VALUE"\n}';
        } else {
          $scope.settings.customHeaders = '{\n  "Authorization": "ApiKey XXX"\n}';
        }
      };
    }
  ]);
