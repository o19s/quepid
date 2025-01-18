'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('EditScorerCtrl', [
    '$uibModal',
    '$log',
    '$scope',
    '$rootScope',
    'flash',
    'scorerSvc',
    function (
      $uibModal,
      $log,
      $scope,
      $rootScope,
      flash,
      scorerSvc
    ) {
      var ctrl       = this;
      ctrl.lastSaved = angular.copy($scope.scorer);

      // Functions
      ctrl.editScorer  = editScorer;

      function editScorer() {
        $log.info('INFO: Opened modal to edit scorer!');
        if ( ctrl.lastSaved.communal && !$rootScope.currentUser.administrator ) {
          var deniedModalInstance = $uibModal.open({
            templateUrl:  'edit_scorer/_denied_communal_modal.html',
            controller:   'DeniedEditScorerModalInstanceCtrl',
            controllerAs: 'ctrl'
          });

          deniedModalInstance.result.then(
            function() { },
            function() { }
          );
        }
        else if ( !ctrl.lastSaved.communal && !$rootScope.currentUser.administrator ) {
          var deniedModalInstance2 = $uibModal.open({
            templateUrl:  'edit_scorer/_denied_modal.html',
            controller:   'DeniedEditScorerModalInstanceCtrl',
            controllerAs: 'ctrl'
          });

          deniedModalInstance2.result.then(
            function() { },
            function() { }
          );
        } else {
          var modalInstance = $uibModal.open({
            templateUrl:  'edit_scorer/_modal.html',
            controller:   'EditScorerModalInstanceCtrl',
            controllerAs: 'ctrl',
            size:         'lg',
            resolve: {
              scorer: function() {
                return ctrl.lastSaved;
              }
            }
          });

          modalInstance.result.then(
            function(data) {
              scorerSvc.edit(data)
                .then(function() {
                  flash.success = 'Scorer updated successfully';

                  if ( !angular.equals(data, $scope.scorer) ) {
                    // Reminder: `angular.copy(source, [destination]);`
                    angular.copy(data, $scope.scorer);
                  }
                },
                function(data) {
                  flash.error = data.message;
                });
            },
            function() {
              $log.info('INFO: Modal dismissed');
            }
          );
        }
      }
    }
  ]);
