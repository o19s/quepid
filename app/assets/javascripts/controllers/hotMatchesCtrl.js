'use strict';

angular.module('QuepidApp')
  .controller('HotMatchesCtrl', [
    '$scope',
    function ($scope) {
      $scope.$watch('doc.hotMatchesOutOf(maxDocScore)', function(value) {
        $scope.hots = value;
        $scope.howMuchMore = ($scope.hots.length - 3) + ' More' ;
        $scope.showAll = false;
      });
    }
  ]);
