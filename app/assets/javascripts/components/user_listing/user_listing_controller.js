'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('UserListingCtrl', [
    '$scope',
    function ( $scope ) {
      var ctrl = this;

      ctrl.user  = $scope.user;
      ctrl.light = $scope.light;
      ctrl.team  = $scope.team;

      if ( ctrl.light ) {
        ctrl.colWidth = {
          image:  'col-xs-3 col-md-1',
          name:   'col-xs-9 col-md-11',
        };
      } else {
        ctrl.colWidth = {
          image:  'col-xs-3 col-md-1',
          name:   'col-xs-9 col-md-11',
        };
      }
    }
  ]);
