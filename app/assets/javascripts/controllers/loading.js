'use strict';

angular.module('QuepidApp')
  .controller('LoadingCtrl', [
    '$scope',
    'caseTryNavSvc',
    function ($scope, caseTryNavSvc) {
      $scope.loading = {};
      $scope.loading.isLoading = function() {
        return caseTryNavSvc.isLoading();
      };

    }
  ]);
