'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('CurrSettingsCtrl', [
    '$scope', '$rootScope',
    'settingsSvc',
    function ($scope, $rootScope, settingsSvc) {
      $scope.currentTry = {
        selectedTry: selectedTry
      };

      function selectedTry() {
        if ( settingsSvc.isTrySelected() ) {
          return settingsSvc.applicableSettings();
        } else {
          return { name: '' };
        }
      }

      $scope.tryName = {
        name: null,
        startRename: false,
        rename: function() {
          settingsSvc.renameTry($scope.currentTry.selectedTry().tryNo, $scope.tryName.name)
          .then(function() {
            $scope.tryName.startRename = false;
          });
        },
        cancel: function() {
          $scope.tryName.startRename = false;
          $scope.tryName.name = $scope.currentTry.selectedTry().name;
        }
      };

      $scope.tryNameEditModeToggle = function(){
        $scope.tryName.name = $scope.currentTry.selectedTry().name;
        $scope.tryName.startRename = !$scope.tryName.startRename;
      };
    }
  ]);
