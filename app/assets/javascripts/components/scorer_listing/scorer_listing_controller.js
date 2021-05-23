'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ScorerListingCtrl', [
    '$scope',
    function (
      $scope
    ) {
      var ctrl = this;
      ctrl.scorer = $scope.scorer;
      ctrl.team  = $scope.team;

      // Functions

    }
  ]);
