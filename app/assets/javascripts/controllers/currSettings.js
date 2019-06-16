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
    }
  ]);
