'use strict';

angular.module('QuepidApp')
  .controller('QueryParamsDetailsCtrl', [
    '$scope', '$uibModalInstance',
    'flash',
    'aTry', 'settingsSvc',
    function(
      $scope, $uibModalInstance,
      flash,
      aTry, settingsSvc
    ) {
      $scope.aTry = aTry;

      $scope.tryName = {
        name: aTry.name,
        startRename: false,
        rename: function() {
          settingsSvc.renameTry(aTry.tryNo, $scope.tryName.name)
          .then(function() {
            $scope.tryName.startRename = false;
          });
        }
      };

      $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
      };

      $scope.deleteTry = function(aTry) {
        settingsSvc.deleteTry(aTry.tryNo)
          .then(function() {
            $uibModalInstance.dismiss();
            flash.success = 'Successfully deleted try!';
          }, function() {
            $uibModalInstance.dismiss();
            flash.error = 'Unable to delete try!';
          });
      };

      $scope.duplicateTry = function(aTry) {
        var result = {
          action: 'clone',
          aTry:   aTry
        };

        $uibModalInstance.close(result);
      };

      $scope.numTries = function() {
        return settingsSvc.editableSettings().numTries();
      };
    }
  ]);
