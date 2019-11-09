'use strict';

/*jshint latedef:false*/

angular.module('QuepidApp')
  .controller('RemoveScorerCtrl', [
    '$scope',
    '$uibModal',
    'flash',
    'teamSvc',
    function (
      $scope,
      $uibModal,
      flash,
      teamSvc
    ) {
      var ctrl = this;

      ctrl.thisScorer = $scope.thisScorer;
      ctrl.thisTeam   = $scope.thisTeam;

      console.log("I am good to go with " + ctrl.thisScorer);

      console.log("What about " + $scope.scorer);

      ctrl.openRemoveModal  = openRemoveModal;
      ctrl.removeScorer     = removeScorer;

      function openRemoveModal() {
        var modalInstance = $uibModal.open({
          templateUrl:  'remove_scorer/_modal.html',
          controller:   'RemoveScorerModalInstanceCtrl',
          controllerAs: 'ctrl',
          size:         'sm',
          resolve:      {
            thisScorer: function() { return ctrl.thisScorer; },
            thisTeam: function() { return ctrl.thisTeam; }
          }
        });

        modalInstance.result.then(function (deleteClicked) {
          if( deleteClicked ){
            ctrl.removeScorer();
          }
        });
      }

      function removeScorer() {
        teamSvc.removeScorer(ctrl.thisTeam, ctrl.thisScorer)
          .then(function() {
            flash.success = 'Scorer removed';
          }, function(response) {
            flash.error = response.data.error;
          });
      }
    }
  ]);
