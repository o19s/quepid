'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('UserListingCtrl', [
    '$scope',
    function ( $scope ) {
      var ctrl = this;

      ctrl.user  = $scope.user;
      ctrl.team  = $scope.team;

    }
  ]);
