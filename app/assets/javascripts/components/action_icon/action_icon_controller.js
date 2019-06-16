'use strict';

/*jslint latedef:false*/

angular.module('QuepidApp')
  .controller('ActionIconCtrl', [
    '$scope',
    function ( $scope ) {
      var ctrl = this;
      ctrl.fnCall    = $scope.fnCall;
      ctrl.iconClass = $scope.iconClass;
      ctrl.title     = $scope.title;
    }
  ]);
