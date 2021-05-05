'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('UserListingCtrl', [
    '$scope',
    'flash',
    function ( $scope, flash ) {
      var ctrl = this;

      ctrl.user  = $scope.user;
      ctrl.team  = $scope.team;

      ctrl.confirmCopy = function () {
        flash.success = 'Invite url copied to clipboard.';
      }

    }
  ]);
