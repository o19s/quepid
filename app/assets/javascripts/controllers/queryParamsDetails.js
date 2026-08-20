'use strict';

angular.module('QuepidApp')
  .controller('QueryParamsDetailsCtrl', [
    '$scope', '$quepidModalInstance',
    'flash',
    'aTry', 'settingsSvc', 'caseTryNavSvc',
    function(
      $scope, $quepidModalInstance,
      flash,
      aTry, settingsSvc, caseTryNavSvc
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
        $quepidModalInstance.dismiss('cancel');
      };

      $scope.deleteTry = function(aTry) {
        if (aTry.tryNo === caseTryNavSvc.getTryNo()){
          $quepidModalInstance.dismiss();
          flash.error = 'You can not delete the currently active try (' + aTry.name + ')!  Please select another try first.';
        }
        else {
          settingsSvc.deleteTry(aTry.tryNo)
            .then(function() {
              $quepidModalInstance.dismiss();
              flash.success = 'Successfully deleted try!';
            }, function() {
              $quepidModalInstance.dismiss();
              flash.error = 'Unable to delete try!';
            });
        }
      };

      $scope.duplicateTry = function(aTry) {
        var result = {
          action: 'clone',
          aTry:   aTry
        };

        $quepidModalInstance.close(result);
      };

      $scope.numTries = function() {
        return settingsSvc.editableSettings().numTries();
      };
    }
  ]);
